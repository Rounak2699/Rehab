# ReHabRep — Home Physio Form Coach

ReHabRep pairs a React patient/therapist interface with a Python API. Therapists prescribe exercises, repetitions, daily sessions, angle ranges, and reminder times. Patients get posture outlines, camera-based movement guidance, and session tracking; therapists can review adherence and form-accuracy summaries.

## Run locally

Requires Python 3.10+ and Node.js.

In one PowerShell terminal, start the backend:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
$env:REHABREP_TOKEN_SECRET = "replace-this-with-a-long-random-secret"
Set-Location backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

In a second terminal, start the frontend from the project root:

```powershell
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:8000`. The camera needs HTTPS or localhost; the MediaPipe pose model and WebAssembly runtime are downloaded by the browser on first use.

## Install on Android

The Capacitor Android project is in `android\`. The Android app needs the ReHabRep API deployed on a server reachable from your phone over HTTPS; a localhost API or the Vite development proxy is not reachable from an installed app. Make sure your API CORS allowlist includes `https://localhost`, the Capacitor Android app origin.

Install Android Studio and its Android SDK (API 36), and install a JDK supported by the installed Android Gradle Plugin. Then, from the project root in PowerShell, build a debug APK:

```powershell
npm run android:apk
```

The installable debug APK is generated at `android\app\build\outputs\apk\debug\app-debug.apk`. Copy that APK to your Android phone and open it to install, or connect the phone with USB debugging enabled and run:

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

When you first launch the Android app, enter your deployed API address (for example, `https://your-api.example.com/api`) on the login screen and save it. The app remembers this URL on that phone. Alternatively, set `VITE_API_URL` before building to bake in a default API address. To open the native project in Android Studio, run `npm run android:sync` and then `npm run android:open`. Android camera access is requested when the patient starts a session.

## Demo accounts

- Therapist: `doctor` / `doctor123`
- Patients: `asha` or `ravi` / `patient123`

Demo accounts and prescriptions are created the first time the API starts. The SQLite database is stored in `backend\rehabrep.db` by default. Set `REHABREP_DB_PATH` to use another location.

## API

- `POST /api/auth/login` — password login, returns a signed bearer token.
- `GET /api/bootstrap` — role-scoped patient plans and session history.
- `POST /api/patients` — therapist creates a patient with an initial password.
- `POST /api/patients/{id}/exercises` / `DELETE .../{exercise_id}` — manage prescriptions and reminder schedules.
- `POST /api/sessions` — patient saves a completed or partial session.
- `GET /api/health` — service health check.

Interactive API documentation is available at `http://localhost:8000/docs`.

## Pose analysis and privacy

MediaPipe Pose Landmarker runs in the patient’s browser. It identifies visible body landmarks; the app calculates the prescribed joint angle with JavaScript geometry and counts a rep when the measured angle enters the therapist’s range after movement. A rep is marked correct when its angle is in range and landmark visibility is sufficient. No camera frames are uploaded or saved, and no NumPy is used.

This is a movement-range estimate, not a clinical assessment. Therapists should set and review exercise thresholds; patients should stop if an exercise causes pain. ReHabRep does not replace professional medical advice.

The signed token secret must be set for deployments; if omitted, a random development-only secret is generated and tokens will not survive a server restart. The demo accounts, local SQLite storage, and browser-only reminders are for development: reminders require the app to remain open, and this setup does not provide background push notifications, password reset, or a production consent workflow. Deploy with HTTPS, a protected database, managed credentials, and any required consent/security controls.

## Configuration

- `REHABREP_TOKEN_SECRET` — HMAC signing secret for API tokens.
- `REHABREP_DB_PATH` — SQLite file path.
- `REHABREP_ALLOWED_ORIGINS` — comma-separated API CORS allowlist (defaults to local Vite origins).
- `VITE_API_URL` — optional API base URL; defaults to the Vite `/api` proxy.
