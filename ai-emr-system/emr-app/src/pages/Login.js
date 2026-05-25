import { useState } from "react";
import { useApp } from "../context/AppContext";

const NashmanLogo = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="100" fill="#0F172A"/>
    <path d="M100 52 C84 63 62 68 42 65 C53 79 70 84 86 80 C76 89 65 100 59 113 C72 108 84 99 91 88 C93 94 95 101 96 108 L100 117 L104 108 C105 101 107 94 109 88 C116 99 128 108 141 113 C135 100 124 89 114 80 C130 84 147 79 158 65 C138 68 116 63 100 52Z" fill="white"/>
    <ellipse cx="100" cy="49" rx="6" ry="7" fill="white"/>
    <path d="M87 120 C83 126 83 133 87 139 C83 145 83 151 87 157 C83 163 83 169 87 175" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
    <path d="M113 120 C117 126 117 133 113 139 C117 145 117 151 113 157 C117 163 117 169 113 175" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
    <line x1="87" y1="126" x2="113" y2="126" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="87" y1="136" x2="113" y2="136" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="87" y1="145" x2="113" y2="145" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="87" y1="154" x2="113" y2="154" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="87" y1="163" x2="113" y2="163" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="87" y1="172" x2="113" y2="172" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

// Roles for quick access — Admin and Doctor only
const ROLES = [
  { id: "admin",  label: "Admin",  user: "admin",  pass: "admin123" },
  { id: "doctor", label: "Doctor", user: "doctor", pass: "doc123"   },
];

export default function Login() {
  const { login, backendOk } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await login(username.trim(), password);
    if (!res.success) setError(res.error || "Invalid username or password.");
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div style={{ width: 460 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 12 }}>
            <NashmanLogo size={60} />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 21, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.3px", lineHeight: 1.1 }}>
                NASHMAN INSTITUTE
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#64748B", letterSpacing: "1.8px", textTransform: "uppercase", marginTop: 4 }}>
                Pathology &amp; Regenerative Medicine
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginTop: 6 }}>
            <div style={{ height: 1, width: 60, background: "#E2E8F0" }} />
            <span style={{ fontSize: 11, color: "#94A3B8", letterSpacing: "0.5px" }}>EMR System</span>
            <div style={{ height: 1, width: 60, background: "#E2E8F0" }} />
          </div>
        </div>

        {backendOk === false && (
          <div className="alert alert-red" style={{ marginBottom: 16, display: "flex", alignItems: "center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 7, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Cannot connect to backend. Make sure the Python server is running on port 8000.
          </div>
        )}
        {backendOk === true && (
          <div className="alert alert-green" style={{ marginBottom: 16, display: "flex", alignItems: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 7 }}><polyline points="20 6 9 17 4 12"/></svg>
            Backend connected
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 4px 24px rgba(15,23,42,0.07)", padding: 32, marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 22, textAlign: "center" }}>
            Sign in to your account
          </h2>

          {error && (
            <div className="alert alert-red" style={{ marginBottom: 16, display: "flex", alignItems: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 7, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handle}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter your username" autoFocus required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
            </div>
            <button className="btn btn-primary" type="submit"
              style={{ width: "100%", justifyContent: "center", padding: "11px", fontSize: 14 }}
              disabled={loading || backendOk === false}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10, textAlign: "center" }}>
              Quick Access
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {ROLES.map(r => (
                <button key={r.id} onClick={() => { setUsername(r.user); setPassword(r.pass); }}
                  style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8, color: "#475569" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#0F172A"; e.currentTarget.style.background = "#F1F5F9"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "#F8FAFC"; }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 8 }}>Click a role to autofill credentials</div>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: "#94A3B8" }}>
          AI Medical Report Analysis System · Secure Clinical Records
        </div>
      </div>
    </div>
  );
}
