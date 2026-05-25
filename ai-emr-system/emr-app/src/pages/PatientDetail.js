import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import UploadReport from "../components/UploadReport";
import {
  ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceArea, ReferenceLine, Area
} from "recharts";

// ── Constants ────────────────────────────────────────────────────────────────
const TYPE_META = {
  Hematology:  { color: "#2563EB", clsBadge: "badge-blue",   clsType: "type-hematology"  },
  Hormone:     { color: "#7C3AED", clsBadge: "badge-purple", clsType: "type-hormone"     },
  Immunology:  { color: "#0D9488", clsBadge: "badge-teal",   clsType: "type-immunology"  },
  Biochemical: { color: "#16A34A", clsBadge: "badge-green",  clsType: "type-biochemical" },
  Other:       { color: "#64748B", clsBadge: "badge-gray",   clsType: "type-other"       },
};

const STATUS_STYLE = {
  "Normal":        { bg: "#DCFCE7", color: "#16A34A", label: "Normal" },
  "High":          { bg: "#FEE2E2", color: "#DC2626", label: "High ↑" },
  "Low":           { bg: "#DBEAFE", color: "#2563EB", label: "Low ↓" },
  "Critical High": { bg: "#7F1D1D", color: "#FFF",   label: "Critical H" },
  "Critical Low":  { bg: "#1E3A5F", color: "#FFF",   label: "Critical L" },
  "Abnormal":      { bg: "#FEF3C7", color: "#D97706", label: "Abnormal" },
  "Needs Review":  { bg: "#F1F5F9", color: "#64748B", label: "Needs Review" },
};

const RANGES = ["All", "3M", "6M", "1Y", "Custom"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function filterRange(reports, range, from, to, fromYear, toYear, useYearOnly) {
  const now = new Date();
  return reports.filter(r => {
    const d = new Date(r.date);
    if (range === "3M")    return (now - d) / (864e5 * 30) <= 3;
    if (range === "6M")    return (now - d) / (864e5 * 30) <= 6;
    if (range === "1Y")    { const y = new Date(now); y.setFullYear(y.getFullYear() - 1); return d >= y; }
    if (range === "Custom") {
      if (useYearOnly && fromYear && toYear) {
        return d.getFullYear() >= parseInt(fromYear) && d.getFullYear() <= parseInt(toYear);
      }
      if (!useYearOnly && from && to) {
        const toDate = new Date(to); toDate.setHours(23,59,59,999);
        return d >= new Date(from) && d <= toDate;
      }
    }
    return true;
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE["Needs Review"];
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: "2px 8px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, display: "inline-block",
      whiteSpace: "nowrap"
    }}>{s.label}</span>
  );
}

function GaugeBar({ value, refMin, refMax, status }) {
  const fVal = parseFloat(value);
  if (isNaN(fVal) || refMin == null || refMax == null) return null;
  const range = parseFloat(refMax) - parseFloat(refMin);
  if (range <= 0) return null;
  const pct = Math.min(Math.max((fVal - parseFloat(refMin)) / range, 0), 1) * 100;
  const color = STATUS_STYLE[status]?.color || "#64748B";
  return (
    <div style={{ height: 4, background: "#E4E8F0", borderRadius: 99, overflow: "visible", position: "relative", flex: 1, minWidth: 60 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "100%", background: "#DCFCE7", opacity: 0.6, borderRadius: 99 }} />
      <div style={{
        position: "absolute", top: -4, left: `${pct}%`,
        width: 12, height: 12, borderRadius: "50%",
        background: color, border: "2px solid white",
        boxShadow: "0 1px 4px rgba(0,0,0,.25)",
        transform: "translateX(-50%)"
      }} />
    </div>
  );
}

// ── Redesigned Clinical Trend Chart ──────────────────────────────────────────
function ClinicalTrendChart({ data, refMin, refMax, unit, color, paramName }) {
  if (!data || data.length < 2) return (
    <div style={{ padding: "32px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
      Need at least 2 data points for a trend chart.
    </div>
  );

  // Sort oldest → newest (left → right)
  const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = sorted[sorted.length - 1];
  const prev   = sorted[sorted.length - 2];

  const latestVal = parseFloat(latest?.value);
  const prevVal   = parseFloat(prev?.value);
  const pctChange = (!isNaN(latestVal) && !isNaN(prevVal) && prevVal !== 0)
    ? ((latestVal - prevVal) / Math.abs(prevVal) * 100).toFixed(1)
    : null;

  const vals = sorted.map(d => parseFloat(d.value)).filter(v => !isNaN(v));
  const rMin  = refMin != null ? parseFloat(refMin) : null;
  const rMax  = refMax != null ? parseFloat(refMax) : null;
  const dataMin = Math.min(...vals, rMin ?? Infinity);
  const dataMax = Math.max(...vals, rMax ?? -Infinity);
  const padding = (dataMax - dataMin) * 0.2 || 1;
  const yMin = dataMin - padding;
  const yMax = dataMax + padding;

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    const isCrit   = payload.status?.includes("Critical");
    const isAbn    = payload.status && payload.status !== "Normal";
    const isLatest = payload.date === latest.date;
    const dotColor = isCrit ? "#7F1D1D" : isAbn ? "#DC2626" : color;
    const r = isLatest ? 7 : 5;
    return (
      <g>
        {isCrit && <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="#DC2626" strokeWidth={1.5} opacity={0.35} strokeDasharray="3 2"/>}
        <circle cx={cx} cy={cy} r={r} fill={dotColor} stroke="white" strokeWidth={2}/>
        {isLatest && <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4}/>}
      </g>
    );
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const s = STATUS_STYLE[d?.status] || STATUS_STYLE["Needs Review"];
    return (
      <div style={{
        background: "#1E293B", border: "none", borderRadius: 10,
        padding: "10px 14px", fontSize: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,.25)"
      }}>
        <div style={{ color: "#94A3B8", marginBottom: 5, fontSize: 11 }}>{label}</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: s.color === "#FFF" ? "#fff" : s.color }}>
          {d?.value}
          <span style={{ fontWeight: 400, fontSize: 11, color: "#64748B", marginLeft: 4 }}>{unit}</span>
        </div>
        <div style={{ marginTop: 5 }}>
          <span style={{
            background: s.bg, color: s.color === "#FFF" ? "#fff" : s.color,
            padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700
          }}>{d?.status}</span>
        </div>
        {rMin != null && (
          <div style={{ color: "#64748B", fontSize: 10, marginTop: 5 }}>
            Ref: {rMin}–{rMax} {unit}
          </div>
        )}
      </div>
    );
  };

  const changePositive = pctChange !== null && parseFloat(pctChange) > 0;

  return (
    <div>
      {/* Summary strip */}
      <div className="trend-summary-bar">
        <div className="trend-summary-item">
          <span className="trend-summary-label">Current Value</span>
          <span className="trend-summary-value" style={{ color: STATUS_STYLE[latest.status]?.color || color }}>
            {isNaN(latestVal) ? "—" : latestVal}
          </span>
          <span className="trend-summary-sub">{unit} · {latest.date}</span>
        </div>
        <div className="trend-divider" />
        {prev && (
          <>
            <div className="trend-summary-item">
              <span className="trend-summary-label">Previous</span>
              <span className="trend-summary-value" style={{ color: "#475569", fontSize: 16 }}>
                {isNaN(prevVal) ? "—" : prevVal}
              </span>
              <span className="trend-summary-sub">{unit} · {prev.date}</span>
            </div>
            <div className="trend-divider" />
          </>
        )}
        {pctChange !== null && (
          <>
            <div className="trend-summary-item">
              <span className="trend-summary-label">Change</span>
              <span className="trend-summary-value" style={{ color: changePositive ? "#DC2626" : "#16A34A" }}>
                {changePositive ? "+" : ""}{pctChange}%
              </span>
              <span className="trend-summary-sub">vs previous result</span>
            </div>
            <div className="trend-divider" />
          </>
        )}
        <div className="trend-summary-item">
          <span className="trend-summary-label">Reference Range</span>
          <span className="trend-summary-value" style={{ color: "#16A34A", fontSize: 14, fontWeight: 700 }}>
            {rMin != null ? `${rMin}–${rMax}` : "N/A"}
          </span>
          <span className="trend-summary-sub">{unit}</span>
        </div>
        <div className="trend-divider" />
        <div className="trend-summary-item">
          <span className="trend-summary-label">Status</span>
          <span style={{ marginTop: 4 }}><StatusBadge status={latest.status} /></span>
        </div>
      </div>

      {/* Chart — oldest left, newest right */}
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={sorted} margin={{ top: 16, right: 20, left: 4, bottom: 8 }}>
          <defs>
            <linearGradient id={`areaGrad-${paramName}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.15}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#94A3B8", fontSize: 11 }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: "#94A3B8", fontSize: 11 }}
            axisLine={false} tickLine={false}
            width={44}
            tickFormatter={v => Number(v.toFixed(2))}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Shaded reference range band */}
          {rMin != null && rMax != null && (
            <ReferenceArea
              y1={rMin} y2={rMax}
              fill="#DCFCE7" fillOpacity={0.45}
              ifOverflow="extendDomain"
            />
          )}
          {rMin != null && (
            <ReferenceLine y={rMin} stroke="#16A34A" strokeDasharray="4 4" strokeWidth={1.5}
              label={{ value: `Min ${rMin}`, fill: "#16A34A", fontSize: 9, position: "insideBottomLeft" }} />
          )}
          {rMax != null && (
            <ReferenceLine y={rMax} stroke="#DC2626" strokeDasharray="4 4" strokeWidth={1.5}
              label={{ value: `Max ${rMax}`, fill: "#DC2626", fontSize: 9, position: "insideTopLeft" }} />
          )}

          {/* Area fill */}
          <Area
            type="monotone" dataKey="value"
            stroke="none"
            fill={`url(#areaGrad-${paramName})`}
            connectNulls
          />

          {/* Line */}
          <Line
            type="monotone" dataKey="value"
            stroke={color} strokeWidth={2.5}
            dot={<CustomDot />}
            activeDot={{ r: 8, fill: color, stroke: "white", strokeWidth: 2 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Result History Sidebar ───────────────────────────────────────────────────
function ResultHistory({ data, unit, color }) {
  // newest first
  const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
  return (
    <div>
      {sorted.map((d, idx) => {
        const s = STATUS_STYLE[d.status] || STATUS_STYLE["Needs Review"];
        const isLatest = idx === 0;
        const refRange = d.refMin != null ? `${d.refMin}–${d.refMax}` : null;
        return (
          <div key={d.date + idx} className={`history-item ${isLatest ? "is-latest" : ""}`}>
            {isLatest && (
              <div style={{
                position: "absolute", top: -1, right: 8,
                background: color, color: "#fff",
                fontSize: 9, fontWeight: 700,
                padding: "1px 7px", borderRadius: "0 0 5px 5px"
              }}>LATEST</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{d.date}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color === "#FFF" ? "#0F172A" : s.color }}>
                {d.value}
                <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 400, marginLeft: 3 }}>{unit}</span>
              </div>
            </div>
            <div style={{ height: 3, background: "#E4E8F0", borderRadius: 99, overflow: "hidden", marginBottom: 5 }}>
              {d.value != null && d.refMin != null && d.refMax != null && (
                <div style={{
                  width: `${Math.min(Math.max((d.value - d.refMin) / (d.refMax - d.refMin || 1), 0), 1) * 100}%`,
                  height: "100%", background: s.color === "#FFF" ? "#64748B" : s.color, borderRadius: 99
                }} />
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <StatusBadge status={d.status} />
              {refRange && (
                <span style={{ fontSize: 10, color: "#94A3B8" }}>Ref: {refRange} {unit}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main PatientDetail Component ─────────────────────────────────────────────
export default function PatientDetail({ patientId, onBack, initialRepId }) {
  const { patients, loading, user, editReport, deleteReport, exportToExcel, getPdfUrl, refreshPatient } = useApp();

  const patient = useMemo(() => patients.find(p => p.id === patientId), [patients, patientId]);

  const [view,      setView]      = useState(() => { const v = sessionStorage.getItem("emr_pd_view") || "categories"; return (v === "report" || v === "trend") ? "list" : v; });
  const [selType,   setType]      = useState(() => sessionStorage.getItem("emr_pd_type") || null);
  const [activeRep, setRep]       = useState(null);
  const restoredRef = useRef(false);

  // Restore active report after patient data loads
  useEffect(() => {
    if (restoredRef.current || !patient?.reports?.length) return;
    restoredRef.current = true;

    // initialRepId from LabReports navigation takes priority
    const repId = initialRepId || sessionStorage.getItem("emr_pd_rep");
    const savedView = sessionStorage.getItem("emr_pd_view");

    if (repId) {
      const found = patient.reports.find(r => r.id === repId);
      if (found) {
        setRep(found);
        // Find which type this report belongs to and set it
        const repType = found.type;
        if (repType) { setType(repType); sessionStorage.setItem("emr_pd_type", repType); }
        // If coming from LabReports (initialRepId), go straight to report view
        if (initialRepId) {
          setView("report"); sessionStorage.setItem("emr_pd_view", "report");
          sessionStorage.setItem("emr_pd_rep", repId);
        } else if (savedView === "report" || savedView === "trend") {
          setView(savedView);
        }
      }
    }
  }, [patient]);
  const [editMode,  setEditMode]  = useState(false);
  const [editVals,  setEditVals]  = useState([]);
  const [showUpload,setUpload]    = useState(false);
  const [showDelete,setDel]       = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [range,     setRange]     = useState("All");
  const [dateFrom,  setFrom]      = useState("");
  const [useYearOnly, setYearOnly] = useState(true);
  const [fromYear,  setFromYear]   = useState("");
  const [toYear,    setToYear]     = useState("");
  const [dateTo,    setTo]        = useState("");
  const [pinned,    setPinned]    = useState([]);
  const [activeTP,  setTP]        = useState(() => sessionStorage.getItem('emr_pd_param') || null);
  const [chartView, setChartView] = useState("chart");
  const [highlightedParam, setHighlightedParam] = useState(null);
  const rowRefs = useRef({});

  const canUpload = ["admin","doctor","technician"].includes(user?.role);
  const canEdit   = ["admin","doctor","technician"].includes(user?.role);
  const canDelete = ["admin","doctor"].includes(user?.role);

  // All useMemo hooks MUST be before early returns (React rules of hooks)
  const byType      = useMemo(() => {
    const bt = {};
    (patient?.reports || []).forEach(r => { (bt[r.type] = bt[r.type] || []).push(r); });
    return bt;
  }, [patient]);
  const typeReports = useMemo(() => selType ? (byType[selType] || []) : [], [byType, selType]);
  const meta        = TYPE_META[selType] || TYPE_META.Other;

  const filtered = useMemo(() =>
    filterRange(typeReports, range, dateFrom, dateTo, fromYear, toYear, useYearOnly)
      .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [typeReports, range, dateFrom, dateTo, fromYear, toYear, useYearOnly]
  );

  const allParams = useMemo(() => {
    const set = new Set();
    filtered.forEach(r => r.values.forEach(v => set.add(v.name)));
    return [...set];
  }, [filtered]);

  const trendData = useMemo(() => {
    if (!activeTP) return [];
    return filtered
      .map(r => {
        const v = r.values.find(vv => vv.name === activeTP);
        return v ? {
          date: r.date,
          value: v.value,
          valueText: v.valueText,
          status: v.status,
          refMin: v.refMin,
          refMax: v.refMax,
        } : null;
      })
      .filter(Boolean);
  }, [filtered, activeTP]);

  const refForParam = useMemo(() => {
    if (!activeTP) return {};
    const v = filtered.flatMap(r => r.values).find(v => v.name === activeTP);
    return v ? { refMin: v.refMin, refMax: v.refMax, unit: v.unit } : {};
  }, [filtered, activeTP]);

  const activeReport = useMemo(() =>
    activeRep && patient ? patient.reports.find(r => r.id === activeRep.id) || activeRep : null,
    [patient, activeRep]
  );

  const startEdit = useCallback(() => {
    if (!activeReport) return;
    setEditVals(activeReport.values.map(v => ({ ...v })));
    setEditMode(true);
  }, [activeReport]);

  // Early return AFTER all hooks
  if (!patient) {
    if (loading) return (
      <div className="card"><div className="empty-state"><p>Loading patient...</p></div></div>
    );
    return (
      <div className="card">
        <div className="empty-state">
          <h3>Patient not found</h3>
          <button className="btn btn-ghost" onClick={() => {
            ['emr_pd_view','emr_pd_type','emr_pd_rep','emr_pd_param','emr_selected_patient'].forEach(k => sessionStorage.removeItem(k));
            onBack();
          }}>← Back to Patients</button>
        </div>
      </div>
    );
  }

  const updateEdit = (i, val) => {
    setEditVals(prev => prev.map((v, idx) =>
      idx !== i ? v : { ...v, value: val === "" ? null : val, valueText: val }
    ));
  };

  const saveEdit = async () => {
    if (!activeReport) return;
    setSaving(true);
    try {
      await editReport(patient.id, activeReport.id, editVals, user.role);
      const fresh = await refreshPatient(patient.id);
      const updatedRep = fresh.reports.find(r => r.id === activeReport.id);
      if (updatedRep) setRep(updatedRep);
      setEditMode(false);
    } catch (e) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const openPdf = (id) => window.open(getPdfUrl(id), "_blank");

  // ── Range bar ──────────────────────────────────────────────────────────────
  const RangeBar = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      {RANGES.map(r => (
        <button key={r} onClick={() => setRange(r)} style={{
          padding: "4px 12px", borderRadius: 99, fontSize: 12, cursor: "pointer", border: "1px solid",
          background: range === r ? meta.color : "#fff",
          borderColor: range === r ? meta.color : "#E4E8F0",
          color: range === r ? "#fff" : "#475569",
          fontWeight: range === r ? 700 : 400,
        }}>{r}</button>
      ))}
      {range === "Custom" && (() => {
        const years = [];
        for (let y = 2020; y <= new Date().getFullYear() + 1; y++) years.push(y);
        const selectStyle = { padding: "4px 8px", borderRadius: 6, border: "1px solid #E4E8F0", fontSize: 12, background: "#fff", cursor: "pointer" };
        const inputStyle  = { padding: "4px 8px", borderRadius: 6, border: "1px solid #E4E8F0", fontSize: 12 };
        const isActive = useYearOnly ? (fromYear && toYear) : (dateFrom && dateTo);
        return <>
          {/* Toggle */}
          <div style={{ display:"flex", gap:2, background:"#F1F5F9", borderRadius:6, padding:2 }}>
            <button onClick={() => setYearOnly(true)} style={{ padding:"3px 8px", borderRadius:4, fontSize:11, fontWeight:600, border:"none", cursor:"pointer", background: useYearOnly ? "#fff" : "transparent", color: useYearOnly ? "#0F172A" : "#94A3B8", boxShadow: useYearOnly ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>Year</button>
            <button onClick={() => setYearOnly(false)} style={{ padding:"3px 8px", borderRadius:4, fontSize:11, fontWeight:600, border:"none", cursor:"pointer", background: !useYearOnly ? "#fff" : "transparent", color: !useYearOnly ? "#0F172A" : "#94A3B8", boxShadow: !useYearOnly ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>Date</button>
          </div>
          {useYearOnly ? <>
            <select value={fromYear} onChange={e => setFromYear(e.target.value)} style={selectStyle}>
              <option value="">From year</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span style={{ fontSize:12, color:"#94A3B8" }}>→</span>
            <select value={toYear} onChange={e => setToYear(e.target.value)} style={selectStyle}>
              <option value="">To year</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </> : <>
            <input type="date" value={dateFrom} onChange={e => setFrom(e.target.value)} style={inputStyle} />
            <span style={{ fontSize:12, color:"#94A3B8" }}>→</span>
            <input type="date" value={dateTo} onChange={e => setTo(e.target.value)} style={inputStyle} />
          </>}
          {isActive
            ? <span style={{ fontSize:11, color:"#16A34A", fontWeight:600 }}>✓ Active</span>
            : <span style={{ fontSize:11, color:"#F59E0B" }}>Select range</span>}
        </>;
      })()}
      <span style={{ marginLeft: "auto", fontSize: 12, color: "#94A3B8" }}>
        {filtered.length} report{filtered.length !== 1 ? "s" : ""}
      </span>
    </div>
  );

  return (
    <div>
      {/* Patient header */}
      <div style={{ marginBottom: 20 }}>
        <button className="back-btn" onClick={() => {
          ['emr_pd_view','emr_pd_type','emr_pd_rep','emr_pd_param','emr_selected_patient'].forEach(k => sessionStorage.removeItem(k));
          onBack();
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Patients
        </button>
      </div>

      {/* Patient info card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "#EEF2FF", color: "#4F46E5",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 18, flexShrink: 0
            }}>{patient.name?.charAt(0)}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{patient.name}</div>
              <div style={{ fontSize: 13, color: "#64748B" }}>
                {patient.id} ·&nbsp;
                {patient.age ? `${patient.age}y` : "—"} ·&nbsp;
                {patient.sex || "—"} ·&nbsp;
                Blood: {patient.blood || "—"}
              </div>
              {patient.doctor && (
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                  Physician: {patient.doctor}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {canUpload && (
              <button className="btn btn-primary btn-sm" onClick={() => setUpload(true)}>
                + Upload Report
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => exportToExcel(patient)}>
              Export Excel
            </button>
            {patient.phone && (
              <div style={{ fontSize: 12, color: "#64748B", display: "flex", alignItems: "center" }}>
                {patient.phone}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Breadcrumb / nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm"
          style={{ color: view === "categories" ? "#4F46E5" : "#64748B", fontWeight: view === "categories" ? 700 : 400 }}
          onClick={() => { setView("categories"); sessionStorage.setItem("emr_pd_view","categories"); setType(null); sessionStorage.removeItem("emr_pd_type"); setRep(null); sessionStorage.removeItem("emr_pd_rep"); restoredRef.current = false; }}>
          All Categories
        </button>
        {selType && (
          <>
            <span style={{ color: "#CBD5E1" }}>›</span>
            <button className="btn btn-ghost btn-sm"
              style={{ color: view === "list" ? meta.color : "#64748B", fontWeight: view === "list" ? 700 : 400 }}
              onClick={() => { setView("list"); sessionStorage.setItem("emr_pd_view","list"); setRep(null); sessionStorage.removeItem("emr_pd_rep"); restoredRef.current = false; }}>
              {selType}
            </button>
          </>
        )}
        {activeReport && (view === "report" || view === "trend") && (
          <>
            <span style={{ color: "#CBD5E1" }}>›</span>
            <span style={{ fontSize: 13, color: "#64748B" }}>
              {view === "trend" ? "Trend Analysis" : activeReport.date}
            </span>
          </>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {(view === "list" || view === "report" || view === "trend") && (
            <button className="btn btn-ghost btn-sm"
              onClick={() => {
                if (view === "trend") { setView("report"); sessionStorage.setItem("emr_pd_view","report"); }
                else if (view === "report") { setView("list"); sessionStorage.setItem("emr_pd_view","list"); setRep(null); sessionStorage.removeItem("emr_pd_rep"); restoredRef.current = false; setEditMode(false); }
                else { setView("categories"); sessionStorage.setItem("emr_pd_view","categories"); setType(null); sessionStorage.removeItem("emr_pd_type"); }
              }}>
              ← Back
            </button>
          )}
        </div>
      </div>

      {/* ── CATEGORIES ─────────────────────────────────────────────────────── */}
      {view === "categories" && (
        <div>
          {Object.keys(byType).length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <h3>No reports uploaded yet</h3>
                <p>{canUpload ? "Use the Upload Report button to add test results." : "No test reports available for this patient."}</p>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {Object.entries(byType).map(([type, reps]) => {
                const m = TYPE_META[type] || TYPE_META.Other;
                const totalAbn = reps.reduce((a, r) => a + r.values.filter(v => v.abnormal).length, 0);
                const last = reps[reps.length - 1];
                const sortedReps = [...reps].sort((a, b) => new Date(a.date) - new Date(b.date));
                return (
                  <div key={type} className="card" style={{
                    padding: "20px", cursor: "pointer",
                    borderLeft: `3px solid ${m.color}`,
                    transition: "box-shadow 0.15s",
                    marginBottom: 0
                  }}
                    onClick={() => { setType(type); sessionStorage.setItem("emr_pd_type", type); setView("list"); sessionStorage.setItem("emr_pd_view","list"); setRange("All"); setPinned([]); setTP(null); sessionStorage.removeItem('emr_pd_param'); }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,.1)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = ""}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{type}</div>
                        <div style={{ fontSize: 12, color: "#64748B" }}>{reps.length} report{reps.length > 1 ? "s" : ""}</div>
                      </div>
                      {totalAbn > 0
                        ? <span className="badge badge-red">{totalAbn} abnormal</span>
                        : <span className="badge badge-green">All normal</span>
                      }
                    </div>
                    {/* Timeline dots */}
                    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 10 }}>
                      {sortedReps.map((r, i) => {
                        const hasAbn = r.values.some(v => v.abnormal);
                        return (
                          <div key={r.id} style={{ display: "flex", alignItems: "center" }}>
                            <div style={{ width: 9, height: 9, borderRadius: "50%", background: hasAbn ? "#DC2626" : m.color }} />
                            {i < sortedReps.length - 1 && <div style={{ width: 20, height: 1, background: m.color + "30" }} />}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>
                      Last: {last.date} · {last.lab}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── REPORT LIST ─────────────────────────────────────────────────────── */}
      {view === "list" && selType && (
        <div>
          <RangeBar />
          {filtered.length === 0 ? (
            <div className="card"><div className="empty-state"><p>No reports in this date range.</p></div></div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 14 }}>
                {[...filtered].sort((a,b) => new Date(b.createdAt||b.date) - new Date(a.createdAt||a.date)).map((rep, idx) => {
                  const abnCount = rep.values.filter(v => v.abnormal).length;
                  const isPinned = pinned.includes(rep.id);
                  return (
                    <div key={rep.id} className="patient-row" style={{ padding: "14px 20px", gap: 14 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: meta.color + "15", color: meta.color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800, flexShrink: 0
                      }}>
                        {filtered.length - idx}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                        onClick={() => { setRep(rep); sessionStorage.setItem("emr_pd_rep", rep.id); setView("report"); sessionStorage.setItem("emr_pd_view","report"); setEditMode(false); }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{rep.date}</span>
                          {rep.time && rep.time !== "10:00 AM" && <span style={{ fontSize: 12, color: "#64748B", background: "#F1F5F9", padding: "1px 6px", borderRadius: 4 }}>{rep.time}</span>}
                          {idx === 0 && (
                            <span className="badge" style={{ background: meta.color + "15", color: meta.color, fontSize: 10 }}>LATEST</span>
                          )}
                          {rep.editedBy && <span className="badge badge-amber" style={{ fontSize: 10 }}>Edited</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748B" }}>
                          {rep.lab}{rep.labId ? ` · Lab ID: ${rep.labId}` : ""}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {abnCount > 0
                          ? <span className="badge badge-red">{abnCount} abnormal</span>
                          : <span className="badge badge-green">All normal</span>
                        }
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setPinned(p =>
                          p.includes(rep.id) ? p.filter(x => x !== rep.id) : [...p, rep.id]
                        )} className="btn btn-ghost btn-sm" style={{ color: isPinned ? meta.color : undefined }}>
                          {isPinned ? "Pinned ●" : "Pin"}
                        </button>
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => { setRep(rep); sessionStorage.setItem("emr_pd_rep", rep.id); setView("report"); sessionStorage.setItem("emr_pd_view","report"); setEditMode(false); }}>
                          View →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {pinned.length >= 2 && (
                <div className="card" style={{ borderTop: `2px solid ${meta.color}` }}>
                  <div className="card-header">
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Pinned Comparison ({pinned.length} reports)</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPinned([])}>Clear</button>
                  </div>
                  <div className="card-body" style={{ overflowX: "auto" }}>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${pinned.length}, 1fr)`, gap: 12, minWidth: 400 }}>
                      {filtered.filter(r => pinned.includes(r.id)).map(rep => (
                        <div key={rep.id} style={{ background: "#F8F9FC", borderRadius: 10, padding: "12px 14px", border: "1px solid #E4E8F0" }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{rep.date}</div>
                          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 10 }}>{rep.lab}</div>
                          {rep.values.map(v => (
                            <div key={v.name} className="value-row" style={{ padding: "4px 0" }}>
                              <span style={{ fontSize: 11, color: "#475569", flex: 1 }}>{v.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_STYLE[v.status]?.color || "#64748B" }}>
                                {v.value} <span style={{ fontWeight: 400, color: "#94A3B8", fontSize: 10 }}>{v.unit}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SINGLE REPORT ─────────────────────────────────────────────────── */}
      {view === "report" && activeReport && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {/* Left — PDF preview */}
          <div className="card">
            <div className="card-header">
              <div style={{ fontWeight: 700, fontSize: 14 }}>Original Report</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => openPdf(activeReport.id)}>
                  {['.jpg','.jpeg','.png','.bmp','.tiff','.webp'].some(ext => activeReport.pdfName?.toLowerCase().endsWith(ext)) ? 'Open Image' : 'Open PDF'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => openPdf(activeReport.id)}>Print</button>
              </div>
            </div>
            <div className="card-body" style={{ maxHeight: 520, overflowY: "auto" }}>
              <div className="pdf-mock">
                <div className="pdf-header">
                  <div className="pdf-title">{activeReport.lab?.toUpperCase() || "LAB REPORT"}</div>
                  <div className="pdf-subtitle">Nashman Institute — Pathology &amp; Regenerative Medicine</div>
                  <div style={{ marginTop: 6, fontSize: 9, color: "#555", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 20px" }}>
                    <span><b>Patient:</b> {patient.name}</span>
                    <span><b>Date:</b> {activeReport.date}</span>
                    <span><b>Age/Sex:</b> {patient.age}Y / {patient.sex}</span>
                    <span><b>Lab ID:</b> {activeReport.labId || "—"}</span>
                    <span><b>Specimen:</b> Blood</span>
                    <span><b>Time:</b> {activeReport.time}</span>
                  </div>
                  <div style={{ marginTop: 8, fontWeight: 800, fontSize: 11, color: "#1a237e", letterSpacing: "1px", textTransform: "uppercase" }}>
                    {activeReport.type} Report
                  </div>
                </div>
                <table className="pdf-table">
                  <thead>
                    <tr>
                      <th>Test Name</th>
                      <th>Result</th>
                      <th>Unit</th>
                      <th>Reference</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReport.values.map(v => (
                      <tr key={v.name + v.value}>
                        <td style={{ fontWeight: 600 }}>{v.name}</td>
                        <td className={v.abnormal ? "pdf-abnormal" : "pdf-normal"}>{v.valueText || v.value}</td>
                        <td>{v.unit}</td>
                        <td>{v.refMin}–{v.refMax}</td>
                        <td><StatusBadge status={v.status || (v.abnormal ? "Abnormal" : "Normal")} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {activeReport.editedBy && (
                  <div style={{ marginTop: 10, fontSize: 9, color: "#888", fontStyle: "italic" }}>
                    Edited by {activeReport.editedBy} on {activeReport.editedAt}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right — Values + edit */}
          <div className="card">
            <div className="card-header">
              <div style={{ fontWeight: 700, fontSize: 14 }}>Value Indicators</div>
              <div style={{ display: "flex", gap: 6 }}>
                {canEdit && !editMode && (
                  <button className="btn btn-secondary btn-sm" onClick={startEdit}>Edit Values</button>
                )}
                {editMode && <>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(false)}>Cancel</button>
                  <button className="btn btn-primary btn-sm" disabled={saving} onClick={saveEdit}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                </>}
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  setView("trend"); sessionStorage.setItem("emr_pd_view","trend"); if (activeRep) sessionStorage.setItem("emr_pd_rep", activeRep.id);
                  if (!activeTP && allParams.length > 0) setTP(allParams[0]); if(allParams[0]) sessionStorage.setItem('emr_pd_param', allParams[0]);
                }}>
                  Trend →
                </button>
                {canDelete && (
                  <button className="btn btn-danger btn-sm" onClick={() => setDel(activeReport.id)}>Delete</button>
                )}
              </div>
            </div>
            <div className="card-body" style={{ maxHeight: 520, overflowY: "auto" }}>
              {activeReport.values.filter(v => v.abnormal).length > 0 && (
                <div className="alert alert-red" style={{ marginBottom: 12 }}>
                  {activeReport.values.filter(v => v.abnormal).length} value(s) outside normal range
                </div>
              )}
              <div>
                {(editMode ? editVals : activeReport.values).map((v, i) => (
                  <div key={v.name + i} className="value-row">
                    <div className="value-name">{v.name}</div>
                    {editMode ? (
                      <input
                        className="input"
                        value={v.value ?? ""}
                        onChange={e => updateEdit(i, e.target.value)}
                        style={{ width: 80, padding: "4px 8px", textAlign: "center", fontSize: 13 }}
                      />
                    ) : (
                      <div className={`value-result ${v.abnormal ? "value-abnormal" : "value-normal"}`}>
                        {v.valueText || v.value}
                      </div>
                    )}
                    <div className="value-unit">{v.unit}</div>
                    <GaugeBar value={v.value} refMin={v.refMin} refMax={v.refMax} status={v.status} />
                    <div className="value-ref">{v.refMin}–{v.refMax}</div>
                    <div style={{ minWidth: 90, textAlign: "right" }}>
                      <StatusBadge status={v.status || (v.abnormal ? "Abnormal" : "Normal")} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TREND CHART ──────────────────────────────────────────────────────── */}
      {view === "trend" && selType && (
        <div>
          <RangeBar />

          {/* Parameter selector */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {allParams.map(p => (
              <button key={p} onClick={() => {
                setTP(p); sessionStorage.setItem('emr_pd_param', p);
                if (chartView === "table") {
                  setHighlightedParam(p);
                  setTimeout(() => {
                    rowRefs.current[p]?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 50);
                  setTimeout(() => setHighlightedParam(null), 2000);
                }
                // In chart view: setTP(p) above is enough, chart re-renders automatically
              }} style={{
                padding: "5px 14px", borderRadius: 99, fontSize: 12, cursor: "pointer", border: "1px solid",
                background: activeTP === p ? meta.color : "#fff",
                borderColor: activeTP === p ? meta.color : "#E4E8F0",
                color: activeTP === p ? "#fff" : "#475569",
                fontWeight: activeTP === p ? 700 : 400,
              }}>{p}</button>
            ))}
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {["chart", "table"].map(v => (
              <button key={v} onClick={() => setChartView(v)} style={{
                padding: "5px 16px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "1px solid",
                background: chartView === v ? "#1E293B" : "#fff",
                borderColor: chartView === v ? "#1E293B" : "#E4E8F0",
                color: chartView === v ? "#fff" : "#475569",
                fontWeight: 600,
              }}>{v === "chart" ? "Chart View" : "Flowsheet / Table"}</button>
            ))}
          </div>

          {filtered.length < 2 ? (
            <div className="card">
              <div className="empty-state">
                <h3>Need at least 2 reports for a trend</h3>
                <p>Expand the date range or upload more reports.</p>
              </div>
            </div>
          ) : chartView === "chart" ? (
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
              {/* Chart card */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{activeTP || "Select a parameter"}</div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>
                      Oldest → Newest (left to right) · {filtered.length} data points
                    </div>
                  </div>
                </div>
                <div style={{ padding: "8px 12px 16px" }}>
                  {activeTP ? (
                    <ClinicalTrendChart
                      data={trendData}
                      refMin={refForParam.refMin}
                      refMax={refForParam.refMax}
                      unit={refForParam.unit}
                      color={meta.color}
                      paramName={activeTP}
                    />
                  ) : (
                    <div style={{ padding: "32px 0", textAlign: "center", color: "#94A3B8" }}>
                      Select a parameter above to view the trend
                    </div>
                  )}
                </div>
              </div>

              {/* Result history sidebar */}
              <div className="card">
                <div className="card-header">
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    Result History
                    {activeTP && <span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8", marginLeft: 6 }}>
                      {activeTP}
                    </span>}
                  </div>
                </div>
                <div style={{ padding: "8px 4px", maxHeight: 440, overflowY: "auto" }}>
                  {activeTP ? (
                    <ResultHistory
                      data={trendData}
                      unit={refForParam.unit}
                      color={meta.color}
                    />
                  ) : (
                    <div style={{ textAlign: "center", color: "#94A3B8", padding: 24, fontSize: 13 }}>
                      Select a parameter
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Flowsheet / table */
            <div className="card">
              <div className="card-header">
                <div style={{ fontWeight: 700, fontSize: 14 }}>Flowsheet — All Parameters</div>
                <div style={{ fontSize: 12, color: "#94A3B8" }}>{filtered.length} reports · oldest → newest</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="flowsheet-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", position: "sticky", left: 0, background: "#F1F5F9", minWidth: 160 }}>Parameter</th>
                      <th style={{ textAlign: "center", minWidth: 60 }}>Unit</th>
                      <th style={{ textAlign: "center", color: "#16A34A", minWidth: 100 }}>Ref Range</th>
                      {[...filtered].sort((a, b) => new Date(a.date) - new Date(b.date)).map(r => (
                        <th key={r.id} style={{ textAlign: "center", color: meta.color, minWidth: 110 }}>
                          {r.date}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allParams.map((param, pi) => {
                      const refV = filtered.flatMap(r => r.values).find(v => v.name === param);
                      const isHighlighted = highlightedParam === param;
                      return (
                        <tr key={param} ref={el => rowRefs.current[param] = el} className={isHighlighted ? "highlighted" : ""}>
                          <td style={{ fontWeight: 600, color: "#0F172A", position: "sticky", left: 0, background: isHighlighted ? "#DBEAFE" : pi % 2 === 0 ? "#fff" : "#F8FAFC" }}>{param}</td>
                          <td style={{ textAlign: "center", color: "#64748B" }}>{refV?.unit || "—"}</td>
                          <td style={{ textAlign: "center", color: "#16A34A", fontWeight: 600 }}>
                            {refV?.refMin != null ? `${refV.refMin}–${refV.refMax}` : "—"}
                          </td>
                          {[...filtered].sort((a, b) => new Date(a.date) - new Date(b.date)).map(r => {
                            const v = r.values.find(vv => vv.name === param);
                            const s = STATUS_STYLE[v?.status] || STATUS_STYLE["Needs Review"];
                            return (
                              <td key={r.id} style={{ padding: "9px 12px", textAlign: "center" }}>
                                {v ? (
                                  <div>
                                    <div style={{ fontWeight: 700, color: "#0F172A" }}>
                                      {v.valueText || v.value}
                                    </div>
                                    <div style={{ marginTop: 2 }}><StatusBadge status={v.status} /></div>
                                  </div>
                                ) : (
                                  <span style={{ color: "#CBD5E1" }}>—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadReport
          patient={patient}
          onClose={() => setUpload(false)}
          onDone={async () => {
            await refreshPatient(patient.id);
            setUpload(false);
            setView("categories");
          }}
        />
      )}

      {/* Delete confirm */}
      {showDelete && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 700 }}>Delete Report</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDel(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-red">
                This action cannot be undone. The report and all extracted data will be permanently deleted.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDel(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={async () => {
                await deleteReport(patient.id, showDelete);
                setDel(null);
                setView("list"); sessionStorage.setItem("emr_pd_view","list");
                setRep(null);
              }}>Delete Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}