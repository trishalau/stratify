import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Activity, Bell, BriefcaseBusiness, ChevronDown, CircleHelp, Command, Gauge, History, Menu, Settings2, Sparkles, X } from 'lucide-react'

const navigation = [
  { to: '/', label: 'Overview', icon: Gauge, end: true },
  { to: '/business', label: 'My business', icon: BriefcaseBusiness },
  { to: '/simulator', label: 'Scenario simulator', icon: Activity },
  { to: '/history', label: 'Scenario history', icon: History },
]

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-row">
        <div className="brand-mark"><Command size={18} strokeWidth={2.4} /></div>
        <span className="brand-name">stratify<span className="brand-period">.</span></span>
        <button className="mobile-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={19} /></button>
      </div>
      <div className="workspace-switcher">
        <div className="workspace-avatar">KL</div>
        <div className="workspace-copy"><strong>KL Electronics</strong><span>Business workspace</span></div>
        <ChevronDown size={15} className="switcher-chevron" />
      </div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        {navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
          <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === 'Scenario simulator' && <span className="nav-new-dot" />}
        </NavLink>)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-insight">
        <div className="insight-icon"><Sparkles size={15} /></div>
        <strong>Your business, in focus.</strong>
        <p>Explore the impact of decisions before you make them.</p>
        <NavLink to="/simulator" onClick={() => setMenuOpen(false)}>Explore scenarios <span>↗</span></NavLink>
      </div>
      <div className="sidebar-footer">
        <NavLink to="/settings" onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}><Settings2 size={17} /><span>Settings</span></NavLink>
        <button className="nav-link help-link"><CircleHelp size={17} /><span>Help center</span></button>
        <div className="profile-row"><div className="profile-avatar">AL</div><div className="profile-copy"><strong>Alex Lau</strong><span>Owner</span></div><button aria-label="Open profile menu" className="more-button">···</button></div>
      </div>
    </aside>

    <div className="main-column">
      <header className="topbar">
        <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={19} /></button>
        <div className="breadcrumb"><span>Workspace</span><span className="crumb-divider">/</span><strong>KL Electronics Sdn. Bhd.</strong></div>
        <div className="topbar-actions">
          <div className="period-chip"><span className="status-dot" />Demo workspace <ChevronDown size={13} /></div>
          <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><span /></button>
          <div className="top-avatar">AR</div>
        </div>
      </header>
      {menuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
      <main className="main-content"><Outlet /></main>
      <footer className="app-footer"><span>© 2026 Stratify</span><span>Demo workspace · Estimates are for planning purposes only</span></footer>
    </div>
  </div>
}
