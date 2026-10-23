import { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import TopBar from "../../components/ui/TopBar.jsx";
import BottomNav from "../../components/ui/BottomNav.jsx";
import Prescribe from "./Prescribe.jsx";
import Report from "./Report.jsx";
import PatientRegistration from "./PatientRegistration.jsx";

export default function DoctorApp() {
  const { db } = useApp();
  const [tab, setTab] = useState("rx");
  const [selId, setSelId] = useState(db.patients[0]?.id || null);
  const selectedPatientId = db.patients.some((patient) => patient.id === selId)
    ? selId
    : db.patients[0]?.id || null;

  return (
    <div className="app">
      <TopBar label="Doctor" />
      {tab === "rx" ? (
        <Prescribe selId={selectedPatientId} setSelId={setSelId} goReport={() => setTab("report")} />
      ) : tab === "register" ? (
        <PatientRegistration onRegistered={setSelId} />
      ) : (
        <Report selId={selectedPatientId} setSelId={setSelId} />
      )}
      <BottomNav tabs={[["rx", "Prescriptions"], ["register", "Register"], ["report", "Reports"]]} active={tab} onChange={setTab} />
    </div>
  );
}
