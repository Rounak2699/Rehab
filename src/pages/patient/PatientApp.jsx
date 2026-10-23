import { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { api } from "../../services/api.js";
import { dkey, summarize } from "../../utils/report.js";
import Hero from "../../components/ui/Hero.jsx";
import TopBar from "../../components/ui/TopBar.jsx";
import BottomNav from "../../components/ui/BottomNav.jsx";
import BarChart from "../../components/ui/BarChart.jsx";
import SessionRow from "../../components/ui/SessionRow.jsx";
import Session from "./Session.jsx";
import ExerciseOutline from "../../components/ui/ExerciseOutline.jsx";

export default function PatientApp() {
  const { db, me, refreshDb } = useApp();
  const patient = db.patients.find((p) => p.id === me.id);
  const today = dkey(0);
  const [tab, setTab] = useState("today");
  const [active, setActive] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [remindersEnabled, setRemindersEnabled] = useState(() => sessionStorage.getItem("rehabrep-reminders") === "enabled");
  const [reminderStatus, setReminderStatus] = useState("");
  const completedToday = new Map();
  db.sessions
    .filter((session) => session.patientId === patient.id && session.date === today)
    .forEach((session) => completedToday.set(session.exId, (completedToday.get(session.exId) || 0) + 1));
  const completedTodayRef = useRef(completedToday);
  completedTodayRef.current = completedToday;
  const completedSessions = patient.plan.reduce(
    (total, exercise) => total + Math.min(completedToday.get(exercise.id) || 0, exercise.sessionsPerDay || 1),
    0
  );

  const r = summarize(patient, db.sessions);

  useEffect(() => {
    if (!remindersEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
    const timers = [];
    patient.plan.forEach((exercise) => {
      const [hours, minutes] = (exercise.reminderTime || "09:00").split(":").map(Number);
      const next = new Date();
      next.setHours(hours, minutes, 0, 0);
      if (next <= new Date()) next.setDate(next.getDate() + 1);
      const sendReminder = () => {
        if ((completedTodayRef.current.get(exercise.id) || 0) >= (exercise.sessionsPerDay || 1)) return;
        try {
          new Notification("ReHabRep exercise reminder", {
            body: `Time for ${exercise.name}. Your plan calls for ${exercise.sessionsPerDay || 1} session(s) today.`,
            tag: `rehabrep-${exercise.id}`,
          });
        } catch (error) {
          setReminderStatus(error.message || "The reminder could not be displayed.");
        }
      };
      const timeout = window.setTimeout(() => {
        sendReminder();
        timers.push(window.setInterval(sendReminder, 24 * 60 * 60 * 1000));
      }, next.getTime() - Date.now());
      timers.push(timeout);
    });
    return () => timers.forEach((timer) => {
      window.clearTimeout(timer);
      window.clearInterval(timer);
    });
  }, [patient.plan, remindersEnabled]);

  const enableReminders = async () => {
    if (!("Notification" in window)) {
      setReminderStatus("This browser does not support notifications.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        sessionStorage.setItem("rehabrep-reminders", "enabled");
        setRemindersEnabled(true);
        setReminderStatus("Daily reminders are enabled while ReHabRep is open.");
      } else {
        setReminderStatus("Notification permission was not granted.");
      }
    } catch (error) {
      setReminderStatus(error.message || "Notification permission could not be requested.");
    }
  };

  const finish = async (exercise, result) => {
    setSaveError("");
    try {
      await api("/sessions", {
        method: "POST",
        body: JSON.stringify({ exId: exercise.id, exName: exercise.name, date: today, ...result }),
      });
      await refreshDb();
      setActive(null);
    } catch (error) {
      setSaveError(error.message);
    }
  };

  if (active) return <Session ex={active} saveError={saveError} onBack={() => setActive(null)} onFinish={(res) => finish(active, res)} />;

  return (
    <div className="app">
      <TopBar label={"Hi, " + patient.name.split(" ")[0]} />

      {tab === "today" ? (
        <>
          <Hero>Today’s exercises</Hero>
          <div className="card">
            <h3>{completedSessions} of {r.planCount} sessions done today</h3>
            <div className="prog"><i style={{ width: (r.planCount ? (completedSessions / r.planCount) * 100 : 0) + "%" }} /></div>
          </div>
          {patient.plan.length > 0 && (
            <div className="card">
              <h3>Daily reminders</h3>
              <p className="sub">Reminders appear at the prescribed time while this app is open.</p>
              <button className="btn ghost" disabled={remindersEnabled} onClick={enableReminders}>{remindersEnabled ? "Reminders enabled" : "Turn on reminders"}</button>
              {reminderStatus && <p className="sub" role="status" style={{ margin: "10px 0 0" }}>{reminderStatus}</p>}
            </div>
          )}
          {patient.plan.length === 0 && <div className="card"><p className="sub" style={{ margin: 0 }}>Your doctor hasn’t prescribed exercises yet.</p></div>}
          {patient.plan.map((e) => (
            <div className="card" key={e.id}>
              <div className="top" style={{ marginBottom: 6 }}>
                <h3 style={{ margin: 0 }}>{e.name}</h3>
                {(completedToday.get(e.id) || 0) >= (e.sessionsPerDay || 1) && <span className="tag done">Done</span>}
              </div>
              <p className="sub" style={{ marginBottom: 12 }}>
                {e.sets} sets × {e.amount} · {e.joint} angle {e.min}–{e.max}° ·
                {" "}{completedToday.get(e.id) || 0}/{e.sessionsPerDay || 1} sessions · reminder {e.reminderTime || "09:00"}
              </p>
              <ExerciseOutline exercise={e} />
              <button className={"btn" + ((completedToday.get(e.id) || 0) >= (e.sessionsPerDay || 1) ? " ghost" : "")} onClick={() => setActive(e)}>
                {(completedToday.get(e.id) || 0) >= (e.sessionsPerDay || 1) ? "Do it again" : "Start exercise"}
              </button>
            </div>
          ))}
          {saveError && <p className="err" role="alert">{saveError}</p>}
        </>
      ) : (
        <>
          <Hero>My progress</Hero>
          <div className="stats">
            <div className="stat"><b>{r.adherence}%</b><span>Plan followed this week</span></div>
            <div className="stat"><b>{r.accuracy}%</b><span>Reps in correct range</span></div>
          </div>
          <div className="card"><h3>This week</h3><BarChart days={r.days} planCount={r.planCount} /></div>
          <div className="card">
            <h3>Past sessions</h3>
            {r.mine.length === 0 && <p className="sub">Complete your first exercise to see it here.</p>}
            {[...r.mine].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((s) => <SessionRow key={s.id} s={s} />)}
          </div>
        </>
      )}

      <BottomNav tabs={[["today", "Today"], ["progress", "Progress"]]} active={tab} onChange={setTab} />
    </div>
  );
}
