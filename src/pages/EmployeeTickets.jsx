import { useEffect, useState } from 'react'
import { ClipboardList, History, MessageSquareText, Plus, RefreshCw, Settings, Ticket } from 'lucide-react'
import AccountPasswordPanel from '../components/AccountPasswordPanel.jsx'
import SLACountdown from '../components/SLACountdown.jsx'
import TicketDetailsModal from '../components/TicketDetailsModal.jsx'
import { getFriendlyErrorMessage } from '../lib/api.js'
import { formatCategoryLabel } from '../lib/taxonomy.js'

export default function EmployeeTickets({ API, addToast, currentUser, onCreateTicket, refreshKey }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [activeTab, setActiveTab] = useState('tickets')
  const [detailTicketId, setDetailTicketId] = useState('')
  const [ticketDetail, setTicketDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackLoading, setFeedbackLoading] = useState(false)

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
  const detailOptions = activeTab === 'history' ? tickets : closed

  const loadTicketDetail = async (ticketId) => {
    if (!ticketId) {
      setTicketDetail(null)
      return
    }
    setDetailLoading(true)
    try {
      const { data } = await API.get(`/tickets/${ticketId}`)
      setTicketDetail(data.data)
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Failed to load ticket details'), 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const submitFeedback = async (event) => {
    event.preventDefault()
    if (!ticketDetail || !feedbackRating) {
      addToast('Select a rating before submitting feedback', 'error')
      return
    }
    setFeedbackLoading(true)
    try {
      await API.post(`/tickets/${ticketDetail.id}/feedback`, { rating: feedbackRating, comment: feedbackComment })
      addToast('Feedback submitted. Thank you!', 'success')
      setFeedbackRating(0)
      setFeedbackComment('')
      await loadTicketDetail(ticketDetail.id)
      await fetchTickets()
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Feedback failed'), 'error')
    } finally {
      setFeedbackLoading(false)
    }
  }

  useEffect(() => {
    if (!['feedback', 'worklog', 'history'].includes(activeTab)) return
    const first = detailOptions[0]?.id || ''
    setDetailTicketId(first)
    loadTicketDetail(first)
  }, [activeTab, tickets.length])

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

  const TicketPicker = ({ title, emptyText }) => (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {detailOptions.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{emptyText}</div>
      ) : (
        <select
          className="select"
          value={detailTicketId}
          onChange={event => {
            setDetailTicketId(event.target.value)
            loadTicketDetail(event.target.value)
          }}
        >
          {detailOptions.map(ticket => (
            <option key={ticket.id} value={ticket.id}>
              {ticket.display_id} - {ticket.title}
            </option>
          ))}
        </select>
      )}
    </div>
  )

  const renderDetailCard = () => {
    if (detailLoading) {
      return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><span className="spinner spinner-lg" /></div>
    }
    if (activeTab !== 'worklog' && !ticketDetail) return null

    if (activeTab === 'feedback') {
      return (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 6 }}>{ticketDetail.title}</div>
          <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 16 }}>{ticketDetail.display_id}</div>
          {ticketDetail.feedback ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="stat-card" style={{ padding: 14 }}>
                <div className="stat-card-label">Rating</div>
                <div className="stat-card-value" style={{ color: 'var(--amber)', background: 'none' }}>{ticketDetail.feedback.rating}/5</div>
              </div>
              <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                {ticketDetail.feedback.comment || 'No comment added.'}
              </div>
            </div>
          ) : ['resolved', 'closed'].includes(ticketDetail.status) ? (
            <form onSubmit={submitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 8 }}>Your rating</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setFeedbackRating(rating)}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 'var(--r-md)',
                        border: `1px solid ${rating <= feedbackRating ? 'var(--amber)' : 'var(--border)'}`,
                        background: rating <= feedbackRating ? 'var(--amber-dim)' : 'var(--bg-secondary)',
                        color: rating <= feedbackRating ? 'var(--amber)' : 'var(--text-3)',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>
              <label className="form-group">
                <span className="form-label">Comment</span>
                <textarea className="textarea" rows={3} value={feedbackComment} onChange={event => setFeedbackComment(event.target.value)} placeholder="Share your experience with this resolution..." />
              </label>
              <button className="btn btn-primary btn-sm" type="submit" disabled={feedbackLoading || !feedbackRating}>
                {feedbackLoading ? <span className="spinner spinner-sm" /> : null}
                Submit feedback
              </button>
            </form>
          ) : (
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Feedback can be submitted after this ticket is resolved.</div>
          )}
        </div>
      )
    }

    if (activeTab === 'worklog') {
      const workLog = ticketDetail?.work_log
      return (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Work Log</div>
          <div style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 16 }}>
            Select a resolved ticket to view the diagnosis and service report filed by the agent.
          </div>
          {closed.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 220 }}>
              <ClipboardList size={32} className="empty-state-icon" />
              <div className="empty-state-title">No resolved tickets yet</div>
              <div className="empty-state-sub">Work logs appear here after an agent resolves one of your tickets.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) minmax(0, 1fr)', gap: 16 }}>
              <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                {closed.map(ticket => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => {
                      setDetailTicketId(ticket.id)
                      loadTicketDetail(ticket.id)
                    }}
                    style={{
                      textAlign: 'left',
                      padding: 14,
                      borderRadius: 'var(--r-md)',
                      border: `1px solid ${detailTicketId === ticket.id ? 'var(--accent)' : 'var(--border)'}`,
                      background: detailTicketId === ticket.id ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                      color: 'var(--text-1)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>{ticket.display_id}</span>
                      <span className={`badge badge-${ticket.status}`}>{ticket.status.replace('_', ' ')}</span>
                    </div>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>{ticket.title}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: 12 }}>
                      Agent: {ticket.operator_name || 'Unassigned'}
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ padding: 16, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                {!ticketDetail ? (
                  <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Select a ticket to view its diagnosis report.</div>
                ) : !workLog ? (
                  <div className="empty-state" style={{ minHeight: 220 }}>
                    <ClipboardList size={32} className="empty-state-icon" />
                    <div className="empty-state-title">No diagnosis report filed</div>
                    <div className="empty-state-sub">
                      This ticket was resolved, but the agent did not file a work log through the resolution form.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{ticketDetail.title}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 3 }}>
                        {ticketDetail.display_id} - {workLog.operator_name} - {new Date(workLog.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span className="badge badge-neutral" style={{ width: 'fit-content' }}>{workLog.service_type?.replace('_', ' ')}</span>
                    {[
                      ['Diagnosis', workLog.diagnosis],
                      ['Service report / Resolution', workLog.resolution],
                      ['Parts serviced or changed', workLog.parts_changed],
                      ['Time spent', `${workLog.time_spent_minutes || 0} minutes`],
                      ['Agent notes', workLog.notes || 'No notes'],
                    ].map(([label, value]) => (
                      <div key={label} style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>{value || 'Not recorded'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800 }}>{ticketDetail.title}</div>
            <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 3 }}>{ticketDetail.display_id}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className={`badge badge-${ticketDetail.priority}`}>{ticketDetail.priority}</span>
            <span className={`badge badge-${ticketDetail.status}`}>{ticketDetail.status?.replace('_', ' ')}</span>
          </div>
        </div>
        <div style={{ color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 14 }}>{ticketDetail.description}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {[
            ['Agent', ticketDetail.operator_name || 'Unassigned'],
            ['Category', formatCategoryLabel(ticketDetail.category)],
            ['Created', new Date(ticketDetail.created_at).toLocaleString()],
            ['Resolved', ticketDetail.resolved_at ? new Date(ticketDetail.resolved_at).toLocaleString() : 'Not resolved'],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderContent = () => {
    if (activeTab === 'settings') {
      return <AccountPasswordPanel API={API} addToast={addToast} />
    }

    if (activeTab === 'feedback') {
      return (
        <>
          <TicketPicker title="Select a resolved ticket to view feedback" emptyText="Resolved tickets will appear here after support closes them." />
          {renderDetailCard()}
        </>
      )
    }

    if (activeTab === 'worklog') {
      return renderDetailCard()
    }

    if (activeTab === 'history') {
      return (
        <>
          <TicketPicker title="Select a ticket to view full history" emptyText="Your ticket history will appear here." />
          {renderDetailCard()}
        </>
      )
    }

    return loading ? (
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
    )
  }

  return (
    <div className="employee-dashboard-shell">
      <aside className="employee-sidebar">
        <div className="nav-group-label">Workspace</div>
        {[
          { id: 'tickets', label: 'My Tickets', icon: Ticket },
          { id: 'settings', label: 'Settings', icon: Settings },
          { id: 'feedback', label: 'Feedback', icon: MessageSquareText },
          { id: 'worklog', label: 'Work Log', icon: ClipboardList },
          { id: 'history', label: 'History', icon: History },
        ].map(item => {
          const Icon = item.icon
          return (
            <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          )
        })}
        <div className="sidebar-stats">
          <div className="sidebar-stats-title">My activity</div>
          <div className="sidebar-stat-row"><span className="sidebar-stat-label">Open tickets</span><span className="sidebar-stat-val tone-info">{open.length}</span></div>
          <div className="sidebar-stat-row"><span className="sidebar-stat-label">Resolved</span><span className="sidebar-stat-val tone-success">{closed.length}</span></div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: 24 }}>
        <div style={{ maxWidth: 940, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0 }}>
            {activeTab === 'tickets' ? 'My Tickets' : activeTab === 'worklog' ? 'Work Log' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>
            Hi {currentUser?.name?.split(' ')[0] || 'there'} - {open.length} open, {closed.length} resolved
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchTickets} disabled={loading}><RefreshCw size={13} /></button>
          <button className="btn btn-primary" onClick={onCreateTicket}><Plus size={14} />New Ticket</button>
        </div>
      </div>

          {renderContent()}
        </div>
      </main>

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
