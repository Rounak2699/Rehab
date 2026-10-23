import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { CATALOG } from "../../data/catalog.js";
import { num } from "../../utils/report.js";
import { api } from "../../services/api.js";
import Hero from "../../components/ui/Hero.jsx";
import ExerciseOutline from "../../components/ui/ExerciseOutline.jsx";

const EMPTY = { type: "", name: "", sets: "", amount: "", min: "", max: "", sessionsPerDay: "1", reminderTime: "09:00" };

export default function Prescribe({ selId, setSelId, goReport }) {
  const { db, refreshDb } = useApp();
  const [name, setName] = useState(db.patients.find((p) => p.id === selId)?.name || "");
  const [newPassword, setNewPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const patient = db.patients.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
  useEffect(() => { setSelId(patient ? patient.id : null); }, [patient?.id]);

  const options = f.type ? CATALOG[f.type] : [];
  const pickExercise = (n) => {
    const c = options.find((x) => x.name === n);
    setF({ ...f, name: n, min: c ? c.min : "", max: c ? c.max : "" });
  };

  const addPatient = async () => {
    setErr(""); setMsg("");
    if (newPassword.length < 8) return setErr("Set a password with at least 8 characters.");
    try {
      const created = await api("/patients", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), password: newPassword }),
      });
      await refreshDb();
      setSelId(created.id);
      setNewPassword("");
      setMsg(`Patient added. User ID: ${created.id}. Share the ID and password securely with ${created.name}.`);
    } catch (error) {
      setErr(error.message);
    }
  };

  const save = async () => {
    setErr(""); setMsg("");
    if (!patient) return setErr("Select or add a patient first.");
    if (!f.type || !f.name || !f.sets || !f.amount) return setErr("Fill in the exercise type, name, sets and duration or repetitions.");
    if (Number(f.min) >= Number(f.max)) return setErr("The minimum angle must be lower than the maximum angle.");
    const c = options.find((x) => x.name === f.name);
    try {
      await api(`/patients/${encodeURIComponent(patient.id)}/exercises`, {
        method: "POST",
        body: JSON.stringify({
          type: f.type,
          name: f.name,
          joint: c.joint,
          sets: num(f.sets),
          amount: f.amount.trim(),
          min: Number(f.min),
          max: Number(f.max),
          sessionsPerDay: Number(f.sessionsPerDay),
          reminderTime: f.reminderTime,
        }),
      });
      await refreshDb();
      setF(EMPTY); setAdding(false); setMsg("Exercise added to " + patient.name + "’s plan.");
    } catch (error) {
      setErr(error.message);
    }
  };

  const remove = async (id) => {
    try {
      await api(`/patients/${encodeURIComponent(patient.id)}/exercises/${encodeURIComponent(id)}`, { method: "DELETE" });
      await refreshDb();
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <>
      <Hero>{adding ? "Add exercise" : "Prescribed exercises"}</Hero>

      <div className="card">
        <label htmlFor="pn" style={{ marginTop: 0, fontSize: 15 }}>Patient name</label>
        <input id="pn" list="plist" value={name} onChange={(e) => { setName(e.target.value); setMsg(""); setErr(""); }} placeholder="Enter patient name" />
        <datalist id="plist">{db.patients.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        {!patient && name.trim() && (
          <>
            <label htmlFor="new-patient-password">Initial patient password</label>
            <input id="new-patient-password" type="password" minLength="8" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
            <button className="link" onClick={addPatient}>Add “{name.trim()}” as a new patient</button>
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </div>

      <div className="card">
        <h3>Prescribed exercises</h3>
        <div className="chips">
          {patient?.plan.map((e) => (
            <div key={e.id} className="prescribed-exercise">
              <div className="top" style={{ marginBottom: 4 }}>
                <strong>{e.name}</strong>
                <button className="link" aria-label={"Remove " + e.name} onClick={() => remove(e.id)}>Remove</button>
              </div>
              <p className="sub" style={{ margin: "0 0 4px" }}>{e.sessionsPerDay || 1} session(s) daily · reminder {e.reminderTime || "09:00"}</p>
              <ExerciseOutline exercise={e} compact />
            </div>
          ))}
          <button className="btn sm" onClick={() => setAdding(!adding)}>{adding ? "Close" : "Add exercise"}</button>
        </div>
        {patient && !patient.plan.length && <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>No exercises yet. Add the first one.</p>}
        {msg && <p className="ok">{msg}</p>}
      </div>

      {adding && (
        <div className="card">
          <label htmlFor="t" style={{ marginTop: 0 }}>Exercise type</label>
          <select id="t" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, name: "", min: "", max: "" })}>
            <option value="">Select exercise type</option>
            {Object.keys(CATALOG).map((t) => <option key={t}>{t}</option>)}
          </select>

          <label htmlFor="n">Exercise name</label>
          <select id="n" value={f.name} disabled={!f.type} onChange={(e) => pickExercise(e.target.value)}>
            <option value="">Select exercise</option>
            {options.map((x) => <option key={x.name}>{x.name}</option>)}
          </select>

          <label htmlFor="s">Number of sets</label>
          <input id="s" type="number" min="1" value={f.sets} onChange={(e) => setF({ ...f, sets: e.target.value })} placeholder="Enter number of sets" />

          <label htmlFor="a">Duration or repetitions per set</label>
          <input id="a" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="e.g. 10 reps or 30 sec" />

          <label htmlFor="sessions-per-day">Sessions per day</label>
          <input id="sessions-per-day" type="number" min="1" max="8" value={f.sessionsPerDay} onChange={(e) => setF({ ...f, sessionsPerDay: e.target.value })} />

          <label htmlFor="reminder-time">Daily reminder time</label>
          <input id="reminder-time" type="time" value={f.reminderTime} onChange={(e) => setF({ ...f, reminderTime: e.target.value })} />

          <label>Allowed joint angle range (degrees)</label>
          <div className="row">
            <input aria-label="Minimum angle" type="number" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} placeholder="Min" />
            <input aria-label="Maximum angle" type="number" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} placeholder="Max" />
          </div>

          {err && <p className="err" role="alert">{err}</p>}
          <div style={{ height: 14 }} />
          <button className="btn" onClick={save}>Save exercise</button>
        </div>
      )}

      {patient && <button className="btn ghost" onClick={goReport}>View {patient.name.split(" ")[0]}’s report</button>}
    </>
  );
}
