import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, PlusCircle, CalendarDays, TrendingUp, Dumbbell, UserCircle, Settings as SettingsIcon, Activity, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/log", label: "Log Workout", icon: PlusCircle },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/exercises", label: "Exercises", icon: Dumbbell },
  { to: "/profile", label: "Profile", icon: UserCircle },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const MOBILE_NAV_ITEMS = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/log", label: "Log", icon: PlusCircle },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

export default function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon"><Activity size={19} /></span>
          Workout Tracker
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="flex items-center gap-8" style={{ padding: "8px 10px", fontSize: 13 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent-dark)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>
              {(user?.name || "?").charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</div>
            </div>
          </div>
          <button className="nav-link" style={{ width: "100%", border: "none", background: "none", cursor: "pointer" }} onClick={logout}>
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <div className="flex items-center gap-8" style={{ fontWeight: 800 }}>
            <span className="sidebar-brand-icon" style={{ width: 28, height: 28 }}><Activity size={15} /></span>
            Workout Tracker
          </div>
          <NavLink to="/settings" className="icon-btn"><SettingsIcon size={20} /></NavLink>
        </div>
        <Outlet />
      </div>

      <nav className="bottom-nav">
        {MOBILE_NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `bottom-nav-link${isActive ? " active" : ""}`}>
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
