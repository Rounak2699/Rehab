export default function BottomNav({ tabs, active, onChange }) {
  return (
    <nav className="nav">
      <div>
        {tabs.map(([id, label]) => (
          <button key={id} className={active === id ? "on" : ""} onClick={() => onChange(id)}>{label}</button>
        ))}
      </div>
    </nav>
  );
}
