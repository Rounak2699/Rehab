import { useApp } from "../../context/AppContext.jsx";
import { summarize } from "../../utils/report.js";
import Hero from "../../components/ui/Hero.jsx";
import BarChart from "../../components/ui/BarChart.jsx";
import SessionRow from "../../components/ui/SessionRow.jsx";
import ExerciseOutline from "../../components/ui/ExerciseOutline.jsx";

export default function Report({ selId, setSelId }) {
  const { db } = useApp();
  const patient = db.patients.find((p) => p.id === selId) || db.patients[0];
  const r = summarize(patient, db.sessions);

  const byExercise = patient.plan.map((e) => {
    const s = r.mine.filter((x) => x.exId === e.id);
    const reps = s.reduce((a, x) => a + x.reps, 0);
    const correct = s.reduce((a, x) => a + x.correct, 0);
    return { e, acc: reps ? Math.round((correct / reps) * 100) : null };
  });
  const recent = [...r.mine].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <>
      <Hero>Patient report</Hero>

      <div className="card">
        <label htmlFor="rp" style={{ marginTop: 0, fontSize: 15 }}>Patient</label>
        <select id="rp" value={patient.id} onChange={(e) => setSelId(e.target.value)}>
          {db.patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {patient.note && <p className="sub" style={{ margin: "10px 0 0" }}>{patient.note}</p>}
      </div>

      <div className="stats">
        <div className="stat"><b>{r.adherence}%</b><span>Plan followed, last 7 days</span></div>
        <div className="stat"><b>{r.accuracy}%</b><span>Reps in correct range</span></div>
        <div className="stat"><b>{r.reps}</b><span>Total reps counted</span></div>
        <div className="stat"><b>{r.sessionCount}</b><span>Sessions completed</span></div>
      </div>

      <div className="card">
        <h3>Daily adherence</h3>
        <BarChart days={r.days} planCount={r.planCount} />
      </div>

      <div className="card">
        <h3>By exercise</h3>
        {byExercise.length === 0 && <p className="sub">No exercises prescribed yet.</p>}
        {byExercise.map(({ e, acc }) => (
          <div className="item" key={e.id}>
            <div style={{ flex: 1 }}>
              {e.name}<small>{e.sets} sets × {e.amount} · {e.min}–{e.max}° · {e.sessionsPerDay || 1} session(s)/day</small>
              <ExerciseOutline exercise={e} compact />
            </div>
            <span className={"tag" + (acc !== null && acc < 70 ? " warn" : "")}>{acc === null ? "No sessions" : acc + "% correct"}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Recent sessions</h3>
        {recent.length === 0 && <p className="sub">No sessions yet. Reports appear after the patient exercises at home.</p>}
        {recent.map((s) => <SessionRow key={s.id} s={s} />)}
      </div>
    </>
  );
}
