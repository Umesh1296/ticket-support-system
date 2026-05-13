import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Ticket } from 'lucide-react'
import SLACountdown from '../components/SLACountdown.jsx'
import TicketDetailsModal from '../components/TicketDetailsModal.jsx'
import { getFriendlyErrorMessage } from '../lib/api.js'
import { formatCategoryLabel } from '../lib/taxonomy.js'

export default function EmployeeTickets({ API, addToast, currentUser, onCreateTicket, refreshKey }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const { data } = await API.get('/tickets')
      setTickets(data.data || [])
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Failed to load tickets'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTickets() }, [refreshKey])

  const open = tickets.filter(t => !['resolved', 'closed'].includes(t.status))
  const closed = tickets.filter(t => ['resolved', 'closed'].includes(t.status))

  const TicketCard = ({ t }) => (
    <div
      onClick={() => setSelected(t)}
      style={{
        padding: '16px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', cursor: 'pointer', transition: 'all 0.15s', marginBottom: 10,
        borderLeft: `3px solid ${t.priority === 'critical' ? 'var(--red)' : t.priority === 'high' ? 'var(--amber)' : t.priority === 'medium' ? 'var(--blue)' : 'var(--green)'}`,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', marginBottom: 3 }}>{t.title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{t.display_id}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <span className={`badge badge-${t.priority}`}>{t.priority}</span>
          <span className={`badge badge-${t.status}`}>{t.status.replace('_', ' ')}</span>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {t.description}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
          <span className="skill-tag" style={{ fontSize: 10.5 }}>{formatCategoryLabel(t.category)}</span>
          {t.operator_name && (
            <span style={{ color: 'var(--text-3)' }}>
              Agent: <strong style={{ color: 'var(--text-2)' }}>{t.operator_name}</strong>
            </span>
          )}
        </div>
        <SLACountdown deadline={t.sla_deadline} status={t.status} />
      </div>
      {t.feedback && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--amber)' }}>
          Rated {t.feedback.rating}/5
        </div>
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0 }}>My Tickets</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>
            Hi {currentUser?.name?.split(' ')[0] || 'there'} - {open.length} open, {closed.length} resolved
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchTickets} disabled={loading}><RefreshCw size={13} /></button>
          <button className="btn btn-primary" onClick={onCreateTicket}><Plus size={14} />New Ticket</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="spinner spinner-lg" /></div>
      ) : tickets.length === 0 ? (
        <div className="empty-state card">
          <Ticket size={36} className="empty-state-icon" />
          <div className="empty-state-title">No tickets yet</div>
          <div className="empty-state-sub">Click "New Ticket" to raise your first support request.</div>
          <button className="btn btn-primary" onClick={onCreateTicket} style={{ marginTop: 8 }}><Plus size={14} />Raise a Ticket</button>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--text-3)', marginBottom: 12 }}>
                Active ({open.length})
              </div>
              {open.map(t => <TicketCard key={t.id} t={t} />)}
            </div>
          )}
          {closed.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--text-3)', marginBottom: 12 }}>
                Resolved ({closed.length})
              </div>
              {closed.map(t => <TicketCard key={t.id} t={t} />)}
            </div>
          )}
        </>
      )}

      {selected && (
        <TicketDetailsModal
          ticket={selected}
          API={API}
          addToast={addToast}
          currentUser={currentUser}
          onClose={() => setSelected(null)}
          onUpdate={fetchTickets}
        />
      )}
    </div>
  )
}
