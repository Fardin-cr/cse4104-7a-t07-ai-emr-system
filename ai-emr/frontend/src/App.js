import { useState } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import Login from "./pages/Login";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import LabReports from "./pages/LabReports";
import Settings from "./pages/Settings";
import "./index.css";

// Role-based page access — Admin and Doctor only
const ROLE_PAGES = {
  admin:  ["dashboard", "patients", "reports", "settings"],
  doctor: ["dashboard", "patients", "reports"],
};

function Shell() {
  const { user, backendOk } = useApp();
  const [active, setActive] = useState(
    () => sessionStorage.getItem("emr_active_page") || "dashboard"
  );
  const [selectedPatient, setSelectedPatient] = useState(
    () => sessionStorage.getItem("emr_selected_patient") || null
  );

  if (!user) return <Login />;

  const allowed = ROLE_PAGES[user.role] || ["dashboard"];

  const handleSetActive = (page) => {
    if (!allowed.includes(page)) return;
    setActive(page);
    sessionStorage.setItem("emr_active_page", page);
    if (page !== "patients") {
      setSelectedPatient(null);
      sessionStorage.removeItem("emr_selected_patient");
    }
  };

  const handleSetSelectedPatient = (id) => {
    setSelectedPatient(id);
    if (id) sessionStorage.setItem("emr_selected_patient", id);
    else sessionStorage.removeItem("emr_selected_patient");
  };

  const safeActive = allowed.includes(active) ? active : "dashboard";

  return (
    <div className="app-shell">
      <Sidebar active={safeActive} setActive={handleSetActive} />
      <div className="main-content">

        {/* Topbar */}
        <div className="topbar">
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", textTransform: "capitalize" }}>
              {safeActive === "reports" ? "Lab Register" : safeActive}
            </div>
            {backendOk === false && (
              <span className="badge badge-red">Backend offline</span>
            )}
            {backendOk === true && (
              <span className="badge badge-green" style={{ fontSize: 10 }}>● Live</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long", year: "numeric", month: "long", day: "numeric"
            })}
          </div>
        </div>

        {/* Page body */}
        <div className="page-body">
          {safeActive === "dashboard" && (
            <Dashboard
              setActive={handleSetActive}
              setSelectedPatient={handleSetSelectedPatient}
            />
          )}
          {safeActive === "patients" && (
            <Patients
              selectedPatient={selectedPatient}
              setSelectedPatient={handleSetSelectedPatient}
            />
          )}
          {safeActive === "reports" && <LabReports />}
          {safeActive === "settings" && user.role === "admin" && <Settings />}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
