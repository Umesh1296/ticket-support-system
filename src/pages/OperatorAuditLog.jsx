import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardCheck, RefreshCw } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'

const EVENT_COLORS = {
  ticket_accepted: 'var(--blue)',
  ticket_resolved: 'var(--green)',
  ticket_closed: 'var(--purple)',
  ticket_transferred: 'var(--amber)',
  ticket_missed: 'var(--red)',
  feedback_submitted: 'var(--cyan)',
  status_change: 'var(--text-3)',
  login: 'var(--green)',
  logout: 'var(--text-3)',
}

const SERVICE_TYPE_LABELS = {
  replacement: 'Replacement', repair: 'Repair', configuration: 'Configuration',
  software_fix: 'Software Fix', inspection: 'Inspection', other: 'Other',
}

function Stars({ n }) {
  return (
    <span style={{ color: 'var(--amber)', fontSize: 14 }}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  )
}

export default function OperatorAuditLog({ API, addToast }) {
  const [operators, setOperators] = useState([])
  const [stats, setStats] = useState([])
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('Timeline')
  const [timeline, setTimeline] = useState([])
  const [transcripts, setTranscripts] = useState([])
  const [worklogs, setWorklogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [expandedTicket, setExpandedTicket] = useState(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const { data } = await API.get('/audit/operators')
        setStats(data.data || [])
        if (data.data?.length > 0) setSelected(data.data[0])
      } catch (err) { addToast(getFriendlyErrorMessage(err, 'Failed to load audit'), 'error') }
      finally { setLoading(false) }
    })()
  }, [])

  useEffect(() => {
    if (!selected) return
    fetchDetail(selected.id)
  }, [selected, tab])

  const fetchDetail = async (id) => {
    setDetailLoading(true)
    try {
      if (tab === 'Timeline') {
        const { data } = await API.get(`/audit/operators/${id}/timeline`)
        setTimeline(data.data || [])
      } else if (tab === 'Transcripts') {
        const { data } = await API.get(`/audit/operators/${id}/transcripts`)
        setTranscripts(data.data || [])
      } else if (tab === 'Work Logs') {
        const { data } = await API.get(`/audit/operators/${id}/worklogs`)
        setWorklogs(data.data || [])
      }
    } catch { /* silent */ }
    finally { setDetailLoading(false) }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <span className="spinner spinner-lg" />
      </div>
    )
  }

  const selectedStat = stats.find(s => s.id === selected?.id)

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title"><ClipboardCheck size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Operator Audit Log</div>
          <div className="section-sub">Performance tracking, chat transcripts, and service reports</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => selected && fetchDetail(selected.id)}><RefreshCw size={13} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: Operator list */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Agents ({stats.length})
          </div>
          {stats.length === 0 ? (
            <div style={{ padding: '20px 14px', fontSize: 13, color: 'var(--text-3)' }}>No agents found</div>
          ) : stats.map(op => (
            <button
              key={op.id}
              onClick={() => setSelected(op)}
              style={{
                width: '100%', textAlign: 'left', padding: '12px 14px',
                border: 'none', borderBottom: '1px solid var(--border)',
                background: selected?.id === op.id ? 'var(--accent-dim)' : 'transparent',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: 'var(--blue)', flexShrink: 0 }}>
                  {op.name?.charAt(0)}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: selected?.id === op.id ? 'var(--accent-2)' : 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{op.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{op.display_id}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-3)' }}>
                <span>{op.tickets_resolved} resolved</span>
                {op.avg_csat && <span>⭐ {op.avg_csat}</span>}
              </div>
            </button>
          ))}
        </div>

        {/* Right: Detail panel */}
        <div>
          {!selected ? (
            <div className="card empty-state"><div className="empty-state-title">Select an agent</div></div>
          ) : (
            <>
              {/* Summary stats */}
              {selectedStat && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Accepted', value: selectedStat.tickets_accepted, color: 'var(--blue)' },
                    { label: 'Resolved', value: selectedStat.tickets_resolved, color: 'var(--green)' },
                    { label: 'Closed', value: selectedStat.tickets_closed, color: 'var(--purple)' },
                    { label: 'Transferred', value: selectedStat.tickets_transferred, color: 'var(--amber)' },
                    { label: 'Missed', value: selectedStat.tickets_missed, color: 'var(--red)' },
                    { label: 'Avg Resolution', value: selectedStat.avg_resolution_time_label, color: 'var(--text-1)' },
                    { label: 'Avg CSAT', value: selectedStat.avg_csat ? `${selectedStat.avg_csat}/5` : 'N/A', color: 'var(--amber)' },
                  ].map(m => (
                    <div key={m.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabs */}
              <div className="audit-tabs" style={{ marginBottom: 16 }}>
                {['Timeline', 'Transcripts', 'Work Logs'].map(t => (
                  <button key={t} className={`audit-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
                ))}
              </div>

              <div className="card" style={{ padding: 20 }}>
                {detailLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><span className="spinner" /></div>
                ) : (
                  <>
                    {tab === 'Timeline' && (
                      timeline.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-title">No events recorded</div></div>
                      ) : (
                        <div>
                          {timeline.map((ev, i) => (
                            <div key={i} className="timeline-event">
                              <div className="timeline-dot" style={{ background: EVENT_COLORS[ev.event_type] || 'var(--text-3)' }} />
                              <div className="timeline-content">
                                <div className="timeline-type">{ev.event_type.replace(/_/g, ' ')}</div>
                                {ev.ticket_title && <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>{ev.ticket_title}</div>}
                                {ev.details && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{ev.details}</div>}
                                {ev.csat_score && <div style={{ marginTop: 4 }}><Stars n={ev.csat_score} /></div>}
                                <div className="timeline-meta">{new Date(ev.created_at).toLocaleString()}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}

                    {tab === 'Transcripts' && (
                      transcripts.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-title">No transcripts yet</div></div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {transcripts.map(tc => (
                            <div key={tc.ticket_id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                              <button
                                onClick={() => setExpandedTicket(expandedTicket === tc.ticket_id ? null : tc.ticket_id)}
                                style={{ width: '100%', padding: '12px 14px', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                              >
                                <div style={{ textAlign: 'left' }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{tc.ticket_title}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{tc.messages?.length || 0} messages</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span className={`badge badge-${tc.ticket_priority}`}>{tc.ticket_priority}</span>
                                  {expandedTicket === tc.ticket_id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </div>
                              </button>
                              {expandedTicket === tc.ticket_id && (
                                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {tc.messages?.map((m, j) => (
                                    <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: m.sender_type === 'agent' ? 'flex-end' : 'flex-start' }}>
                                      <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginBottom: 2 }}>{m.sender_name}</div>
                                      <div style={{
                                        padding: '7px 11px', borderRadius: 10, fontSize: 12.5,
                                        background: m.sender_type === 'agent' ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                                        color: m.sender_type === 'agent' ? 'var(--accent-2)' : 'var(--text-1)',
                                        border: '1px solid var(--border)', maxWidth: '75%',
                                      }}>
                                        {m.content}
                                      </div>
                                      <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    )}

                    {tab === 'Work Logs' && (
                      worklogs.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-title">No work logs yet</div></div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {worklogs.map((wl, i) => (
                            <div key={i} style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <span className="badge badge-neutral">{SERVICE_TYPE_LABELS[wl.service_type] || wl.service_type}</span>
                                  {wl.time_spent_minutes > 0 && <span className="badge badge-neutral">{wl.time_spent_minutes} min</span>}
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{new Date(wl.created_at).toLocaleDateString()}</span>
                              </div>
                              {[
                                { label: 'Diagnosis', value: wl.diagnosis },
                                { label: 'Resolution', value: wl.resolution },
                                wl.parts_changed && wl.parts_changed !== 'N/A' && { label: 'Parts Changed', value: wl.parts_changed },
                                wl.notes && { label: 'Notes', value: wl.notes },
                              ].filter(Boolean).map(item => (
                                <div key={item.label} style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{item.label}</div>
                                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{item.value}</div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
