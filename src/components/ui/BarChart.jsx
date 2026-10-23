export default function BarChart({ days, planCount }) {
  const max = Math.max(planCount, 1);
  return (
    <div className="bars" role="img" aria-label="Prescribed sessions completed per day over the last 7 days">
      {days.map((d) => (
        <div key={d.k}>
          <i className={d.done ? "" : "zero"} style={{ height: Math.max((Math.min(d.done, max) / max) * 80, 4) }} />
          {d.label}
        </div>
      ))}
    </div>
  );
}
