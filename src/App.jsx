import { useApp } from "./context/AppContext.jsx";
import Login from "./pages/Login.jsx";
import DoctorApp from "./pages/doctor/DoctorApp.jsx";
import PatientApp from "./pages/patient/PatientApp.jsx";

export default function App() {
  const { me, loading, loadError, retryDb, logout } = useApp();
  if (!me) return <Login />;
  if (loading) return <div className="app"><div className="card">Loading your ReHabRep account…</div></div>;
  if (loadError) {
    return (
      <div className="app">
        <div className="card">
          <p className="err" role="alert">{loadError}</p>
          <button className="btn" onClick={retryDb}>Retry</button>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={logout}>Log out</button>
        </div>
      </div>
    );
  }
  return me.role === "doctor" ? <DoctorApp /> : <PatientApp />;
}
