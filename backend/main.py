import base64
import hashlib
import hmac
import json
import os
import re
import sqlite3
import time
from contextlib import asynccontextmanager, contextmanager
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("REHABREP_DB_PATH", str(BASE_DIR / "rehabrep.db")))
TOKEN_SECRET = os.getenv("REHABREP_TOKEN_SECRET") or os.urandom(32).hex()
TOKEN_LIFETIME_SECONDS = 60 * 60 * 12
PASSWORD_ITERATIONS = 310_000
bearer = HTTPBearer(auto_error=False)


def connect_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def db_connection():
    connection = connect_db()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def hash_password(password, salt=None):
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return salt.hex(), digest.hex()


def password_matches(password, salt, expected_hash):
    _, candidate = hash_password(password, bytes.fromhex(salt))
    return hmac.compare_digest(candidate, expected_hash)


def encode_token(payload):
    header = {"alg": "HS256", "typ": "JWT"}
    segments = [
        base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=")
        for value in (header, payload)
    ]
    signing_input = b".".join(segments)
    signature = hmac.new(TOKEN_SECRET.encode(), signing_input, hashlib.sha256).digest()
    return (signing_input + b"." + base64.urlsafe_b64encode(signature).rstrip(b"=")).decode()


def decode_token(token):
    try:
        header, payload, signature = token.split(".")
        signing_input = f"{header}.{payload}".encode()
        expected = base64.urlsafe_b64encode(
            hmac.new(TOKEN_SECRET.encode(), signing_input, hashlib.sha256).digest()
        ).rstrip(b"=")
        if not hmac.compare_digest(signature.encode(), expected):
            raise ValueError("Invalid signature")
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if claims.get("exp", 0) < time.time():
            raise ValueError("Expired token")
        return claims
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.") from exc


def initialize_database():
    with db_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                role TEXT NOT NULL CHECK (role IN ('doctor', 'patient')),
                name TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                doctor_id TEXT REFERENCES users(id),
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS exercises (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                joint TEXT NOT NULL,
                sets INTEGER NOT NULL CHECK (sets > 0),
                amount TEXT NOT NULL,
                min REAL NOT NULL,
                max REAL NOT NULL,
                sessions_per_day INTEGER NOT NULL DEFAULT 1 CHECK (sessions_per_day > 0),
                reminder_time TEXT NOT NULL DEFAULT '09:00',
                CHECK (min < max)
            );
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
                exercise_name TEXT NOT NULL,
                date TEXT NOT NULL,
                reps INTEGER NOT NULL CHECK (reps >= 0),
                correct INTEGER NOT NULL CHECK (correct >= 0 AND correct <= reps),
                target INTEGER NOT NULL CHECK (target > 0),
                issue TEXT NOT NULL DEFAULT '',
                angle_min REAL,
                angle_max REAL
            );
            CREATE INDEX IF NOT EXISTS exercises_patient_id ON exercises(patient_id);
            CREATE INDEX IF NOT EXISTS sessions_patient_date ON sessions(patient_id, date);
            """
        )
        exercise_columns = {
            column["name"] for column in connection.execute("PRAGMA table_info(exercises)").fetchall()
        }
        if "sessions_per_day" not in exercise_columns:
            connection.execute(
                "ALTER TABLE exercises ADD COLUMN sessions_per_day INTEGER NOT NULL DEFAULT 1"
            )
        if "reminder_time" not in exercise_columns:
            connection.execute(
                "ALTER TABLE exercises ADD COLUMN reminder_time TEXT NOT NULL DEFAULT '09:00'"
            )
        session_columns = {
            column["name"] for column in connection.execute("PRAGMA table_info(sessions)").fetchall()
        }
        if "angle_min" not in session_columns:
            connection.execute("ALTER TABLE sessions ADD COLUMN angle_min REAL")
        if "angle_max" not in session_columns:
            connection.execute("ALTER TABLE sessions ADD COLUMN angle_max REAL")
        seed_user(connection, "doctor", "doctor", "Dr. Demo", "doctor123")
        seed_user(connection, "asha", "patient", "Asha Raman", "patient123", "Knee surgery recovery", "doctor")
        seed_user(connection, "ravi", "patient", "Ravi Kumar", "patient123", "Shoulder rehab", "doctor")
        if connection.execute("SELECT COUNT(*) FROM exercises").fetchone()[0] == 0:
            exercises = [
                ("e1", "asha", "Range of motion", "Knee bend", "Knee", 3, "10 reps", 70, 110, 1, "09:00"),
                ("e2", "asha", "Stretching", "Hamstring stretch", "Hip", 2, "8 reps", 60, 90, 1, "09:30"),
                ("e3", "ravi", "Strengthening", "Shoulder raise", "Shoulder", 3, "12 reps", 80, 120, 1, "09:00"),
            ]
            connection.executemany(
                """INSERT INTO exercises
                   (id, patient_id, type, name, joint, sets, amount, min, max, sessions_per_day, reminder_time)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                exercises,
            )
        if connection.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0:
            demo_sessions = []
            for day_index, offset in enumerate((1, 2, 3, 5, 6)):
                for exercise_index, (exercise_id, exercise_name, target) in enumerate(
                    (("e1", "Knee bend", 30), ("e2", "Hamstring stretch", 16))
                ):
                    reps = max(target - ((day_index + exercise_index) % 3), 1)
                    correct = max(reps - 2 - ((day_index + exercise_index) % 3), 0)
                    demo_sessions.append(
                        (
                            f"demo-{offset}-{exercise_index}",
                            "asha",
                            exercise_id,
                            exercise_name,
                            (date.today() - timedelta(days=offset)).isoformat(),
                            reps,
                            correct,
                            target,
                            "Not bending enough" if (day_index + exercise_index) % 2 else "",
                            72.0 if exercise_index == 0 else 62.0,
                            104.0 if exercise_index == 0 else 87.0,
                        )
                    )
            connection.executemany(
                """INSERT INTO sessions
                   (id, patient_id, exercise_id, exercise_name, date, reps, correct, target, issue, angle_min, angle_max)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                demo_sessions,
            )


def seed_user(connection, user_id, role, name, password, note="", doctor_id=None):
    if connection.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone():
        return
    salt, password_hash = hash_password(password)
    connection.execute(
        """INSERT INTO users (id, role, name, note, doctor_id, password_salt, password_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (user_id, role, name, note, doctor_id, salt, password_hash),
    )


@asynccontextmanager
async def lifespan(_app):
    initialize_database()
    yield


app = FastAPI(title="ReHabRep API", version="1.0.0", lifespan=lifespan)
allowed_origins = os.getenv(
    "REHABREP_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,https://localhost",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class LoginRequest(BaseModel):
    role: str = Field(pattern="^(doctor|patient)$")
    id: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=256)


class PatientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=256)


class ExerciseCreate(BaseModel):
    type: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    joint: str = Field(min_length=1, max_length=40)
    sets: int = Field(gt=0, le=30)
    amount: str = Field(min_length=1, max_length=40)
    min: float = Field(ge=0, le=180)
    max: float = Field(gt=0, le=180)
    sessionsPerDay: int = Field(default=1, ge=1, le=8)
    reminderTime: str = Field(default="09:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class SessionCreate(BaseModel):
    exId: str = Field(min_length=1, max_length=80)
    exName: str = Field(min_length=1, max_length=120)
    date: date
    reps: int = Field(ge=0, le=1000)
    correct: int = Field(ge=0, le=1000)
    target: int = Field(gt=0, le=1000)
    issue: str = Field(default="", max_length=200)
    angleMin: float | None = Field(default=None, ge=0, le=180)
    angleMax: float | None = Field(default=None, ge=0, le=180)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to continue.")
    claims = decode_token(credentials.credentials)
    with db_connection() as connection:
        user = connection.execute(
            "SELECT id, role, name, doctor_id FROM users WHERE id = ?", (claims.get("sub"),)
        ).fetchone()
    if user is None or user["role"] != claims.get("role"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is unavailable.")
    return dict(user)


def require_doctor(user=Depends(current_user)):
    if user["role"] != "doctor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Doctor access is required.")
    return user


def require_patient(user=Depends(current_user)):
    if user["role"] != "patient":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient access is required.")
    return user


def check_patient_access(connection, doctor, patient_id):
    patient = connection.execute(
        "SELECT id FROM users WHERE id = ? AND role = 'patient' AND doctor_id = ?",
        (patient_id, doctor["id"]),
    ).fetchone()
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")


def read_patient(connection, row):
    plan = connection.execute(
        """SELECT id, type, name, joint, sets, amount, min, max,
                  sessions_per_day, reminder_time
           FROM exercises WHERE patient_id = ? ORDER BY rowid""",
        (row["id"],),
    ).fetchall()
    return {
        "id": row["id"],
        "name": row["name"],
        "note": row["note"],
        "plan": [
            {
                "id": exercise["id"],
                "type": exercise["type"],
                "name": exercise["name"],
                "joint": exercise["joint"],
                "sets": exercise["sets"],
                "amount": exercise["amount"],
                "min": exercise["min"],
                "max": exercise["max"],
                "sessionsPerDay": exercise["sessions_per_day"],
                "reminderTime": exercise["reminder_time"],
            }
            for exercise in plan
        ],
    }


def read_session(row):
    return {
        "id": row["id"],
        "patientId": row["patient_id"],
        "exId": row["exercise_id"],
        "exName": row["exercise_name"],
        "date": row["date"],
        "reps": row["reps"],
        "correct": row["correct"],
        "target": row["target"],
        "issue": row["issue"],
        "angleMin": row["angle_min"],
        "angleMax": row["angle_max"],
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login")
def login(request: LoginRequest):
    with db_connection() as connection:
        user = connection.execute(
            """SELECT id, role, name, doctor_id, password_salt, password_hash
               FROM users WHERE id = ? AND role = ?""",
            (request.id.strip().lower(), request.role),
        ).fetchone()
    if user is None or not password_matches(
        request.password, user["password_salt"], user["password_hash"]
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID or password is incorrect.")
    now = int(time.time())
    token = encode_token(
        {"sub": user["id"], "role": user["role"], "iat": now, "exp": now + TOKEN_LIFETIME_SECONDS}
    )
    return {"token": token, "user": {"id": user["id"], "role": user["role"], "name": user["name"]}}


@app.get("/api/bootstrap")
def bootstrap(user=Depends(current_user)):
    with db_connection() as connection:
        if user["role"] == "doctor":
            patient_rows = connection.execute(
                "SELECT id, name, note FROM users WHERE role = 'patient' AND doctor_id = ? ORDER BY name",
                (user["id"],),
            ).fetchall()
            patient_ids = [row["id"] for row in patient_rows]
        else:
            patient_rows = connection.execute(
                "SELECT id, name, note FROM users WHERE id = ? AND role = 'patient'", (user["id"],)
            ).fetchall()
            patient_ids = [user["id"]]
        patients = [read_patient(connection, patient) for patient in patient_rows]
        sessions = []
        for patient_id in patient_ids:
            rows = connection.execute(
                "SELECT * FROM sessions WHERE patient_id = ? ORDER BY date DESC, rowid DESC",
                (patient_id,),
            ).fetchall()
            sessions.extend(read_session(row) for row in rows)
    return {"patients": patients, "sessions": sessions}


@app.post("/api/patients", status_code=status.HTTP_201_CREATED)
def create_patient(request: PatientCreate, doctor=Depends(require_doctor)):
    name = request.name.strip()
    patient_id = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60]
    if not patient_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a valid patient name.")
    with db_connection() as connection:
        existing = connection.execute("SELECT 1 FROM users WHERE id = ?", (patient_id,)).fetchone()
        if existing:
            patient_id = f"{patient_id}-{uuid4().hex[:6]}"
        salt, password_hash = hash_password(request.password)
        connection.execute(
            """INSERT INTO users (id, role, name, doctor_id, password_salt, password_hash)
               VALUES (?, 'patient', ?, ?, ?, ?)""",
            (patient_id, name, doctor["id"], salt, password_hash),
        )
    return {"id": patient_id, "name": name, "note": "", "plan": []}


@app.post("/api/patients/{patient_id}/exercises", status_code=status.HTTP_201_CREATED)
def create_exercise(patient_id: str, request: ExerciseCreate, doctor=Depends(require_doctor)):
    if request.min >= request.max:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Minimum angle must be less than maximum angle.")
    exercise_id = "e" + uuid4().hex[:12]
    with db_connection() as connection:
        check_patient_access(connection, doctor, patient_id)
        connection.execute(
            """INSERT INTO exercises
               (id, patient_id, type, name, joint, sets, amount, min, max, sessions_per_day, reminder_time)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                exercise_id,
                patient_id,
                request.type,
                request.name,
                request.joint,
                request.sets,
                request.amount.strip(),
                request.min,
                request.max,
                request.sessionsPerDay,
                request.reminderTime,
            ),
        )
    return {
        "id": exercise_id,
        **request.model_dump(),
        "sessionsPerDay": request.sessionsPerDay,
        "reminderTime": request.reminderTime,
    }


@app.delete("/api/patients/{patient_id}/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise(patient_id: str, exercise_id: str, doctor=Depends(require_doctor)):
    with db_connection() as connection:
        check_patient_access(connection, doctor, patient_id)
        result = connection.execute(
            "DELETE FROM exercises WHERE id = ? AND patient_id = ?", (exercise_id, patient_id)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found.")


@app.post("/api/sessions", status_code=status.HTTP_201_CREATED)
def create_session(request: SessionCreate, patient=Depends(require_patient)):
    if request.correct > request.reps or request.reps > request.target:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Session counts must satisfy correct ≤ reps ≤ target.",
        )
    if (request.angleMin is None) != (request.angleMax is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both minimum and maximum observed angles must be provided together.",
        )
    if request.angleMin is not None and request.angleMin > request.angleMax:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Minimum observed angle must not exceed maximum observed angle.",
        )
    with db_connection() as connection:
        exercise = connection.execute(
            "SELECT id, name FROM exercises WHERE id = ? AND patient_id = ?",
            (request.exId, patient["id"]),
        ).fetchone()
        if exercise is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescribed exercise not found.")
        session_id = "s" + uuid4().hex[:12]
        connection.execute(
            """INSERT INTO sessions
               (id, patient_id, exercise_id, exercise_name, date, reps, correct, target, issue, angle_min, angle_max)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                session_id,
                patient["id"],
                exercise["id"],
                exercise["name"],
                request.date.isoformat(),
                request.reps,
                request.correct,
                request.target,
                request.issue.strip(),
                request.angleMin,
                request.angleMax,
            ),
        )
    return {"id": session_id, "patientId": patient["id"], "exId": exercise["id"], **request.model_dump()}
