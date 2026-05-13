import { Component, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  Crown,
  FileText,
  Headset,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings,
  Shield,
  Sun,
  Ticket,
  UserRound,
  X,
} from 'lucide-react'
import Toast from './components/Toast.jsx'
import LoginPage from './components/LoginPage.jsx'
import CreateTicketModal from './components/CreateTicketModal.jsx'
import CustomerSupportWidget from './components/CustomerSupportWidget.jsx'
import ReportsModal from './components/ReportsModal.jsx'
import LiveOperationsMap from './components/LiveOperationsMap.jsx'
import { TicketFlowLogo, TicketFlowMark } from './components/Brand.jsx'
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

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(err) {
    return { error: err }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-screen">
          <TicketFlowMark size={48} />
          <h2>Something went wrong</h2>
          <p>{this.state.error.message}</p>
          <button
            onClick={() => {
              this.setState({ error: null })
              window.location.reload()
            }}
            className="btn btn-primary"
          >
            Reload TicketFlow
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

const NAV_GROUPS = {
  manager: [
    {
      label: 'Command',
      items: [
        { id: 'dashboard', label: 'Operations', icon: BarChart3 },
        { id: 'tickets', label: 'Tickets', icon: Ticket },
      ],
    },
    {
      label: 'People',
      items: [
        { id: 'employees', label: 'End Users', icon: UserRound },
        { id: 'operators', label: 'Agents', icon: Headset },
      ],
    },
    {
      label: 'Governance',
      items: [
        { id: 'assignment_logs', label: 'Routing', icon: Activity },
        { id: 'audit_log', label: 'Audit', icon: ClipboardCheck },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ],
  super_admin: [
    {
      label: 'System',
      items: [
        { id: 'super_dashboard', label: 'Control Center', icon: Crown },
        { id: 'dashboard', label: 'Manager Context', icon: BarChart3 },
      ],
    },
    {
      label: 'Operations',
      items: [
        { id: 'tickets', label: 'Tickets', icon: Ticket },
        { id: 'employees', label: 'End Users', icon: UserRound },
        { id: 'operators', label: 'Agents', icon: Headset },
      ],
    },
    {
      label: 'Governance',
      items: [
        { id: 'assignment_logs', label: 'Routing', icon: Activity },
        { id: 'audit_log', label: 'Audit', icon: ClipboardCheck },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ],
}

function flattenNav(groups) {
  return groups.flatMap(group => group.items)
}

function getHomePage(role) {
  if (role === 'operator') return 'workspace'
  if (role === 'employee') return 'my_tickets'
  if (role === 'super_admin') return 'super_dashboard'
  return 'dashboard'
}

function roleLabel(role) {
  return role?.replace('_', ' ') || 'workspace'
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }
  return { toasts, addToast }
}

function AppInner() {
  const [authState, setAuthState] = useState('checking')
  const [currentUser, setCurrentUser] = useState(null)
  const [token, setToken] = useState(null)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('tf_theme') || 'dark' } catch { return 'dark' }
  })
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('tf_sidebar_collapsed') === 'true' } catch { return false }
  })
  const [dashStats, setDashStats] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCreateTicket, setShowCreateTicket] = useState(false)
  const [showReports, setShowReports] = useState(false)
  const [impersonatingManagerId, setImpersonatingManagerId] = useState(null)
  const [impersonatingManagerName, setImpersonatingManagerName] = useState(null)
  const { toasts, addToast } = useToast()
  const statsIntervalRef = useRef(null)

  const API = useMemo(
    () => createAPI(token, impersonatingManagerId),
    [token, impersonatingManagerId],
  )

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('ticketflow_token') || localStorage.getItem('ticketflow_auth_token')
      const storedUser = localStorage.getItem('ticketflow_user')
      if (storedToken && storedUser) {
        const user = JSON.parse(storedUser)
        setCurrentUser(user)
        setToken(storedToken)
        setAuthState('authenticated')
        setPage(getHomePage(user.role))
      } else {
        setAuthState('unauthenticated')
      }
    } catch {
      setAuthState('unauthenticated')
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('tf_theme', theme) } catch {}
  }, [theme])

  useEffect(() => {
    try { localStorage.setItem('tf_sidebar_collapsed', String(sidebarCollapsed)) } catch {}
  }, [sidebarCollapsed])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const handleFirebaseLogin = ({ token: newToken, user }) => {
    try {
      localStorage.setItem('ticketflow_token', newToken)
      localStorage.setItem('ticketflow_auth_token', newToken)
      localStorage.setItem('ticketflow_user', JSON.stringify(user))
      localStorage.setItem('ticketflow_user_role', user.role)
    } catch {}
    setToken(newToken)
    setCurrentUser(user)
    setAuthState('authenticated')
    setPage(getHomePage(user.role))
  }

  const handleSignOut = async () => {
    try { await API.post('/auth/logout') } catch {}
    try { await firebaseSignOut() } catch {}
    try {
      localStorage.removeItem('ticketflow_token')
      localStorage.removeItem('ticketflow_auth_token')
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

  if (authState === 'checking') {
    return (
      <div className="loading-screen">
        <TicketFlowMark size={54} />
        <span className="spinner spinner-lg" />
        <span>Opening TicketFlow</span>
      </div>
    )
  }

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

  if (currentUser?.role === 'employee') {
    return (
      <>
        <div className="employee-shell">
          <header className="employee-header">
            <TicketFlowLogo subtitle="Employee support" />
            <div className="employee-header-actions">
              <span className="user-presence">Hi, {currentUser.name}</span>
              <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowReports(true)}>
                <FileText size={14} /> Reports
              </button>
              <button className="icon-btn" onClick={handleSignOut} title="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          </header>
          <EmployeeTickets
            API={API}
            addToast={addToast}
            currentUser={currentUser}
            refreshKey={refreshKey}
            onCreateTicket={() => setShowCreateTicket(true)}
          />
        </div>

        <CustomerSupportWidget currentUser={currentUser} API={API} addToast={addToast} />

        {showCreateTicket && (
          <CreateTicketModal
            API={API}
            currentUser={currentUser}
            onClose={() => setShowCreateTicket(false)}
            onSuccess={(msg) => {
              addToast(msg, 'success')
              setShowCreateTicket(false)
              refresh()
            }}
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

  const navGroups = NAV_GROUPS[currentUser?.role] || NAV_GROUPS.manager
  const navItems = flattenNav(navGroups)
  const pageTitle = navItems.find(n => n.id === page)?.label || 'Dashboard'

  const renderPage = () => {
    switch (page) {
      case 'super_dashboard':
        return (
          <SuperAdminDashboard
            API={API}
            addToast={addToast}
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
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <button
        className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close navigation"
      />

      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar-logo">
          <TicketFlowLogo compact={sidebarCollapsed} subtitle={currentUser?.role === 'super_admin' ? 'System control' : 'Operations'} />
          <button className="icon-btn mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">
            <X size={16} />
          </button>
        </div>

        <div className="sidebar-nav">
          {navGroups.map(group => (
            <div className="nav-group" key={group.label}>
              {!sidebarCollapsed && <div className="nav-group-label">{group.label}</div>}
              {group.items.map(item => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    className={`nav-item ${page === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setPage(item.id)
                      setSidebarOpen(false)
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon size={17} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                    {!sidebarCollapsed && item.id === 'tickets' && slaBreached > 0 && (
                      <span className="nav-alert">{slaBreached}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {dashStats && !sidebarCollapsed && (
          <div className="sidebar-stats">
            <div className="sidebar-stats-title">Live health</div>
            {[
              { label: 'Open tickets', value: dashStats.overview?.open_tickets ?? 0, tone: 'info' },
              { label: 'Agents online', value: dashStats.operators?.available ?? 0, tone: 'success' },
              { label: 'SLA compliance', value: `${dashStats.sla?.compliance_rate ?? 0}%`, tone: slaCompliance >= 90 ? 'success' : slaCompliance >= 70 ? 'warning' : 'danger' },
            ].map(s => (
              <div key={s.label} className="sidebar-stat-row">
                <span className="sidebar-stat-label">{s.label}</span>
                <span className={`sidebar-stat-val tone-${s.tone}`}>{s.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{currentUser?.name?.charAt(0) || '?'}</div>
            {!sidebarCollapsed && (
              <div className="sidebar-user-copy">
                <div>{currentUser?.name}</div>
                <span>{roleLabel(currentUser?.role)}</span>
              </div>
            )}
          </div>
          <div className="sidebar-footer-actions">
            <button className="icon-btn" onClick={() => setSidebarCollapsed(v => !v)} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="icon-btn" onClick={handleSignOut} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      <div className="main-panel">
        {impersonatingManagerId && (
          <div className="impersonation-bar">
            <div>
              <Shield size={15} />
              <span>Viewing manager context:</span>
              <strong>{impersonatingManagerName}</strong>
              <em>Super admin override</em>
            </div>
            <button
              className="btn btn-secondary btn-xs"
              onClick={() => {
                setImpersonatingManagerId(null)
                setImpersonatingManagerName(null)
                setPage('super_dashboard')
              }}
            >
              <X size={12} /> Exit view
            </button>
          </div>
        )}

        <header className="main-header">
          <div className="header-left">
            <button className="icon-btn mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
              <Menu size={18} />
            </button>
            <div className="header-breadcrumb">
              <span>TicketFlow</span>
              <span>/</span>
              <strong>{pageTitle}</strong>
            </div>
          </div>

          <div className="header-actions">
            {slaBreached > 0 && (
              <div className="notif-chip red">
                <AlertTriangle size={12} /> {slaBreached} SLA breach{slaBreached > 1 ? 'es' : ''}
              </div>
            )}
            {criticalCount > 0 && (
              <div className="notif-chip amber">
                <AlertTriangle size={12} /> {criticalCount} critical
              </div>
            )}
            {slaCompliance !== null && (
              <div className="sla-indicator" title={`SLA compliance: ${slaCompliance}%`}>
                <span className={`sla-dot ${slaCompliance >= 90 ? 'ok' : slaCompliance >= 70 ? 'warning' : 'danger'}`} />
                <span>{slaCompliance}% SLA</span>
              </div>
            )}
            {agentsAvailable > 0 && (
              <div className="presence-chip">
                <span /> {agentsAvailable} online
              </div>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => setShowReports(true)}>
              <FileText size={14} /> Reports
            </button>
            <button className="icon-btn" onClick={fetchStats} title="Refresh stats">
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

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
