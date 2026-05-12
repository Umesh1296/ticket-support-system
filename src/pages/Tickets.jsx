import { useEffect, useState } from 'react'
import { RefreshCw, Search, Ticket } from 'lucide-react'
import SLACountdown from '../components/SLACountdown.jsx'
import TicketDetailsModal from '../components/TicketDetailsModal.jsx'
import { getFriendlyErrorMessage } from '../lib/api.js'
import { formatCategoryLabel, TICKET_CATEGORIES } from '../lib/taxonomy.js'

export default function Tickets({ API, addToast, onRefresh, refreshKey, currentUser }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filters, setFilters] = useState({ status: '', priority: '', category: '', search: '' })

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.priority) params.append('priority', filters.priority)
      if (filters.category) params.append('category', filters.category)
      const { data } = await API.get(`/tickets${params.toString() ? '?' + params : ''}`)
      setTickets(data.data || [])
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Failed to load tickets'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTickets() }, [refreshKey, filters.status, filters.priority, filters.category])

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  const filtered = tickets.filter(t => {
    if (!filters.search) return true
    const q = filters.search.toLowerCase()
    return t.title.toLowerCase().includes(q) || t.reporter_name?.toLowerCase().includes(q) || (t.display_id || '').toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title"><Ticket size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />All Tickets</div>
          <div className="section-sub">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''} shown</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchTickets} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} />Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-input-wrap filter-group">
          <Search size={13} className="search-icon" />
          <input className="input filter-select" style={{ paddingLeft: 28, width: 200 }} placeholder="Search tickets…" value={filters.search} onChange={e => setFilter('search', e.target.value)} />
        </div>
        <select className="filter-select" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">All Statuses</option>
          {['open', 'assigned', 'in_progress', 'resolved', 'closed'].map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select className="filter-select" value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
          <option value="">All Priorities</option>
          {['critical', 'high', 'medium', 'low'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="filter-select" value={filters.category} onChange={e => setFilter('category', e.target.value)}>
          <option value="">All Categories</option>
          {TICKET_CATEGORIES.map(c => <option key={c} value={c}>{formatCategoryLabel(c)}</option>)}
        </select>
        {(filters.status || filters.priority || filters.category || filters.search) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ status: '', priority: '', category: '', search: '' })}>
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="spinner spinner-lg" /></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Reporter</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Agent</th>
                <th>SLA</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr className="table-empty"><td colSpan={8}>No tickets match your filters</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="ticket-row" onClick={() => setSelected(t)}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13, maxWidth: 260 }} title={t.title}>
                      {t.title.length > 50 ? t.title.slice(0, 50) + '…' : t.title}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>{t.display_id}</div>
                  </td>
                  <td style={{ fontSize: 12.5 }}>{t.reporter_name}</td>
                  <td><span className="skill-tag">{formatCategoryLabel(t.category)}</span></td>
                  <td><span className={`badge badge-${t.priority}`}>{t.priority}</span></td>
                  <td><span className={`badge badge-${t.status}`}>{t.status.replace('_', ' ')}</span></td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{t.operator_name || <span style={{ color: 'var(--text-4)' }}>Unassigned</span>}</td>
                  <td><SLACountdown deadline={t.sla_deadline} status={t.status} /></td>
                  <td style={{ fontSize: 11.5, fontFamily: 'var(--mono)', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <TicketDetailsModal
          ticket={selected}
          API={API}
          addToast={addToast}
          currentUser={currentUser}
          onClose={() => setSelected(null)}
          onUpdate={() => { fetchTickets(); onRefresh?.() }}
        />
      )}
    </div>
  )
}
