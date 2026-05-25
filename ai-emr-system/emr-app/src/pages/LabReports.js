import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import PatientDetail from "./PatientDetail";

const TYPE_COLORS = {
  Hematology:  "#2563EB",
  Hormone:     "#7C3AED",
  Immunology:  "#0891B2",
  Biochemical: "#059669",
  Other:       "#64748B",
};

const STATUS_OPTIONS = ["All", "Normal", "Abnormal"];
const TYPE_OPTIONS   = ["All", "Hematology", "Hormone", "Immunology", "Biochemical", "Other"];
const DATE_OPTIONS   = ["All", "Today", "This Week", "This Month", "This Year"];

function getDateRange(filter) {
  const now = new Date();
  if (filter === "Today")      { const d = now.toISOString().split("T")[0]; return { from: d, to: d }; }
  if (filter === "This Week")  { const d = new Date(now); d.setDate(d.getDate() - 7);  return { from: d.toISOString().split("T")[0], to: now.toISOString().split("T")[0] }; }
  if (filter === "This Month") { const d = new Date(now.getFullYear(), now.getMonth(), 1); return { from: d.toISOString().split("T")[0], to: now.toISOString().split("T")[0] }; }
  if (filter === "This Year")  { const d = new Date(now.getFullYear(), 0, 1); return { from: d.toISOString().split("T")[0], to: now.toISOString().split("T")[0] }; }
  return null;
}

export default function LabReports() {
  const { patients, loading } = useApp();
  const [search,      setSearch]      = useState("");
  const [typeFilter,  setTypeFilter]  = useState("All");
  const [statusFilter,setStatusFilter]= useState("All");
  const [dateFilter,  setDateFilter]  = useState("Today");
  const [navigateTo,  setNavigateTo]  = useState(() => {
    const pid = sessionStorage.getItem("emr_selected_patient");
    const rid = sessionStorage.getItem("emr_pd_rep");
    if (pid && rid) return { patientId: pid, reportId: rid };
    return null;
  });

  // Flatten all reports from all patients — MUST be before early return (React rules of hooks)
  const allReports = useMemo(() => {
    const rows = [];
    patients.forEach(p => {
      (p.reports || []).forEach(r => {
        const abnCount = r.values?.filter(v => v.abnormal).length || 0;
        rows.push({
          reportId:    r.id,
          patientId:   p.id,
          patientName: p.name,
          patientAge:  p.age,
          patientSex:  p.sex,
          type:        r.type,
          date:        r.date,
          time:        r.time,
          lab:         r.lab,
          labId:       r.labId,
          createdAt:   r.createdAt || r.date,
          abnCount,
          totalCount:  r.values?.length || 0,
          isNormal:    abnCount === 0,
          editedBy:    r.editedBy,
        });
      });
    });
    // Sort by most recently created first
    return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [patients]);

  // Apply filters
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const dateRange = getDateRange(dateFilter);

    return allReports.filter(r => {
      // Search
      if (q) {
        const match =
          r.patientName?.toLowerCase().includes(q) ||
          r.patientId?.toLowerCase().includes(q) ||
          r.labId?.toLowerCase().includes(q) ||
          r.lab?.toLowerCase().includes(q) ||
          r.type?.toLowerCase().includes(q);
        if (!match) return false;
      }
      // Type filter
      if (typeFilter !== "All" && r.type !== typeFilter) return false;
      // Status filter
      if (statusFilter === "Normal"   && !r.isNormal)  return false;
      if (statusFilter === "Abnormal" &&  r.isNormal)  return false;
      // Date filter
      if (dateRange) {
        if (r.date < dateRange.from || r.date > dateRange.to) return false;
      }
      return true;
    });
  }, [allReports, search, typeFilter, statusFilter, dateFilter]);

  // Summary stats
  const stats = useMemo(() => ({
    total:    filtered.length,
    abnormal: filtered.filter(r => !r.isNormal).length,
    normal:   filtered.filter(r => r.isNormal).length,
    types:    [...new Set(filtered.map(r => r.type))].length,
  }), [filtered]);

  // Navigate to patient detail — early return AFTER all hooks
  if (navigateTo) {
    return (
      <PatientDetail
        patientId={navigateTo.patientId}
        initialRepId={navigateTo.reportId}
        onBack={() => {
          ['emr_pd_view','emr_pd_type','emr_pd_rep','emr_pd_param','emr_selected_patient'].forEach(k => sessionStorage.removeItem(k));
          setNavigateTo(null);
        }}
      />
    );
  }

  const filterBtnStyle = (active) => ({
    padding: "5px 12px", borderRadius: 99, fontSize: 12, cursor: "pointer",
    border: "1px solid", fontWeight: active ? 700 : 400,
    background: active ? "#0F172A" : "#fff",
    borderColor: active ? "#0F172A" : "#E4E8F0",
    color: active ? "#fff" : "#475569",
    transition: "all 0.15s",
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0 }}>Lab Register</h2>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>All laboratory reports across all patients</p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total Reports", value: stats.total, color: "#2563EB" },
          { label: "Abnormal",      value: stats.abnormal, color: "#DC2626" },
          { label: "Normal",        value: stats.normal, color: "#16A34A" },
          { label: "Test Types",    value: stats.types, color: "#7C3AED" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: "14px 20px", marginBottom: 12 }}>
        {/* Search */}
        <div className="search-wrap" style={{ marginBottom: 12 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="input" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by patient name, EMR ID, lab ID, test type..." />
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Date:</span>
          {DATE_OPTIONS.map(d => (
            <button key={d} style={filterBtnStyle(dateFilter === d)} onClick={() => setDateFilter(d)}>{d}</button>
          ))}
          <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginLeft: 8 }}>Type:</span>
          {TYPE_OPTIONS.map(t => (
            <button key={t} style={{
              ...filterBtnStyle(typeFilter === t),
              borderColor: typeFilter === t ? (TYPE_COLORS[t] || "#0F172A") : "#E4E8F0",
              background:  typeFilter === t ? (TYPE_COLORS[t] || "#0F172A") : "#fff",
              color:       typeFilter === t ? "#fff" : "#475569",
            }} onClick={() => setTypeFilter(t)}>{t}</button>
          ))}
          <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginLeft: 8 }}>Status:</span>
          {STATUS_OPTIONS.map(s => (
            <button key={s} style={filterBtnStyle(statusFilter === s)} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="empty-state"><p>Loading reports...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <h3>No reports found</h3>
            <p>Try adjusting your filters or search term.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 90px 100px 100px 100px 80px", padding: "10px 20px", background: "#F8F9FC", borderBottom: "2px solid #E4E8F0" }}>
              {["Lab ID", "Patient", "Type", "Date", "Time", "Lab", "Result", "Action"].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</div>
              ))}
            </div>

            {filtered.map((r, idx) => (
              <div
                key={r.reportId}
                style={{
                  display: "grid", gridTemplateColumns: "80px 1fr 120px 90px 100px 100px 100px 80px",
                  padding: "12px 20px", borderBottom: "1px solid #F1F5F9",
                  background: idx % 2 === 0 ? "#fff" : "#FAFBFC",
                  alignItems: "center", transition: "background 0.12s",
                  cursor: "pointer",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#EFF6FF"}
                onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#FAFBFC"}
                onClick={() => { sessionStorage.removeItem('emr_pd_param'); sessionStorage.setItem('emr_active_page','reports'); sessionStorage.setItem('emr_selected_patient', r.patientId); sessionStorage.setItem('emr_pd_rep', r.reportId); sessionStorage.setItem('emr_pd_view','report'); sessionStorage.setItem('emr_pd_type', r.type); setNavigateTo({ patientId: r.patientId, reportId: r.reportId }); }}
              >
                {/* Lab ID */}
                <div>
                  {r.labId
                    ? <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#0F172A" }}>#{r.labId}</span>
                    : <span style={{ color: "#CBD5E1", fontSize: 12 }}>—</span>}
                </div>

                {/* Patient */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {r.patientName?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.patientName}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{r.patientId} · {r.patientAge}y {r.patientSex}</div>
                  </div>
                </div>

                {/* Type */}
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: (TYPE_COLORS[r.type] || "#64748B") + "15", color: TYPE_COLORS[r.type] || "#64748B" }}>
                    {r.type}
                  </span>
                </div>

                {/* Date */}
                <div style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{r.date}</div>

                {/* Time */}
                <div style={{ fontSize: 12, color: "#64748B" }}>
                  {r.time && r.time !== "10:00 AM" ? r.time : "—"}
                </div>

                {/* Lab */}
                <div style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.lab || "—"}
                </div>

                {/* Result */}
                <div>
                  {r.abnCount > 0
                    ? <span className="badge badge-red">{r.abnCount} abnormal</span>
                    : <span className="badge badge-green">All normal</span>}
                </div>

                {/* Action */}
                <div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={e => { e.stopPropagation(); sessionStorage.removeItem('emr_pd_param'); sessionStorage.setItem('emr_active_page','reports'); sessionStorage.setItem('emr_selected_patient', r.patientId); sessionStorage.setItem('emr_pd_rep', r.reportId); sessionStorage.setItem('emr_pd_view','report'); sessionStorage.setItem('emr_pd_type', r.type); setNavigateTo({ patientId: r.patientId, reportId: r.reportId }); }}
                    style={{ fontSize: 11 }}
                  >
                    View →
                  </button>
                </div>
              </div>
            ))}

            {/* Footer count */}
            <div style={{ padding: "10px 20px", borderTop: "1px solid #F1F5F9", fontSize: 12, color: "#94A3B8" }}>
              Showing {filtered.length} report{filtered.length !== 1 ? "s" : ""}
              {dateFilter !== "All" ? ` · ${dateFilter}` : ""}
              {typeFilter !== "All" ? ` · ${typeFilter}` : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}