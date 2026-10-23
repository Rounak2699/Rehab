/** YYYY-MM-DD for today minus `offset` days */
export const dkey = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
};

/** "10 reps" -> 10 */
export const num = (s) => parseInt(String(s), 10) || 10;

/** Shared by the doctor report page and the patient progress tab. */
export function summarize(patient, sessions) {
  const mine = sessions.filter((s) => s.patientId === patient.id);
  const planCount = patient.plan.reduce((total, exercise) => total + (exercise.sessionsPerDay || 1), 0);
  const days = [6, 5, 4, 3, 2, 1, 0].map((o) => {
    const k = dkey(o);
    const scheduled = mine.filter((s) => s.date === k);
    const done = patient.plan.reduce((total, exercise) => {
      const completed = scheduled.filter((session) => session.exId === exercise.id).length;
      return total + Math.min(completed, exercise.sessionsPerDay || 1);
    }, 0);
    return {
      k,
      label: new Date(k + "T00:00").toLocaleDateString("en", { weekday: "short" }),
      done,
    };
  });
  const planned = Math.max(planCount * 7, 1);
  const completed = days.reduce((total, day) => total + day.done, 0);
  const adherence = Math.min(100, Math.round((completed / planned) * 100));
  const reps = mine.reduce((a, s) => a + s.reps, 0);
  const correct = mine.reduce((a, s) => a + s.correct, 0);
  const accuracy = reps ? Math.round((correct / reps) * 100) : 0;
  return { mine, days, adherence, reps, accuracy, sessionCount: mine.length, planCount };
}
