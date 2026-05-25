import { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";

const BASE = process.env.REACT_APP_API_URL || (window.location.hostname === "localhost" ? "http://localhost:8000" : "https://nashman-prod-production.up.railway.app");

const REPORT_TYPES = ["Hematology", "Hormone", "Immunology", "Biochemical"];

const StatusBadge = ({ status }) => {
  const map = {
    "Normal":       { bg: "#DCFCE7", color: "#15803D" },
    "High":         { bg: "#FEF3C7", color: "#B45309" },
    "Low":          { bg: "#DBEAFE", color: "#1D4ED8" },
    "Critical High":{ bg: "#FEE2E2", color: "#B91C1C" },
    "Critical Low": { bg: "#FEE2E2", color: "#B91C1C" },
    "Abnormal":     { bg: "#FEF3C7", color: "#92400E" },
    "Needs Review": { bg: "#F1F5F9", color: "#475569" },
  };
  const s = map[status] || map["Needs Review"];
  return (
    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {status || "Needs Review"}
    </span>
  );
};

export default function UploadReport({ patient, onClose, onDone }) {
  const { addReport, editReport, user } = useApp();
  const [form, setForm] = useState({
    type: "Hematology", lab: "Nashman Institute", labId: "",
    date: new Date().toISOString().split("T")[0], time: "",
  });
  const [file, setFile]         = useState(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [extractedReport, setExtracted] = useState(null);
  const [editVals, setEditVals] = useState([]);

  // Lab ID duplicate check state
  const [labIdStatus, setLabIdStatus] = useState(null); // null | "checking" | "duplicate" | "ok"
  const [labIdInfo, setLabIdInfo]     = useState(null); // { patientName, reportId }
  const debounceRef = useRef(null);

  // Real-time lab ID check — debounced 500ms
  useEffect(() => {
    if (!form.labId.trim()) { setLabIdStatus(null); setLabIdInfo(null); return; }
    setLabIdStatus("checking");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}/reports/check-lab-id?lab_id=${encodeURIComponent(form.labId.trim())}`);
        const data = await res.json();
        if (data.exists) {
          setLabIdStatus("duplicate");
          setLabIdInfo({ patientName: data.patient_name, reportId: data.report_id, patientId: data.patient_id });
        } else {
          setLabIdStatus("ok");
          setLabIdInfo(null);
        }
      } catch {
        setLabIdStatus(null); // silently fail — don't block user
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [form.labId]);

  const handleFile = (f) => { if (f) setFile(f); };

  const extract = async () => {
    if (!file) return;
    if (labIdStatus === "duplicate") {
      setError(`Lab ID "${form.labId}" already exists. Please use a different Lab ID.`);
      return;
    }
    setLoading(true); setError("");
    try {
      const result = await addReport(patient.id, {
        file, type: form.type,
        lab: form.lab || "Nashman Institute",
        labId: form.labId,
        date: form.date, time: form.time, patientSex: patient.sex || "Female",
      });
      setExtracted(result.report);
      setEditVals(result.report.values.map(v => ({ ...v })));
      if (result.extractionError) setError(`Note: ${result.extractionError}`);
      setStep(2);
    } catch (e) {
      setError(e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const updateVal = (i, field, val) => {
    setEditVals(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      if (field === "value") {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          const isHigh = num > next[i].refMax;
          const isLow  = num < next[i].refMin;
          next[i].abnormal = isHigh || isLow;
          next[i].status = isHigh ? "High" : isLow ? "Low" : "Normal";
        }
      }
      return next;
    });
  };

  const saveAndDone = async () => {
    if (!extractedReport) return onDone();
    try {
      setLoading(true);
      await editReport(
        patient.id,
        extractedReport.id,
        editVals,
        user?.role === "doctor" || user?.role === "technician" || user?.role === "admin"
          ? user.role : "technician"
      );
      onDone();
    } catch (e) {
      setError(e.message || "Could not save edited values");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Upload Test Report</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>{patient.name} · {patient.id}</div>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Steps */}
        <div style={{ padding: "10px 24px 0", display: "flex", gap: 6 }}>
          {["Upload & Extract", "Review Values"].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: i + 1 <= step ? "#4F46E5" : "#E4E8F0", color: i + 1 <= step ? "#fff" : "#94A3B8", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: i + 1 <= step ? "#4F46E5" : "#94A3B8" }}>{s}</div>
              {i < 1 && <div style={{ flex: 1, height: 2, background: step > 1 ? "#4F46E5" : "#E4E8F0", borderRadius: 99 }} />}
            </div>
          ))}
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-amber">{error}</div>}

          {step === 1 && (
            <div>
              <div className="form-grid-2" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Report Type</label>
                  <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {REPORT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Lab / Institute Name</label>
                  <input className="input" value={form.lab} onChange={e => setForm(f => ({ ...f, lab: e.target.value }))} placeholder="Nashman Institute" />
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>Auto-detected from report; override if needed</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Lab Report ID</label>
                  <input
                    className={`input ${labIdStatus === "duplicate" ? "input-error" : ""}`}
                    value={form.labId}
                    onChange={e => setForm(f => ({ ...f, labId: e.target.value }))}
                    placeholder="Auto-detected or enter manually"
                  />
                  {/* Real-time lab ID feedback */}
                  {labIdStatus === "checking" && (
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>Checking...</div>
                  )}
                  {labIdStatus === "duplicate" && labIdInfo && (
                    <div style={{ fontSize: 11, color: "#DC2626", marginTop: 3, fontWeight: 600 }}>
                      ⚠ Already exists — report {labIdInfo.reportId} for patient {labIdInfo.patientId} ({labIdInfo.patientName})
                    </div>
                  )}
                  {labIdStatus === "ok" && (
                    <div style={{ fontSize: 11, color: "#16A34A", marginTop: 3 }}>✓ Lab ID is available</div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Test Date</label>
                  <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              <div
                className={`upload-area ${dragging ? "dragging" : ""}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => document.getElementById("pdf-input").click()}
              >
                <input id="pdf-input" type="file" accept=".pdf,image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
                {file ? (
                  <div>
                    <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#4F46E5" }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB · <strong style={{ color: "#4F46E5" }}>Click to change</strong></div>
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A", marginBottom: 4 }}>Drop PDF or image here</div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>Supports PDF (digital &amp; scanned), JPG, PNG · Max 20MB</div>
                    <div style={{ marginTop: 12 }}><span className="badge badge-blue">Click to browse</span></div>
                  </div>
                )}
              </div>

              {file && (
                <div className="alert alert-blue" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  Claude AI will extract all values automatically — including scanned PDFs. Review before saving.
                </div>
              )}
            </div>
          )}

          {step === 2 && extractedReport && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Extracted Values — {extractedReport.type}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>
                    {extractedReport.lab && <span style={{ marginRight: 10 }}>{extractedReport.lab}</span>}
                    Edit any incorrect values before saving
                  </div>
                </div>
                <span className="badge badge-amber">Editable</span>
              </div>

              {editVals.length === 0 ? (
                <div className="alert alert-amber">
                  No values were extracted automatically. This may be because the API key is not set yet. You can still save and add values manually later, or set up the API key and re-upload.
                </div>
              ) : (
                <div style={{ maxHeight: 360, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th style={{ textAlign: "center" }}>Result</th>
                        <th style={{ textAlign: "center" }}>Unit</th>
                        <th style={{ textAlign: "center" }}>Reference</th>
                        <th style={{ textAlign: "center" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editVals.map((v, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{v.name}</td>
                          <td style={{ textAlign: "center" }}>
                            <input className="input" value={v.value ?? ""} onChange={e => updateVal(i, "value", e.target.value)}
                              style={{ width: 80, textAlign: "center", padding: "5px 8px", borderColor: v.abnormal ? "#fca5a5" : undefined }} />
                          </td>
                          <td style={{ textAlign: "center", fontSize: 12, color: "#64748B" }}>{v.unit}</td>
                          <td style={{ textAlign: "center", fontSize: 12, color: "#64748B" }}>
                            {v.refMin != null && v.refMax != null ? `${v.refMin}–${v.refMax}` : "—"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <StatusBadge status={v.status || (v.abnormal ? "Abnormal" : "Normal")} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 2 && (
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {step === 1
            ? <button className="btn btn-primary" onClick={extract} disabled={!file || loading || labIdStatus === "duplicate"}>
                {loading ? "Extracting..." : (
                  <>
                    Extract Values
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </>
                )}
              </button>
            : <button className="btn btn-primary" onClick={saveAndDone} disabled={loading}>
                {loading ? "Saving..." : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Save Report
                  </>
                )}
              </button>
          }
        </div>
      </div>
    </div>
  );
}