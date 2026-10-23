export default function SessionRow({ s, showDate = true }) {
  const date = new Date(s.date + "T00:00").toLocaleDateString("en", { day: "numeric", month: "short" });
  const incomplete = s.reps < s.target;
  return (
    <div className="item">
      <div>
        {s.exName}
        <small>
          {showDate ? date + " · " : ""}{s.correct}/{s.reps} correct
          {s.angleMin != null && s.angleMax != null ? ` · angle ${s.angleMin}–${s.angleMax}°` : ""}
          {s.issue ? " · " + s.issue : ""}
        </small>
      </div>
      <span className={"tag" + (incomplete ? " warn" : " done")}>{incomplete ? "Incomplete" : "Complete"}</span>
    </div>
  );
}
