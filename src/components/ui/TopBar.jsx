import { useApp } from "../../context/AppContext.jsx";

export default function TopBar({ label }) {
  const { logout } = useApp();
  return (
    <div className="top">
      <span className="sub" style={{ margin: 0 }}>{label}</span>
      <button className="link" onClick={logout}>Log out</button>
    </div>
  );
}
