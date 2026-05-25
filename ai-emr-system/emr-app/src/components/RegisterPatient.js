import { useState } from "react";
import { useApp } from "../context/AppContext";

const BLOOD_GROUPS = ["A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown"];

// +880 is fixed prefix. User types remaining digits starting with 1XXXXXXXXX (10 digits)
// Final number: +880 + 1XXXXXXXXX = +8801XXXXXXXXX (13 chars total)
function validatePhoneDigits(digits) {
  const d = digits.trim().replace(/[\s\-()]/g, "");
  if (!d) return { valid: false, message: "Phone number is required." };
  if (!/^\d{10}$/.test(d)) return { valid: false, message: "Enter exactly 10 digits (e.g. 1712345678)." };
  if (!/^1[3-9]\d{8}$/.test(d)) return { valid: false, message: "Must start with 13–19 (e.g. 17, 18, 19, 16, 15, 13, 14)." };
  return { valid: true, normalised: "+880" + d };
}

export default function RegisterPatient({ onClose, onDone }) {
  const { addPatient } = useApp();
  const [form, setForm] = useState({
    name:"", age:"", sex:"Female", blood:"B+",
    phoneDigits:"", address:"", doctor:"", emergency_contact:"", notes:""
  });
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});
  const [error, setError]     = useState("");

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: null }));
  };

  const validateStep1 = () => {
    const errs = {};
    if (!form.name.trim())   errs.name = "Full name is required.";
    if (!form.age)           errs.age  = "Age is required.";
    const ageN = parseInt(form.age);
    if (isNaN(ageN) || ageN < 0 || ageN > 150) errs.age = "Age must be between 0 and 150.";
    const phoneResult = validatePhoneDigits(form.phoneDigits);
    if (!phoneResult.valid) errs.phoneDigits = phoneResult.message;
    if (!form.address.trim()) errs.address = "Address is required.";
    return errs;
  };

  const validateStep2 = () => {
    const errs = {};
    if (!form.doctor.trim()) errs.doctor = "Referred doctor is required.";
    return errs;
  };

  const goNext = () => {
    const errs = validateStep1();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep(2);
  };

  const submit = async () => {
    const step2Errs = validateStep2();
    if (Object.keys(step2Errs).length) { setErrors(step2Errs); return; }
    setLoading(true); setError("");
    try {
      const phoneResult = validatePhoneDigits(form.phoneDigits);
      const phone = phoneResult.valid ? phoneResult.normalised : "";
      const id = await addPatient({ ...form, phone, age: parseInt(form.age) });
      onDone(id);
    } catch (e) {
      setError(e.message || "Registration failed");
      setLoading(false);
    }
  };

  const phoneResult = validatePhoneDigits(form.phoneDigits);
  const phonePreview = phoneResult.valid ? phoneResult.normalised : (form.phoneDigits ? `+880${form.phoneDigits}` : "+880__________");

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div>
            <div style={{ fontWeight:700, fontSize:16 }}>Register New Patient</div>
            <div style={{ fontSize:12, color:"#64748B" }}>Step {step} of 2</div>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding:"10px 24px 0", display:"flex", gap:6 }}>
          {[1,2].map(s => (
            <div key={s} style={{ flex:1, height:3, borderRadius:99, background: s<=step ? "#4F46E5" : "#E4E8F0", transition:"background 0.2s" }}/>
          ))}
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-red">{error}</div>}

          {step === 1 && (
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#475569", marginBottom:16, textTransform:"uppercase", letterSpacing:"0.5px" }}>Personal Information</div>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className={`input ${errors.name ? "input-error" : ""}`} value={form.name} onChange={e => set("name",e.target.value)} placeholder="Patient's full name" autoFocus />
                {errors.name && <div style={{ color:"#DC2626", fontSize:12, marginTop:3 }}>{errors.name}</div>}
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Age *</label>
                  <input className={`input ${errors.age ? "input-error" : ""}`} type="number" value={form.age} onChange={e => set("age",e.target.value)} placeholder="Years" min="0" max="150" />
                  {errors.age && <div style={{ color:"#DC2626", fontSize:12, marginTop:3 }}>{errors.age}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Sex *</label>
                  <select className="select" value={form.sex} onChange={e => set("sex",e.target.value)}>
                    <option>Female</option><option>Male</option><option>Other</option>
                  </select>
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select className="select" value={form.blood} onChange={e => set("blood",e.target.value)}>
                    {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <div style={{ display:"flex", alignItems:"stretch" }}>
                    <span style={{
                      padding:"0 10px", display:"flex", alignItems:"center",
                      background:"#F1F5F9", border:"1px solid #E4E8F0", borderRight:"none",
                      borderRadius:"6px 0 0 6px", fontSize:13, fontWeight:700, color:"#475569",
                      whiteSpace:"nowrap", flexShrink:0, letterSpacing:"0.5px"
                    }}>+880</span>
                    <input
                      className={`input ${errors.phoneDigits ? "input-error" : ""}`}
                      style={{ borderRadius:"0 6px 6px 0", borderLeft:"none", flex:1 }}
                      value={form.phoneDigits}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                        set("phoneDigits", val);
                      }}
                      placeholder="1712345678"
                      maxLength={10}
                      inputMode="numeric"
                    />
                  </div>
                  {errors.phoneDigits
                    ? <div style={{ color:"#DC2626", fontSize:12, marginTop:3 }}>{errors.phoneDigits}</div>
                    : <div style={{ fontSize:11, marginTop:3, color: phoneResult.valid ? "#16A34A" : "#94A3B8" }}>
                        {phoneResult.valid
                          ? `✓ ${phoneResult.normalised}`
                          : form.phoneDigits.length > 0
                            ? `${form.phoneDigits.length}/10 digits`
                            : "10 digits starting with 1 — e.g. 1712345678"}
                      </div>
                  }
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address *</label>
                <input className={"input " + (errors.address ? "input-error" : "")} value={form.address} onChange={e => set("address",e.target.value)} placeholder="Full address" />
                {errors.address && <div style={{ color:"#DC2626", fontSize:12, marginTop:3 }}>{errors.address}</div>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#475569", marginBottom:16, textTransform:"uppercase", letterSpacing:"0.5px" }}>Medical Information</div>
              <div className="form-group">
                <label className="form-label">Referred Doctor *</label>
                <input className={"input " + (errors.doctor ? "input-error" : "")} value={form.doctor} onChange={e => set("doctor",e.target.value)} placeholder="Dr. Name (MBBS)" />
                {errors.doctor && <div style={{ color:"#DC2626", fontSize:12, marginTop:3 }}>{errors.doctor}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Emergency Contact</label>
                <input className="input" value={form.emergency_contact} onChange={e => set("emergency_contact",e.target.value)} placeholder="Name — Phone" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes / Known Conditions</label>
                <textarea className="input" value={form.notes} onChange={e => set("notes",e.target.value)} placeholder="Diabetes, Hypertension..." rows={3} style={{ resize:"vertical" }}/>
              </div>

              <div style={{ background:"#F8F9FC", border:"1px solid #E4E8F0", borderRadius:10, padding:"14px 16px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:10 }}>Preview</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 20px", fontSize:13 }}>
                  {[["Name",form.name],["Age",form.age+" yrs"],["Sex",form.sex],["Blood",form.blood],["Phone",phonePreview]].map(([l,v]) => (
                    <div key={l} style={{ display:"flex", gap:6 }}>
                      <span style={{ color:"#94A3B8", minWidth:50 }}>{l}:</span>
                      <span style={{ fontWeight:600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 2 && <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {step === 1
            ? <button className="btn btn-primary" onClick={goNext}>Next →</button>
            : <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? "Registering..." : "Register Patient"}</button>
          }
        </div>
      </div>
    </div>
  );
}