import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  Check,
  Clock3,
  GitPullRequestArrow,
  MessageSquare,
  Network,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  UserRound,
  X,
} from 'lucide-react'
import SLACountdown from '../components/SLACountdown.jsx'
import TicketDetailsModal from '../components/TicketDetailsModal.jsx'
import { getFriendlyErrorMessage } from '../lib/api.js'
import { formatCategoryLabel, TICKET_CATEGORIES } from '../lib/taxonomy.js'

const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 }

function getAiSignal(ticket) {
  if (ticket.priority === 'critical') return 'High breach probability. Keep owner and next action visible.'
  if (!ticket.assigned_to) return 'Routing needed. Skill and load assignment should run next.'
  if (ticket.status === 'open') return 'Classified and waiting for an agent handoff.'
  if (ticket.status === 'in_progress') return 'Active work detected. Ask for a customer-facing update.'
  return 'Context ready for audit and reporting.'
}

function getRelativeDate(value) {
  if (!value) return 'No date'
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Tickets({ API, addToast, onRefresh, refreshKey, currentUser }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [modalTicket, setModalTicket] = useState(null)
  const [transferRequests, setTransferRequests] = useState([])
  const [reviewingRequestId, setReviewingRequestId] = useState(null)
  const [filters, setFilters] = useState({ status: '', priority: '', category: '', search: '' })

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.priority) params.append('priority', filters.priority)
      if (filters.category) params.append('category', filters.category)
      const [ticketRes, transferRes] = await Promise.all([
        API.get(`/tickets${params.toString() ? '?' + params : ''}`),
        API.get('/tickets/transfer-requests?status=pending').catch(() => ({ data: { data: [] } })),
      ])
      const data = ticketRes.data
      const nextTickets = data.data || []
      setTickets(nextTickets)
      setTransferRequests(transferRes.data.data || [])
      setSelected(current => {
        if (current && nextTickets.some(t => t.id === current.id)) return nextTickets.find(t => t.id === current.id)
        return nextTickets[0] || null
      })
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Failed to load tickets'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [refreshKey, filters.status, filters.priority, filters.category])

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }))

  const reviewTransferRequest = async (request, action) => {
    setReviewingRequestId(request.id)
    try {
      const { data } = await API.post(`/tickets/transfer-requests/${request.id}/${action}`)
      addToast(data.message || `Transfer request ${action}d`, 'success')
      await fetchTickets()
      onRefresh?.()
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Could not review transfer request'), 'error')
    } finally {
      setReviewingRequestId(null)
    }
  }

  const filtered = useMemo(() => {
    return tickets
      .filter(t => {
        if (!filters.search) return true
        const q = filters.search.toLowerCase()
        return (
          t.title.toLowerCase().includes(q) ||
          t.reporter_name?.toLowerCase().includes(q) ||
          (t.display_id || '').toLowerCase().includes(q) ||
          formatCategoryLabel(t.category).toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const p = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9)
        if (p !== 0) return p
        return new Date(a.sla_deadline) - new Date(b.sla_deadline)
      })
  }, [tickets, filters.search])

  const activeTickets = filtered.filter(t => !['resolved', 'closed'].includes(t.status))
  const breached = filtered.filter(t => !['resolved', 'closed'].includes(t.status) && new Date(t.sla_deadline) < new Date())
  const unassigned = filtered.filter(t => !t.assigned_to)

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title"><Ticket size={18} /> Ticket Operations</div>
          <div className="section-sub">{filtered.length} shown, {activeTickets.length} active, {breached.length} breached</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchTickets} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {transferRequests.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(139,92,246,0.28)' }}>
          <div className="section-header" style={{ marginBottom: 12 }}>
            <div>
              <div className="section-title" style={{ fontSize: 15 }}><GitPullRequestArrow size={16} /> Transfer Requests</div>
              <div className="section-sub">Approve to return the ticket to auto-assignment.</div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {transferRequests.map(request => (
              <div key={request.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 5 }}>
                    <strong>{request.ticket_title}</strong>
                    <span style={{ color: 'var(--text-3)', fontSize: 12 }}>from {request.operator_name || 'Agent'}</span>
                  </div>
                  <div style={{ color: 'var(--text-2)', fontSize: 13 }}>{request.reason}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => reviewTransferRequest(request, 'reject')} disabled={reviewingRequestId === request.id}>
                    <X size={13} />Reject
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => reviewTransferRequest(request, 'approve')} disabled={reviewingRequestId === request.id}>
                    {reviewingRequestId === request.id ? <span className="spinner spinner-sm" /> : <Check size={13} />}
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-card-label">Needs action</div>
            <div className="stat-card-icon" style={{ background: 'var(--amber-dim)' }}><Clock3 size={16} color="var(--amber)" /></div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--amber)' }}>{activeTickets.length}</div>
          <div className="stat-card-sub">Open operational work</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-card-label">SLA breaches</div>
            <div className="stat-card-icon" style={{ background: 'var(--red-dim)' }}><Clock3 size={16} color="var(--red)" /></div>
          </div>
          <div className="stat-card-value" style={{ color: breached.length ? 'var(--red)' : 'var(--text-3)' }}>{breached.length}</div>
          <div className="stat-card-sub">Escalate immediately</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-card-label">Unassigned</div>
            <div className="stat-card-icon" style={{ background: 'var(--blue-dim)' }}><Network size={16} color="var(--blue)" /></div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--blue)' }}>{unassigned.length}</div>
          <div className="stat-card-sub">Ready for routing</div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrap filter-group">
          <Search size={14} className="search-icon" />
          <input
            className="input filter-select"
            style={{ paddingLeft: 32, width: 260 }}
            placeholder="Search tickets, customers, IDs"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
          />
        </div>
        <select className="filter-select" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {['open', 'assigned', 'in_progress', 'resolved', 'closed'].map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select className="filter-select" value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
          <option value="">All priorities</option>
          {['critical', 'high', 'medium', 'low'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="filter-select" value={filters.category} onChange={e => setFilter('category', e.target.value)}>
          <option value="">All categories</option>
          {TICKET_CATEGORIES.map(c => <option key={c} value={c}>{formatCategoryLabel(c)}</option>)}
        </select>
        {(filters.status || filters.priority || filters.category || filters.search) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ status: '', priority: '', category: '', search: '' })}>
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="empty-state card">
          <span className="spinner spinner-lg" />
          <div className="empty-state-title">Loading ticket operations</div>
        </div>
      ) : (
        <div className="ticket-board">
          <div className="ticket-smart-list">
            {filtered.length === 0 ? (
              <div className="empty-state card">
                <Search size={34} className="empty-state-icon" />
                <div className="empty-state-title">No tickets match this view</div>
                <div className="empty-state-sub">Adjust filters or search terms to bring tickets back into the queue.</div>
              </div>
            ) : filtered.map(t => (
              <button
                key={t.id}
                className={`ticket-card ${selected?.id === t.id ? 'active' : ''}`}
                onClick={() => setSelected(t)}
              >
                <div>
                  <div className="ticket-card-meta" style={{ marginBottom: 7 }}>
                    <span style={{ fontFamily: 'var(--mono)' }}>{t.display_id}</span>
                    <span className={`badge badge-${t.priority}`}>{t.priority}</span>
                    <span className={`badge badge-${t.status}`}>{t.status.replace('_', ' ')}</span>
                    <span className="skill-tag">{formatCategoryLabel(t.category)}</span>
                  </div>
                  <h3 className="ticket-card-title">{t.title}</h3>
                  <div className="ticket-card-meta">
                    <UserRound size={13} /> {t.reporter_name}
                    <span>{t.operator_name ? `Owner: ${t.operator_name}` : 'Unassigned'}</span>
                  </div>
                  <p className="ticket-card-description">
                    {t.description?.length > 150 ? `${t.description.slice(0, 150)}...` : t.description}
                  </p>
                </div>
                <div className="ticket-card-aside">
                  <SLACountdown deadline={t.sla_deadline} status={t.status} />
                  <span style={{ color: 'var(--text-4)', fontSize: 11 }}>{getRelativeDate(t.created_at)}</span>
                </div>
              </button>
            ))}
          </div>

          <aside className="ticket-detail-panel card">
            {!selected ? (
              <div className="empty-state ticket-detail-empty">
                <Ticket size={38} className="empty-state-icon" />
                <div className="empty-state-title">Select a ticket</div>
                <div className="empty-state-sub">The operational context panel will show SLA, assignment, AI signals, and history.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <div className="ticket-card-meta" style={{ marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--mono)' }}>{selected.display_id}</span>
                    <span className={`badge badge-${selected.priority}`}>{selected.priority}</span>
                    <span className={`badge badge-${selected.status}`}>{selected.status.replace('_', ' ')}</span>
                  </div>
                  <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.2 }}>{selected.title}</h2>
                  <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{selected.description}</p>
                </div>

                <div className="context-profile-card">
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent-dim)', color: 'var(--accent-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 760 }}>
                    {selected.reporter_name?.charAt(0) || '?'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 760 }}>{selected.reporter_name}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.reporter_email}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  <div className="context-mini-card" style={{ color: 'var(--text-2)', background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                    <Clock3 size={16} />
                    <div><strong style={{ color: 'var(--text-1)' }}>SLA</strong><span style={{ color: 'var(--text-3)' }}><SLACountdown deadline={selected.sla_deadline} status={selected.status} /></span></div>
                  </div>
                  <div className="context-mini-card" style={{ color: 'var(--text-2)', background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                    <Network size={16} />
                    <div><strong style={{ color: 'var(--text-1)' }}>Owner</strong><span style={{ color: 'var(--text-3)' }}>{selected.operator_name || 'Unassigned'}</span></div>
                  </div>
                </div>

                <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                  <div className="section-title" style={{ fontSize: 14 }}><Bot size={16} /> AI signal</div>
                  <p style={{ margin: '9px 0 0', color: 'var(--text-2)', fontSize: 13 }}>{getAiSignal(selected)}</p>
                </div>

                <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                  <div className="section-title" style={{ fontSize: 14 }}><MessageSquare size={16} /> Suggested next action</div>
                  <p style={{ margin: '9px 0 0', color: 'var(--text-2)', fontSize: 13 }}>
                    Send a customer update, confirm the owner, and keep the SLA timer visible until resolution.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => setModalTicket(selected)}>
                    <Sparkles size={15} /> Open workspace
                  </button>
                  <button className="btn btn-secondary" onClick={fetchTickets}>
                    <RefreshCw size={15} /> Refresh context
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {modalTicket && (
        <TicketDetailsModal
          ticket={modalTicket}
          API={API}
          addToast={addToast}
          currentUser={currentUser}
          onClose={() => setModalTicket(null)}
          onUpdate={() => {
            fetchTickets()
            onRefresh?.()
          }}
        />
      )}
    </div>
  )
}
