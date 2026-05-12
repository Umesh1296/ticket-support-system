import { Component, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, BarChart2,
  ClipboardCheck, Crown, FileText, Headset, LogOut, Menu, Moon,
  RefreshCw, Settings, Shield, Sun, Ticket, UserRound, X, Zap
} from 'lucide-react'
import Toast from './components/Toast.jsx'
import LoginPage from './components/LoginPage.jsx'
import CreateTicketModal from './components/CreateTicketModal.jsx'
import CustomerSupportWidget from './components/CustomerSupportWidget.jsx'
import ReportsModal from './components/ReportsModal.jsx'
import LiveOperationsMap from './components/LiveOperationsMap.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Tickets from './pages/Tickets.jsx'
import Employees from './pages/Employees.jsx'
import Operators from './pages/Operators.jsx'
import AgentWorkspace from './pages/AgentWorkspace.jsx'
import EmployeeTickets from './pages/EmployeeTickets.jsx'
import AssignmentLogs from './pages/AssignmentLogs.jsx'
import OperatorAuditLog from './pages/OperatorAuditLog.jsx'
import ManagerSettings from './pages/ManagerSettings.jsx'
import SuperAdminDashboard from './pages/SuperAdminDashboard.jsx'
import { createAPI } from './lib/api.js'
import { firebaseSignOut } from './lib/firebase.js'

// ─── ERROR BOUNDARY ──────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(err) { return { error: err } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: 40 }}>⚡</div>
          <h2 style={{ margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#666', textAlign: 'center', maxWidth: 400 }}>{this.state.error.message}</p>
          <button onClick={() => { this.setState({ error: null }); window.location.reload() }} style={{ padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── NAV CONFIG ──────────────────────────────────────────────────────────────
const MANAGER_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'employees', label: 'End Users', icon: UserRound },
  { id: 'operators', label: 'Agents', icon: Headset },
  { id: 'assignment_logs', label: 'Assignment Logs', icon: Activity },
  { id: 'audit_log', label: 'Audit Log', icon: ClipboardCheck },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const SUPER_ADMIN_NAV = [
  { id: 'super_dashboard', label: 'System Overview', icon: Crown },
  { id: 'dashboard', label: 'Manager Dashboard', icon: BarChart2 },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'employees', label: 'End Users', icon: UserRound },
  { id: 'operators', label: 'Agents', icon: Headset },
  { id: 'assignment_logs', label: 'Assignment Logs', icon: Activity },
  { id: 'audit_log', label: 'Audit Log', icon: ClipboardCheck },
  { id: 'settings', label: 'Settings', icon: Settings },
]

// ─── TOAST HOOK ───────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([])
  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }
  return { toasts, addToast }
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function AppInner() {
  const [authState, setAuthState] = useState('checking')
  const [currentUser, setCurrentUser] = useState(null)
  const [token, setToken] = useState(null)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('tf_theme') || 'dark' } catch { return 'dark' }
  })
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dashStats, setDashStats] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCreateTicket, setShowCreateTicket] = useState(false)
  const [showReports, setShowReports] = useState(false)
  const [impersonatingManagerId, setImpersonatingManagerId] = useState(null)
  const [impersonatingManagerName, setImpersonatingManagerName] = useState(null)
  const { toasts, addToast } = useToast()
  const statsIntervalRef = useRef(null)

  // Stable API instance — only recreate when token or impersonation changes
  const API = useMemo(
    () => createAPI(token, impersonatingManagerId),
    [token, impersonatingManagerId]
  )

  // Bootstrap auth from localStorage
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('ticketflow_token')
      const storedUser = localStorage.getItem('ticketflow_user')
      if (storedToken && storedUser) {
        const user = JSON.parse(storedUser)
        setCurrentUser(user)
        setToken(storedToken)
        setAuthState('authenticated')
        if (user.role === 'operator') setPage('workspace')
        else if (user.role === 'employee') setPage('my_tickets')
        else if (user.role === 'super_admin') setPage('super_dashboard')
      } else {
        setAuthState('unauthenticated')
      }
    } catch {
      setAuthState('unauthenticated')
    }
  }, [])

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('tf_theme', theme) } catch {}
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  // Login handler
  const handleFirebaseLogin = ({ token: newToken, user }) => {
    try {
      localStorage.setItem('ticketflow_token', newToken)
      localStorage.setItem('ticketflow_user', JSON.stringify(user))
      localStorage.setItem('ticketflow_user_role', user.role)
    } catch {}
    setToken(newToken)
    setCurrentUser(user)
    setAuthState('authenticated')
    if (user.role === 'operator') setPage('workspace')
    else if (user.role === 'employee') setPage('my_tickets')
    else if (user.role === 'super_admin') setPage('super_dashboard')
    else setPage('dashboard')
  }

  // Sign out
  const handleSignOut = async () => {
    try { await API.post('/auth/logout') } catch {}
    try { await firebaseSignOut() } catch {}
    try {
      localStorage.removeItem('ticketflow_token')
      localStorage.removeItem('ticketflow_user')
      localStorage.removeItem('ticketflow_user_role')
    } catch {}
    setToken(null)
    setCurrentUser(null)
    setDashStats(null)
    setAuthState('unauthenticated')
    setImpersonatingManagerId(null)
    setImpersonatingManagerName(null)
  }

  // Dashboard stats polling
  const fetchStats = async () => {
    if (!['manager', 'super_admin'].includes(currentUser?.role)) return
    try {
      const { data } = await API.get('/dashboard/stats')
      setDashStats(data.data)
    } catch {}
  }

  useEffect(() => {
    if (authState !== 'authenticated') return
    if (!['manager', 'super_admin'].includes(currentUser?.role)) return
    fetchStats()
    clearInterval(statsIntervalRef.current)
    statsIntervalRef.current = setInterval(fetchStats, 30000)
    return () => clearInterval(statsIntervalRef.current)
  }, [authState, currentUser?.role, token, impersonatingManagerId])

  const refresh = () => setRefreshKey(k => k + 1)

  const slaBreached = dashStats?.sla?.breached || 0
  const criticalCount = dashStats?.tickets_by_priority?.find(t => t.priority === 'critical')?.count || 0
  const slaCompliance = dashStats?.sla?.compliance_rate ?? null
  const agentsAvailable = dashStats?.operators?.available || 0

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (authState === 'checking') {
    return (
      <div className="loading-screen">
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#4f46e5,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
          <Zap size={26} color="#fff" />
        </div>
        <span className="spinner" style={{ width: 28, height: 28 }} />
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading TicketFlow…</span>
      </div>
    )
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <>
        <LoginPage API={API} addToast={addToast} onFirebaseLogin={handleFirebaseLogin} />
        <div className="toast-container">
          {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
        </div>
      </>
    )
  }

  // ── AGENT WORKSPACE ───────────────────────────────────────────────────────────
  if (currentUser?.role === 'operator') {
    return (
      <>
        <AgentWorkspace API={API} addToast={addToast} currentUser={currentUser} onSignOut={handleSignOut} />
        <div className="toast-container">
          {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
        </div>
      </>
    )
  }

  // ── EMPLOYEE VIEW ─────────────────────────────────────────────────────────────
  if (currentUser?.role === 'employee') {
    return (
      <>
        <div className="employee-shell">
          <div className="employee-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={16} color="#fff" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>TicketFlow</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Hi, {currentUser.name}</span>
              <button className="menu-trigger" onClick={toggleTheme} title="Toggle theme">
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowReports(true)}>
                <FileText size={13} />Reports
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleSignOut} title="Sign out">
                <LogOut size={14} />
              </button>
            </div>
          </div>
          <EmployeeTickets
            API={API} addToast={addToast} currentUser={currentUser}
            refreshKey={refreshKey} onCreateTicket={() => setShowCreateTicket(true)}
          />
        </div>

        <CustomerSupportWidget currentUser={currentUser} API={API} addToast={addToast} />

        {showCreateTicket && (
          <CreateTicketModal
            API={API} currentUser={currentUser}
            onClose={() => setShowCreateTicket(false)}
            onSuccess={(msg) => { addToast(msg, 'success'); setShowCreateTicket(false); refresh() }}
            onError={(msg) => addToast(msg, 'error')}
          />
        )}
        {showReports && <ReportsModal API={API} addToast={addToast} onClose={() => setShowReports(false)} />}
        <div className="toast-container">
          {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
        </div>
      </>
    )
  }

  // ── MANAGER / SUPER ADMIN ─────────────────────────────────────────────────────
  const navItems = currentUser?.role === 'super_admin' ? SUPER_ADMIN_NAV : MANAGER_NAV
  const pageTitle = navItems.find(n => n.id === page)?.label || 'Dashboard'

  const renderPage = () => {
    switch (page) {
      case 'super_dashboard':
        return (
          <SuperAdminDashboard
            API={API} addToast={addToast}
            onSelectManager={(id, name) => {
              setImpersonatingManagerId(id)
              setImpersonatingManagerName(name)
              setPage('dashboard')
              addToast(`Now viewing ${name}'s context`, 'info')
            }}
          />
        )
      case 'dashboard':
        return (
          <>
            <LiveOperationsMap stats={dashStats} />
            <Dashboard stats={dashStats} />
          </>
        )
      case 'tickets':
        return <Tickets API={API} addToast={addToast} onRefresh={refresh} refreshKey={refreshKey} currentUser={currentUser} />
      case 'employees':
        return <Employees API={API} addToast={addToast} onRefresh={refresh} refreshKey={refreshKey} />
      case 'operators':
        return <Operators API={API} addToast={addToast} onRefresh={refresh} refreshKey={refreshKey} />
      case 'assignment_logs':
        return <AssignmentLogs API={API} addToast={addToast} refreshKey={refreshKey} />
      case 'audit_log':
        return <OperatorAuditLog API={API} addToast={addToast} />
      case 'settings':
        return <ManagerSettings API={API} addToast={addToast} user={currentUser} onAccountDeleted={handleSignOut} />
      default:
        return <Dashboard stats={dashStats} />
    }
  }

  return (
    <div className="app-shell">
      {/* Sidebar backdrop */}
      <button
        className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close sidebar"
      />

      {/* Sidebar */}
      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="logo-mark"><Zap size={18} color="#fff" fill="#fff" /></div>
            <div className="logo-text">
              <div className="logo-name">TicketFlow</div>
              <div className="logo-sub">Support Desk</div>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => setSidebarOpen(false)}>
            <X size={14} />
          </button>
        </div>

        <div className="sidebar-nav">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => { setPage(item.id); setSidebarOpen(false) }}
              >
                <Icon size={16} />
                {item.label}
                {item.id === 'tickets' && slaBreached > 0 && (
                  <span style={{ marginLeft: 'auto', background: 'var(--red)', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>
                    {slaBreached}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Live stats */}
        {dashStats && (
          <div className="sidebar-stats">
            <div className="sidebar-stats-title">Live Stats</div>
            {[
              { label: 'Open Tickets', value: dashStats.overview?.open_tickets ?? 0, color: 'var(--blue)' },
              { label: 'Agents Online', value: dashStats.operators?.available ?? 0, color: 'var(--green)' },
              { label: 'SLA Compliance', value: `${dashStats.sla?.compliance_rate ?? 0}%`, color: slaCompliance >= 90 ? 'var(--green)' : slaCompliance >= 70 ? 'var(--amber)' : 'var(--red)' },
            ].map(s => (
              <div key={s.label} className="sidebar-stat-row">
                <span className="sidebar-stat-label">{s.label}</span>
                <span className="sidebar-stat-val" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{currentUser?.name?.charAt(0) || '?'}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser?.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'capitalize' }}>
                {currentUser?.role?.replace('_', ' ')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleSignOut} title="Sign out">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main panel */}
      <div className="main-panel">
        {/* Impersonation bar */}
        {impersonatingManagerId && (
          <div className="impersonation-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <Shield size={14} color="var(--accent-2)" />
              <span style={{ fontWeight: 600 }}>Viewing as:</span>
              <span>{impersonatingManagerName}</span>
              <span style={{ color: 'var(--text-3)' }}>— Super Admin override</span>
            </div>
            <button
              className="btn btn-secondary btn-xs"
              onClick={() => {
                setImpersonatingManagerId(null)
                setImpersonatingManagerName(null)
                setPage('super_dashboard')
              }}
            >
              <X size={11} />Exit View
            </button>
          </div>
        )}

        {/* Header */}
        <header className="main-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="menu-trigger" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
              <Menu size={18} />
            </button>
            <div className="header-breadcrumb">
              <span className="header-brand">TicketFlow</span>
              <span style={{ color: 'var(--border-strong)', fontSize: 12 }}>/</span>
              <span className="header-page">{pageTitle}</span>
            </div>
          </div>

          <div className="header-actions">
            {slaBreached > 0 && (
              <div className="notif-chip red">
                <AlertTriangle size={11} />{slaBreached} SLA breach{slaBreached > 1 ? 'es' : ''}
              </div>
            )}
            {criticalCount > 0 && (
              <div className="notif-chip amber">
                <AlertTriangle size={11} />{criticalCount} critical
              </div>
            )}
            {slaCompliance !== null && (
              <div className="sla-indicator" title={`SLA compliance: ${slaCompliance}%`}>
                <div className="sla-dot" style={{
                  background: slaCompliance >= 90 ? 'var(--green)' : slaCompliance >= 70 ? 'var(--amber)' : 'var(--red)'
                }} />
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{slaCompliance}% SLA</span>
              </div>
            )}
            {agentsAvailable > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                {agentsAvailable} online
              </span>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => setShowReports(true)}>
              <FileText size={13} />Reports
            </button>
            <button className="menu-trigger" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="menu-trigger" onClick={fetchStats} title="Refresh stats">
              <RefreshCw size={15} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content">
          <div className="page-content-inner">
            {renderPage()}
          </div>
        </main>
      </div>

      {showReports && <ReportsModal API={API} addToast={addToast} onClose={() => setShowReports(false)} />}

      <div className="toast-container">
        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}
