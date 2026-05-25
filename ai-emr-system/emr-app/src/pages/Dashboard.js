import { useApp } from "../context/AppContext";

const TYPE_META = {
  Hematology:  { color: "#2563EB", badge: "badge-blue"   },
  Hormone:     { color: "#7C3AED", badge: "badge-purple" },
  Immunology:  { color: "#0D9488", badge: "badge-teal"   },
  Biochemical: { color: "#16A34A", badge: "badge-green"  },
  Other:       { color: "#64748B", badge: "badge-gray"   },
};

const TypeDot = ({ type }) => {
  const color = TYPE_META[type]?.color || "#64748B";
  return (
    <div style={{
      width: 8, height: 8, borderRadius: "50%",
      background: color,
      display: "inline-block", marginRight: 6, flexShrink: 0
    }} />
  );
};

const ROLE_LABEL = { admin: "Administrator", doctor: "Doctor", technician: "Technician", receptionist: "Receptionist" };

export default function Dashboard({ setActive, setSelectedPatient }) {
  const { patients, user } = useApp();

  const totalReports  = patients.reduce((a, p) => a + p.reports.length, 0);
  const totalAbnormal = patients.reduce((a, p) =>
    a + p.reports.reduce((b, r) =>
      b + r.values.filter(v => v.abnormal).length, 0), 0);
  const totalPatients = patients.length;
  const thisMonth     = new Date().toISOString().slice(0, 7);
  const newThisMonth  = patients.filter(p => (p.registered || "").startsWith(thisMonth)).length;

  const recent = [...patients]
    .flatMap(p => p.reports.map(r => ({ ...r, patientName: p.name, patientId: p.id })))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  const typeCount = {};
  patients.forEach(p => p.reports.forEach(r => {
    typeCount[r.type] = (typeCount[r.type] || 0) + 1;
  }));

  // Most abnormal patients
  const critPatients = [...patients]
    .map(p => ({
      ...p,
      abnCount: p.reports.reduce((a, r) => a + r.values.filter(v => v.abnormal).length, 0)
    }))
    .filter(p => p.abnCount > 0)
    .sort((a, b) => b.abnCount - a.abnCount)
    .slice(0, 4);

  return (
    <div>
      {/* Welcome */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>
          Welcome, {ROLE_LABEL[user?.role] || user?.username}
        </h1>
        <p style={{ color: "#64748B", fontSize: 13 }}>
          Nashman Institute — Pathology &amp; Regenerative Medicine EMR
        </p>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        {[
          { label: "Total Patients",   value: totalPatients,  sub: `${newThisMonth} new this month`, color: "#4F46E5" },
          { label: "Total Reports",    value: totalReports,   sub: "All uploaded",                   color: "#0D9488" },
          { label: "Abnormal Flags",   value: totalAbnormal,  sub: "Need clinical review",           color: "#DC2626" },
          { label: "Report Categories",value: Object.keys(typeCount).length, sub: "Test types",      color: "#D97706" },
        ].map(s => (
          <div className="stat-card" key={s.label} style={{ borderTop: `3px solid ${s.color}` }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, marginBottom: 16 }}>
        {/* Recent Reports */}
        <div className="card">
          <div className="card-header">
            <div style={{ fontWeight: 700, fontSize: 15 }}>Recent Lab Reports</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setActive("reports")}>View all →</button>
          </div>
          <div>
            {recent.length === 0 ? (
              <div className="empty-state"><p>No reports yet. Upload the first lab report.</p></div>
            ) : recent.map(r => {
              const abn = r.values.filter(v => v.abnormal).length;
              const meta = TYPE_META[r.type] || TYPE_META.Other;
              return (
                <div key={r.id} className="patient-row"
                  onClick={() => { setSelectedPatient(r.patientId); setActive("patients"); }}>
                  <TypeDot type={r.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 1 }}>{r.patientName}</div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>
                      {r.type} · {r.lab}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: "#475569", fontWeight: 600, marginBottom: 3 }}>{r.date}</div>
                    {abn > 0
                      ? <span className="badge badge-red">{abn} abnormal</span>
                      : <span className="badge badge-green">Normal</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Report types */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header">
              <div style={{ fontWeight: 700, fontSize: 14 }}>By Report Type</div>
            </div>
            <div className="card-body">
              {Object.keys(typeCount).length === 0 ? (
                <div style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", padding: "12px 0" }}>No reports</div>
              ) : Object.entries(typeCount).map(([type, count]) => {
                const meta = TYPE_META[type] || TYPE_META.Other;
                const pct = totalReports > 0 ? Math.round((count / totalReports) * 100) : 0;
                return (
                  <div key={type} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <TypeDot type={type} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{type}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{count}</span>
                    </div>
                    <div style={{ height: 4, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: meta.color, borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Patients with abnormal flags */}
      {critPatients.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              <span style={{ color: "#DC2626" }}>⚠</span> Patients with Abnormal Flags
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>{critPatients.length} patients</div>
          </div>
          <div>
            {critPatients.map(p => (
              <div key={p.id} className="patient-row"
                onClick={() => { setSelectedPatient(p.id); setActive("patients"); }}>
                <div className="patient-avatar">{p.name?.charAt(0)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>{p.id} · {p.doctor || "—"}</div>
                </div>
                <span className="badge badge-red">{p.abnCount} abnormal value{p.abnCount > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
