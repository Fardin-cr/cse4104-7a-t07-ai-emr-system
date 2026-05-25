import { useApp } from "../context/AppContext";

const ROLE_CONFIG = {
  admin:  { color: "#DC2626", bg: "#FEF2F2", label: "Administration" },
  doctor: { color: "#4F46E5", bg: "#EEF2FF", label: "Doctor" },
};

const IcoDashboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);
const IcoPatients = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const IcoReports = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
);
const IcoSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const NAV = [
  { id: "dashboard", label: "Dashboard",   icon: <IcoDashboard />, roles: ["admin", "doctor"] },
  { id: "patients",  label: "Patients",    icon: <IcoPatients />,  roles: ["admin", "doctor"] },
  { id: "reports",   label: "Lab Reports", icon: <IcoReports />,   roles: ["admin", "doctor"] },
  { id: "settings",  label: "Settings",    icon: <IcoSettings />,  roles: ["admin"] },
];

const NashmanLogo = ({ size = 44 }) => (
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

export default function Sidebar({ active, setActive }) {
  const { user, logout } = useApp();
  const rc = ROLE_CONFIG[user?.role] || {};
  const visibleNav = NAV.filter(n => n.roles.includes(user?.role));

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <NashmanLogo size={36} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", letterSpacing: "0.2px", lineHeight: 1.2 }}>
            Nashman Institute
          </div>
          <div style={{ fontSize: 9.5, color: "#64748B", letterSpacing: "0.3px" }}>
            Pathology &amp; Regenerative Medicine
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {visibleNav.map(n => (
          <button
            key={n.id}
            className={`nav-item ${active === n.id ? "active" : ""}`}
            onClick={() => setActive(n.id)}
          >
            {n.icon}
            <span className="nav-label">{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="role-badge" style={{ marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: rc.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800, color: rc.color, flexShrink: 0
          }}>
            {(user?.username || "?").substring(0, 2).toUpperCase()}
          </div>
          <div className="role-info">
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{rc.label}</div>
            <div style={{ fontSize: 11, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              @{user?.username}
            </div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={logout}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
