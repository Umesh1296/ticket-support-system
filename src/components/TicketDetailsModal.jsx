import { useEffect, useState } from 'react'
import { Activity, CheckCircle, ClipboardList, MessageSquare, RefreshCw, Star, X } from 'lucide-react'
import SLACountdown from './SLACountdown.jsx'
import { getFriendlyErrorMessage } from '../lib/api.js'
import { formatCategoryLabel } from '../lib/taxonomy.js'

function Stars({ rating }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={14} className={i <= rating ? 'star' : 'star-empty'} fill={i <= rating ? 'currentColor' : 'none'} />
      ))}
    </div>
  )
}

const TABS = ['Details', 'Work Log', 'History', 'Feedback']

export default function TicketDetailsModal({ ticket, API, addToast, onClose, onUpdate, currentUser }) {
  const [full, setFull] = useState(ticket)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Details')
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [reassigning, setReassigning] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const { data } = await API.get(`/tickets/${ticket.id}`)
        setFull(data.data)
      } catch { /* use ticket prop */ }
      finally { setLoading(false) }
    })()
  }, [ticket.id, API])

  const handleStatusUpdate = async (status, priority) => {
    try {
      const body = {}
      if (status) body.status = status
      if (priority) body.priority = priority
      const { data } = await API.put(`/tickets/${ticket.id}`, body)
      setFull(prev => ({ ...prev, ...data.data }))
      addToast(`Ticket updated`, 'success')
      onUpdate?.()
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Update failed'), 'error')
    }
  }

  const handleReassign = async () => {
    setReassigning(true)
    try {
      const { data } = await API.post(`/tickets/${ticket.id}/reassign`)
      addToast(data.message || 'Reassigned', 'success')
      const refreshed = await API.get(`/tickets/${ticket.id}`)
      setFull(refreshed.data.data)
      onUpdate?.()
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Reassignment failed'), 'error')
    } finally {
      setReassigning(false) }
  }

  const handleFeedback = async (e) => {
    e.preventDefault()
    if (!feedbackRating) { addToast('Please select a rating', 'error'); return }
    setFeedbackLoading(true)
    try {
      await API.post(`/tickets/${ticket.id}/feedback`, { rating: feedbackRating, comment: feedbackComment })
      addToast('Feedback submitted! Thank you.', 'success')
      const refreshed = await API.get(`/tickets/${ticket.id}`)
      setFull(refreshed.data.data)
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Feedback failed'), 'error')
    } finally {
      setFeedbackLoading(false)
    }
  }

  const isManager = currentUser?.role === 'manager' || currentUser?.role === 'super_admin'
  const isEmployee = currentUser?.role === 'employee'
  const isResolved = full.status === 'resolved' || full.status === 'closed'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 660 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>{full.display_id}</span>
              <span className={`badge badge-${full.priority}`}>{full.priority}</span>
              <span className={`badge badge-${full.status}`}>{full.status.replace('_', ' ')}</span>
            </div>
            <div className="modal-title" style={{ fontSize: 15 }}>{full.title}</div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 24px', background: 'var(--bg-secondary)' }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 16px', border: 'none', background: 'transparent',
                fontSize: 13, fontWeight: tab === t ? 700 : 500,
                color: tab === t ? 'var(--accent-2)' : 'var(--text-3)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s', marginBottom: '-1px',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <span className="spinner" />
            </div>
          ) : (
            <>
              {tab === 'Details' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Description */}
                  <div>
                    <div className="detail-label">Description</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                      {full.description}
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="form-row">
                    <div>
                      <div className="detail-label">Reporter</div>
                      <div className="detail-value">{full.reporter_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{full.reporter_email}</div>
                    </div>
                    <div>
                      <div className="detail-label">Assigned To</div>
                      <div className="detail-value">{full.operator_name || '-'}</div>
                      {full.operator_email && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{full.operator_email}</div>}
                    </div>
                  </div>
                  <div className="form-row">
                    <div>
                      <div className="detail-label">Category</div>
                      <span className="skill-tag">{formatCategoryLabel(full.category)}</span>
                    </div>
                    <div>
                      <div className="detail-label">SLA Status</div>
                      <SLACountdown deadline={full.sla_deadline} status={full.status} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div>
                      <div className="detail-label">Created</div>
                      <div className="detail-value">{new Date(full.created_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="detail-label">Resolved</div>
                      <div className="detail-value">{full.resolved_at ? new Date(full.resolved_at).toLocaleString() : '-'}</div>
                    </div>
                  </div>

                  {/* Assignment history */}
                  {isManager && full.assignment_history?.length > 0 && (
                    <div>
                      <div className="detail-label" style={{ marginBottom: 8 }}>Assignment History</div>
                      {full.assignment_history.slice(0, 5).map((log, i) => (
                        <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{log.operator_name || 'Unknown'}</span>
                            <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>{log.reason?.split(';')[0]}</span>
                          </div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent-2)' }}>Score: {log.score || '-'}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Manager actions */}
                  {isManager && !isResolved && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {full.status !== 'resolved' && full.status !== 'closed' && (
                        <>
                          <select className="select" style={{ width: 'auto', flex: 1 }} onChange={e => e.target.value && handleStatusUpdate(e.target.value)} defaultValue="">
                            <option value="">Change Status...</option>
                            {['open','assigned','in_progress','resolved','closed'].map(s => (
                              <option key={s} value={s}>{s.replace('_', ' ')}</option>
                            ))}
                          </select>
                          <select className="select" style={{ width: 'auto', flex: 1 }} onChange={e => e.target.value && handleStatusUpdate(null, e.target.value)} defaultValue="">
                            <option value="">Change Priority...</option>
                            {['critical','high','medium','low'].map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                          <button className="btn btn-secondary btn-sm" onClick={handleReassign} disabled={reassigning}>
                            {reassigning ? <span className="spinner-sm spinner" /> : <RefreshCw size={13} />}
                            Reassign
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tab === 'Work Log' && (
                <div>
                  {full.work_log ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span className="badge badge-neutral">{full.work_log.service_type?.replace('_', ' ')}</span>
                        {full.work_log.time_spent_minutes > 0 && (
                          <span className="badge badge-neutral">{full.work_log.time_spent_minutes} min</span>
                        )}
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>by {full.work_log.operator_name} on {new Date(full.work_log.created_at).toLocaleDateString()}</span>
                      </div>
                      {[
                        { label: 'Diagnosis', value: full.work_log.diagnosis },
                        { label: 'Resolution', value: full.work_log.resolution },
                        full.work_log.parts_changed !== 'N/A' && { label: 'Parts Changed', value: full.work_log.parts_changed },
                        full.work_log.notes && { label: 'Notes', value: full.work_log.notes },
                      ].filter(Boolean).map(item => (
                        <div key={item.label}>
                          <div className="detail-label">{item.label}</div>
                          <div style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <ClipboardList size={32} className="empty-state-icon" />
                      <div className="empty-state-title">No work log yet</div>
                      <div className="empty-state-sub">The service report will appear here after the ticket is resolved by an agent.</div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'History' && (
                <div>
                  {full.assignment_history?.length > 0 ? (
                    <div>
                      {full.assignment_history.map((log, i) => (
                        <div key={i} className="timeline-event">
                          <div className="timeline-dot" style={{ background: 'var(--accent)' }} />
                          <div className="timeline-content">
                            <div className="timeline-type">Assigned to {log.operator_name || 'Unknown'}</div>
                            <div className="timeline-meta">{new Date(log.assigned_at).toLocaleString()} - Score: {log.score} - {log.reason}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Activity size={32} className="empty-state-icon" />
                      <div className="empty-state-title">No assignment history</div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'Feedback' && (
                <div>
                  {full.feedback ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)' }}>
                        <Stars rating={full.feedback.rating} />
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16 }}>{full.feedback.rating}/5</span>
                      </div>
                      {full.feedback.comment && (
                        <div>
                          <div className="detail-label">Comment</div>
                          <div style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', fontSize: 13.5, fontStyle: 'italic', color: 'var(--text-2)' }}>
                            "{full.feedback.comment}"
                          </div>
                        </div>
                      )}
                    </div>
                  ) : isEmployee && isResolved ? (
                    <form onSubmit={handleFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <div className="detail-label" style={{ marginBottom: 10 }}>How was your experience?</div>
                        <div className="stars" style={{ gap: 8 }}>
                          {[1, 2, 3, 4, 5].map(i => (
                            <button
                              key={i} type="button"
                              onClick={() => setFeedbackRating(i)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                            >
                              <Star
                                size={28}
                                color={i <= feedbackRating ? 'var(--amber)' : 'var(--border-strong)'}
                                fill={i <= feedbackRating ? 'var(--amber)' : 'none'}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Comment (optional)</label>
                        <textarea className="textarea" placeholder="Tell us more about your experience..." value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} rows={3} />
                      </div>
                      <button type="submit" className="btn btn-primary" disabled={feedbackLoading || !feedbackRating}>
                        {feedbackLoading ? <span className="spinner spinner-sm" /> : <><Star size={14} />Submit Feedback</>}
                      </button>
                    </form>
                  ) : (
                    <div className="empty-state">
                      <Star size={32} className="empty-state-icon" />
                      <div className="empty-state-title">No feedback yet</div>
                      <div className="empty-state-sub">{isResolved ? 'Feedback will appear once the user submits a rating.' : 'Feedback is available after the ticket is resolved.'}</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
