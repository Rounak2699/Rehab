import { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import TopBar from "../../components/ui/TopBar.jsx";
import BottomNav from "../../components/ui/BottomNav.jsx";
import Prescribe from "./Prescribe.jsx";
import Report from "./Report.jsx";

export default function DoctorApp() {
  const { db } = useApp();
  const [tab, setTab] = useState("rx");
  const [selId, setSelId] = useState(db.patients[0]?.id || null);

  return (
    <div className="app">
      <TopBar label="Doctor" />
      {tab === "rx" ? (
        <Prescribe selId={selId} setSelId={setSelId} goReport={() => setTab("report")} />
      ) : (
        <Report selId={selId} setSelId={setSelId} />
      )}
      <BottomNav tabs={[["rx", "Prescriptions"], ["report", "Reports"]]} active={tab} onChange={setTab} />
    </div>
  );
}
