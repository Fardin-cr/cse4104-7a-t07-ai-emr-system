import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";

const ALL_ROLES = [
  { id: "admin",        label: "Administration" },
  { id: "doctor",       label: "Doctor" },
  { id: "technician",   label: "Technician" },
  { id: "receptionist", label: "Receptionist" },
];

export default function Settings() {
  const { user, changePassword, verifyMasterCode, updateMasterCode, getAuditLog } = useApp();
  const isAdmin = user?.role === "admin";

  const [tab, setTab]       = useState("passwords");
  const [target, setTarget] = useState(isAdmin ? "doctor" : user?.role || "doctor");
  const [newPass, setNew]   = useState("");
  const [confirm, setCon]   = useState("");
  const [success, setSucc]  = useState("");
  const [error, setErr]     = useState("");

  // Emergency reset
  const [emgCode, setEmgCode] = useState("");
  const [emgNew, setEmgNew]   = useState("");
  const [emgCon, setEmgCon]   = useState("");
  const [emgErr, setEmgErr]   = useState("");
  const [emgSucc, setEmgSucc] = useState("");

  // Master code update (admin only)
  const [mcCurrent, setMcCurrent] = useState("");
  const [mcNew, setMcNew]         = useState("");
  const [mcCon, setMcCon]         = useState("");
  const [mcErr, setMcErr]         = useState("");
  const [mcSucc, setMcSucc]       = useState("");

  // Audit log
  const [auditLog, setAuditLog]   = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (tab === "audit" && isAdmin) {
      setAuditLoading(true);
      getAuditLog(200).then(data => { setAuditLog(data); setAuditLoading(false); }).catch(() => setAuditLoading(false));
    }
  }, [tab]);

  const handleChange = async () => {
    setErr(""); setSucc("");
    if (!newPass)           return setErr("Password cannot be empty.");
    if (newPass.length < 6) return setErr("Password must be at least 6 characters.");
    if (newPass !== confirm) return setErr("Passwords do not match.");
    // Non-admin can only change their own role's password
    if (!isAdmin && target !== user.role) return setErr("You can only change your own password.");
    try {
      await changePassword(target, newPass, user.role);
      setSucc(`${ALL_ROLES.find(r => r.id === target)?.label} password updated.`);
      setNew(""); setCon("");
    } catch (e) { setErr(e.message); }
  };

  const handleEmergency = async () => {
    setEmgErr(""); setEmgSucc("");
    if (!emgNew)            return setEmgErr("New password cannot be empty.");
    if (emgNew.length < 6)  return setEmgErr("Password must be at least 6 characters.");
    if (emgNew !== emgCon)  return setEmgErr("Passwords do not match.");
    const res = await verifyMasterCode(emgCode, emgNew);
    if (res.success) { setEmgSucc("Doctor password reset via master code."); setEmgCode(""); setEmgNew(""); setEmgCon(""); }
    else setEmgErr(res.error || "Invalid master code.");
  };

  const handleMasterCodeUpdate = async () => {
    setMcErr(""); setMcSucc("");
    if (!mcNew)           return setMcErr("New code cannot be empty.");
    if (mcNew.length < 8) return setMcErr("Master code must be at least 8 characters.");
    if (mcNew !== mcCon)  return setMcErr("Codes do not match.");
    const res = await updateMasterCode(mcCurrent, mcNew);
    if (res.success) { setMcSucc("Master code updated successfully."); setMcCurrent(""); setMcNew(""); setMcCon(""); }
    else setMcErr(res.error || "Failed to update master code.");
  };

  const TABS = [
    { id: "passwords", label: "Passwords" },
    ...(isAdmin ? [{ id: "master",  label: "Master Code" }] : []),
    ...(isAdmin ? [{ id: "audit",   label: "Audit Log" }]   : []),
    { id: "system",   label: "System" },
  ];

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Settings</h1>
        <p style={{ color: "#64748B", fontSize: 13 }}>Security and system configuration</p>
      </div>

      <div className="tabs">
        {TABS.map(({ id, label }) => (
          <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── PASSWORDS ─────────────────────────────────────────────────────── */}
      {tab === "passwords" && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div style={{ fontWeight: 700, fontSize: 15 }}>Change Password</div>
            </div>
            <div className="card-body">
              {error   && <div className="alert alert-red">{error}</div>}
              {success && <div className="alert alert-green">{success}</div>}

              {/* Role selector — admin sees all; others see only their own */}
              <div className="form-group">
                <label className="form-label">Select Role</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {ALL_ROLES.filter(r => isAdmin || r.id === user?.role).map(r => (
                    <button key={r.id} onClick={() => setTarget(r.id)} style={{
                      flex: 1, minWidth: 100, padding: "10px 8px", borderRadius: 10, border: "1px solid",
                      borderColor: target === r.id ? "#4F46E5" : "#E4E8F0",
                      background: target === r.id ? "#EEF2FF" : "#F8F9FC",
                      cursor: "pointer", textAlign: "center",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: target === r.id ? "#4F46E5" : "#475569" }}>{r.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="input" type="password" value={newPass} onChange={e => setNew(e.target.value)} placeholder="Min 6 characters" />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input className="input" type="password" value={confirm} onChange={e => setCon(e.target.value)} placeholder="Repeat password" />
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleChange}>Update Password</button>
            </div>
          </div>

          <div className="card" style={{ borderTop: "2px solid #DC2626" }}>
            <div className="card-header">
              <div style={{ fontWeight: 700, fontSize: 15 }}>Emergency Doctor Reset</div>
              <span className="badge badge-red">Emergency Only</span>
            </div>
            <div className="card-body">
              {emgErr  && <div className="alert alert-red">{emgErr}</div>}
              {emgSucc && <div className="alert alert-green">{emgSucc}</div>}
              <div className="alert alert-amber">Use master backup code to reset Doctor password if locked out.</div>
              <div className="form-group">
                <label className="form-label">Master Backup Code</label>
                <input className="input" type="password" value={emgCode} onChange={e => setEmgCode(e.target.value)} placeholder="Enter master code" />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">New Doctor Password</label>
                  <input className="input" type="password" value={emgNew} onChange={e => setEmgNew(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm</label>
                  <input className="input" type="password" value={emgCon} onChange={e => setEmgCon(e.target.value)} />
                </div>
              </div>
              <button className="btn btn-danger" onClick={handleEmergency}>Reset Doctor Password</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MASTER CODE (admin only) ──────────────────────────────────────── */}
      {tab === "master" && isAdmin && (
        <div className="card">
          <div className="card-header">
            <div style={{ fontWeight: 700, fontSize: 15 }}>Update Master Backup Code</div>
          </div>
          <div className="card-body">
            {mcErr  && <div className="alert alert-red">{mcErr}</div>}
            {mcSucc && <div className="alert alert-green">{mcSucc}</div>}
            <div className="alert alert-amber">
              The master backup code is used for emergency doctor password reset. Keep it secret. Min 8 characters.
            </div>
            <div className="form-group">
              <label className="form-label">Current Master Code</label>
              <input className="input" type="password" value={mcCurrent} onChange={e => setMcCurrent(e.target.value)} placeholder="Current master code" />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">New Master Code</label>
                <input className="input" type="password" value={mcNew} onChange={e => setMcNew(e.target.value)} placeholder="Min 8 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Code</label>
                <input className="input" type="password" value={mcCon} onChange={e => setMcCon(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleMasterCodeUpdate}>Update Master Code</button>
          </div>
        </div>
      )}

      {/* ── AUDIT LOG (admin only) ────────────────────────────────────────── */}
      {tab === "audit" && isAdmin && (
        <div className="card">
          <div className="card-header">
            <div style={{ fontWeight: 700, fontSize: 15 }}>Audit Log</div>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setAuditLoading(true);
              getAuditLog(200).then(data => { setAuditLog(data); setAuditLoading(false); });
            }}>Refresh</button>
          </div>
          <div style={{ maxHeight: 500, overflowY: "auto" }}>
            {auditLoading ? (
              <div className="empty-state"><p>Loading...</p></div>
            ) : auditLog.length === 0 ? (
              <div className="empty-state"><p>No audit events</p></div>
            ) : auditLog.map(entry => (
              <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "160px 100px 1fr", gap: 12, padding: "10px 20px", borderBottom: "1px solid #F1F5F9", fontSize: 12 }}>
                <div style={{ color: "#64748B" }}>{entry.timestamp?.substring(0, 19).replace("T", " ")}</div>
                <div>
                  <span className="badge badge-blue" style={{ fontSize: 10 }}>{entry.role || "—"}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 600, color: "#0F172A" }}>{entry.action}</span>
                  {entry.detail && <span style={{ color: "#64748B" }}> — {entry.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SYSTEM ────────────────────────────────────────────────────────── */}
      {tab === "system" && (
        <div className="card">
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
              {[
                ["Institution",     "Nashman Institute"],
                ["System",          "Nashman EMR v2.0"],
                ["Frontend",        "React"],
                ["Backend",         "Python FastAPI"],
                ["Database",        "SQLite (local)"],
                ["AI Engine",       "Claude Sonnet/Haiku (Anthropic)"],
                ["PDF Extraction",  "pdfplumber + Claude Vision"],
                ["Scanned PDFs",    "pdf2image + pypdfium2 + Claude Vision"],
                ["Imaging",         "X-Ray, CT, MRI, Ultrasound"],
                ["API Docs",        (window.location.hostname === "localhost" ? "http://localhost:8000/docs" : "https://nashman-prod-production.up.railway.app/docs")],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}