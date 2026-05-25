import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import RegisterPatient from "../components/RegisterPatient";
import PatientDetail from "./PatientDetail";

export default function Patients() {
  const { patients, deletePatient, loading, user } = useApp();
  const canDelete = user?.role === "doctor" || user?.role === "admin";
  const [search, setSearch]   = useState("");
  const [showReg, setShowReg] = useState(false);
  const [selected, setSelected] = useState(() => sessionStorage.getItem("emr_selected_patient") || null);
  const [showDel, setShowDel] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const selectPatient = (id) => { setSelected(id); if(id) sessionStorage.setItem("emr_selected_patient", id); else sessionStorage.removeItem("emr_selected_patient"); };
  if (selected) return <PatientDetail patientId={selected} onBack={() => selectPatient(null)} />;

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    const matchesBasic =
      p.name?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q) ||
      p.phone?.includes(search) ||
      p.doctor?.toLowerCase().includes(q);
    const matchesLabId = p.reports?.some(r =>
      r.labId?.toLowerCase().includes(q) || r.lab_id?.toLowerCase().includes(q)
    );
    return matchesBasic || matchesLabId;
  });

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setImportMsg("");
    try {
      const res = await importFromExcel(file);
      setImportMsg(`✓ Imported: ${res.patient_name} → ${res.new_emr_id}`);
    } catch (err) {
      setImportMsg(`⚠ ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Patients</h1>
          <p style={{ color: "#64748B", fontSize: 13 }}>{patients.length} registered patients</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
            {importing ? "Importing..." : "⬆ Import Excel"}
            <input type="file" accept=".xlsx,.csv" style={{ display: "none" }} onChange={handleImport} />
          </label>
          <button className="btn btn-primary" onClick={() => setShowReg(true)}>+ Register Patient</button>
        </div>
      </div>

      {importMsg && (
        <div className={`alert ${importMsg.startsWith("✓") ? "alert-green" : "alert-amber"}`} style={{ marginBottom: 16 }}>
          {importMsg}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "14px 20px" }}>
          <div className="search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, EMR ID, phone, doctor or Lab ID..." />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state"><p>Loading patients...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <h3>{search ? "No patients found" : "No patients registered"}</h3>
            <p>{search ? "Try a different search term." : "Register your first patient to get started."}</p>
          </div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr 80px", padding: "10px 20px", background: "#F8F9FC", borderBottom: "1px solid #E4E8F0" }}>
              {["Patient","EMR ID","Age / Sex","Blood","Doctor","Actions"].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</div>
              ))}
            </div>
            {filtered.map(p => {
              const totalReports = p.reports?.length || 0;
              const totalAbn = p.reports?.reduce((a,r) => a + (r.values?.filter(v => v.abnormal).length || 0), 0) || 0;
              return (
                <div key={p.id}
                  style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr 80px", padding: "13px 20px", borderBottom: "1px solid #F1F5F9", alignItems: "center", cursor: "pointer", transition: "background 0.12s" }}
                  onClick={() => selectPatient(p.id)}
                  onMouseEnter={e => e.currentTarget.style.background = "#F8F9FC"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="patient-avatar">{p.name?.charAt(0)}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                      <div style={{ display: "flex", gap: 5, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: "#64748B" }}>{totalReports} report{totalReports !== 1 ? "s" : ""}</span>
                        {totalAbn > 0 && <span className="badge badge-red" style={{ fontSize: 9 }}>⚠ {totalAbn}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span
                      className="badge badge-blue"
                      style={{ fontFamily:"monospace", fontSize:11, cursor:"pointer", userSelect:"none" }}
                      title="Click to copy EMR ID"
                      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(p.id); const el = e.currentTarget; el.textContent="Copied!"; setTimeout(() => el.textContent=p.id, 1500); }}
                    >{p.id}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569" }}>{p.age}y · {p.sex}</div>
                  <div>{p.blood && <span className="badge badge-red">🩸 {p.blood}</span>}</div>
                  <div style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.doctor || "—"}</div>
                  <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-icon btn-ghost" onClick={() => selectPatient(p.id)} title="View">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    {canDelete && (
                      <button className="btn btn-icon btn-danger" onClick={() => setShowDel(p.id)} title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showReg && <RegisterPatient onClose={() => setShowReg(false)} onDone={(id) => { setShowReg(false); selectPatient(id); }} />}

      {showDel && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header"><div style={{ fontWeight: 700, fontSize: 16 }}>Delete Patient</div></div>
            <div className="modal-body">
              <div className="alert alert-red">This will permanently delete the patient and all their reports. This action cannot be undone.</div>
              <div style={{ fontSize: 13 }}>Patient: <b>{patients.find(p => p.id === showDel)?.name}</b></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowDel(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { deletePatient(showDel); setShowDel(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}