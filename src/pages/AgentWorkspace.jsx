import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle, BookOpen, Bot, CheckCircle, ChevronDown, CircleDot,
  Coffee, Headset, MessageSquare, Moon, Send, Settings, Shield, Ticket, User, X, Zap
} from 'lucide-react'
import WorkLogModal from '../components/WorkLogModal.jsx'
import SLACountdown from '../components/SLACountdown.jsx'
import AccountPasswordPanel from '../components/AccountPasswordPanel.jsx'
import { TicketFlowLogo } from '../components/Brand.jsx'
import { getFriendlyErrorMessage } from '../lib/api.js'
import { formatCategoryLabel } from '../lib/taxonomy.js'

const STATUS_CONFIG = {
  available: { color: 'var(--green)', icon: CircleDot, label: 'Available' },
  busy: { color: 'var(--amber)', icon: Coffee, label: 'On Break' },
  offline: { color: 'var(--text-3)', icon: Moon, label: 'Offline' },
}

const PRIORITY_BORDER = {
  critical: 'var(--red)', high: 'var(--amber)', medium: 'var(--blue)', low: 'var(--green)',
}

export default function AgentWorkspace({ API, addToast, currentUser, onSignOut }) {
  const [profile, setProfile] = useState(null)
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [cannedResponses, setCannedResponses] = useState([])
  const [serviceHistory, setServiceHistory] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatMode, setChatMode] = useState('reply')
  const [showCanned, setShowCanned] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('available')
  const [workLogModal, setWorkLogModal] = useState(null)
  const [workLogLoading, setWorkLogLoading] = useState(false)
  const [newTicketIds, setNewTicketIds] = useState(new Set())
  const [transferModal, setTransferModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [queueSearch, setQueueSearch] = useState('')
  const pollRef = useRef(null)
  const msgPollRef = useRef(null)
  const bottomRef = useRef(null)
  const prevTicketIds = useRef(new Set())

  // Fetch own profile
  useEffect(() => {
    (async () => {
      try {
        const { data } = await API.get('/operators/me')
        setProfile(data.data)
        setStatus(data.data.status || 'available')
      } catch { /* silent */ }
    })()
  }, [])

  // Fetch canned responses once
  useEffect(() => {
    (async () => {
      try {
        const { data } = await API.get('/chat/canned-responses/list')
        setCannedResponses(data.data || [])
      } catch { /* silent */ }
    })()
  }, [])

  // Poll tickets every 10s
  const fetchTickets = async () => {
    try {
      const { data } = await API.get('/tickets')
      const all = data.data || []
      const mine = all.filter(t => t.assigned_to === currentUser?.id && t.status !== 'closed')
      const newIds = new Set(mine.map(t => t.id))
      const incoming = [...newIds].filter(id => !prevTicketIds.current.has(id))
      if (incoming.length > 0) {
        setNewTicketIds(new Set(incoming))
        addToast(`${incoming.length} new ticket${incoming.length > 1 ? 's' : ''} assigned!`, 'info')
        setTimeout(() => setNewTicketIds(new Set()), 8000)
      }
      prevTicketIds.current = newIds
      setTickets(mine)
      if (!selectedTicket && mine.length > 0) setSelectedTicket(mine[0])
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchTickets()
    pollRef.current = setInterval(fetchTickets, 10000)
    return () => clearInterval(pollRef.current)
  }, [])

  // Poll messages every 5s
  const fetchMessages = async () => {
    if (!selectedTicket) return
    try {
      const { data } = await API.get(`/chat/${selectedTicket.id}/messages`)
      setMessages(data.data || [])
    } catch { /* silent */ }
  }

  useEffect(() => {
    setMessages([])
    fetchMessages()
    if (msgPollRef.current) clearInterval(msgPollRef.current)
    msgPollRef.current = setInterval(fetchMessages, 5000)
    return () => clearInterval(msgPollRef.current)
  }, [selectedTicket?.id])

  // Fetch service history when ticket changes
  useEffect(() => {
    if (!selectedTicket?.reporter_user_id) return
    ;(async () => {
      try {
        const { data } = await API.get('/tickets')
        const history = (data.data || [])
          .filter(t => t.reporter_user_id === selectedTicket.reporter_user_id && t.id !== selectedTicket.id && (t.status === 'resolved' || t.status === 'closed'))
          .slice(0, 5)
        setServiceHistory(history)
      } catch { /* silent */ }
    })()
  }, [selectedTicket?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const updateStatus = async (s) => {
    setStatus(s)
    try {
      await API.put('/operators/me/status', { status: s })
      setProfile(p => p ? { ...p, status: s } : p)
    } catch { addToast('Status update failed', 'error') }
  }

  const sendMessage = async () => {
    if (!chatInput.trim() || !selectedTicket) return
    setSending(true)
    try {
      await API.post(`/chat/${selectedTicket.id}/messages`, {
        content: chatInput.trim(),
        sender_type: 'agent',
        is_internal_note: chatMode === 'note',
      })
      setChatInput('')
      await fetchMessages()
    } catch { addToast('Failed to send message', 'error') }
    finally { setSending(false) }
  }

  const handleChatKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleStartWork = async () => {
    try {
      await API.put(`/tickets/${selectedTicket.id}`, { status: 'in_progress' })
      setSelectedTicket(t => ({ ...t, status: 'in_progress' }))
      setTickets(ts => ts.map(t => t.id === selectedTicket.id ? { ...t, status: 'in_progress' } : t))
      addToast('Ticket started', 'success')
    } catch (err) { addToast(getFriendlyErrorMessage(err, 'Failed to start'), 'error') }
  }

  const handleResolveClick = () => {
    if (selectedTicket.status !== 'in_progress') {
      addToast('Start working on the ticket first', 'error')
      return
    }
    setWorkLogModal(selectedTicket)
  }

  const handleWorkLogSubmit = async (workLog) => {
    setWorkLogLoading(true)
    try {
      await API.put(`/tickets/${workLogModal.id}`, { status: 'resolved', work_log: workLog })
      setSelectedTicket(t => ({ ...t, status: 'resolved' }))
      setTickets(ts => ts.filter(t => t.id !== workLogModal.id))
      setWorkLogModal(null)
      addToast('Ticket resolved and work log filed!', 'success')
      await fetchTickets()
      setSelectedTicket(null)
    } catch (err) { addToast(getFriendlyErrorMessage(err, 'Failed to resolve'), 'error') }
    finally { setWorkLogLoading(false) }
  }

  const handleClose = async () => {
    if (!confirm('Close this ticket?')) return
    try {
      await API.put(`/tickets/${selectedTicket.id}`, { status: 'closed' })
      setTickets(ts => ts.filter(t => t.id !== selectedTicket.id))
      setSelectedTicket(null)
      addToast('Ticket closed', 'success')
    } catch (err) { addToast(getFriendlyErrorMessage(err, 'Failed to close'), 'error') }
  }

  const handleTransfer = async () => {
    try {
      await API.post(`/tickets/${selectedTicket.id}/reassign`)
      addToast('Ticket transferred via auto-assignment', 'success')
      setTickets(ts => ts.filter(t => t.id !== selectedTicket.id))
      setSelectedTicket(null)
    } catch (err) { addToast(getFriendlyErrorMessage(err, 'Transfer failed'), 'error') }
  }

  const filteredTickets = tickets.filter(t =>
    !queueSearch || t.title.toLowerCase().includes(queueSearch.toLowerCase()) || (t.reporter_name || '').toLowerCase().includes(queueSearch.toLowerCase())
  )
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const po = { critical: 0, high: 1, medium: 2, low: 3 }
    if (po[a.priority] !== po[b.priority]) return po[a.priority] - po[b.priority]
    return new Date(a.sla_deadline) - new Date(b.sla_deadline)
  })

  const statusCfg = STATUS_CONFIG[status]

  return (
    <div className="agent-ws">
      {/* Top Nav */}
      <div className="agent-ws-topnav">
        <TicketFlowLogo subtitle="Agent workspace" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Status toggle */}
          <div className="agent-status-group">
            {Object.entries(STATUS_CONFIG).map(([s, cfg]) => {
              const Icon = cfg.icon
              return (
                <button
                  key={s}
                  className={`agent-status-btn ${status === s ? 'active' : ''}`}
                  style={{ '--status-color': cfg.color }}
                  onClick={() => updateStatus(s)}
                >
                  <Icon size={12} color={status === s ? cfg.color : 'var(--text-3)'} />
                  {cfg.label}
                </button>
              )
            })}
          </div>

          {/* Load indicator */}
          {profile && (
            <div className="agent-load-indicator">
              <Ticket size={12} color="var(--text-3)" />
              <span className="agent-load-count">{profile.current_load}</span>
              <span className="agent-load-divider">/</span>
              <span className="agent-load-max">{profile.max_load}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>tickets</span>
            </div>
          )}

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
          <button className="icon-btn" onClick={() => setShowSettings(true)} title="Account settings">
            <Settings size={15} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: 'var(--accent-2)' }}>
              {currentUser?.name?.charAt(0)}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{currentUser?.name?.split(' ')[0]}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onSignOut} title="Sign out">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="agent-ws-body">
        {/* LEFT: Queue */}
        <div className="agent-ws-queue">
          <div className="agent-queue-header">
            <h3>My Queue</h3>
            <span className="agent-queue-count">{tickets.length}</span>
          </div>
          <div className="agent-queue-search">
            <Ticket size={12} className="agent-queue-search-icon" style={{ top: '50%', left: 20 }} />
            <input placeholder="Filter tickets..." value={queueSearch} onChange={e => setQueueSearch(e.target.value)} />
          </div>
          <div className="agent-queue-list">
            {sortedTickets.length === 0 ? (
              <div className="agent-queue-empty">
                <Headset size={28} style={{ opacity: 0.25 }} />
                <span>No tickets assigned{queueSearch ? ' matching filter' : ''}.</span>
                {!queueSearch && <span style={{ fontSize: 11 }}>New tickets will appear here automatically.</span>}
              </div>
            ) : sortedTickets.map(t => (
              <button
                key={t.id}
                className={`agent-queue-item ${selectedTicket?.id === t.id ? 'active' : ''} ${newTicketIds.has(t.id) ? 'new-assignment' : ''}`}
                onClick={() => setSelectedTicket(t)}
              >
                <div className="agent-queue-item-top">
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span className={`badge badge-${t.priority}`} style={{ fontSize: 10 }}>{t.priority}</span>
                    <span className={`badge badge-${t.status}`} style={{ fontSize: 10 }}>{t.status.replace('_', ' ')}</span>
                  </div>
                  <SLACountdown deadline={t.sla_deadline} status={t.status} />
                </div>
                <div className="agent-queue-title">{t.title}</div>
                <div className="agent-queue-name">{t.reporter_name} - {formatCategoryLabel(t.category)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* CENTER: Chat */}
        <div className="agent-ws-chat">
          {!selectedTicket ? (
            <div className="agent-chat-empty">
              <MessageSquare size={40} style={{ opacity: 0.2 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>Select a ticket</div>
              <div style={{ fontSize: 12 }}>Choose a ticket from your queue to start chatting</div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="agent-chat-header">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>{selectedTicket.display_id}</span>
                    <span className={`badge badge-${selectedTicket.priority}`} style={{ fontSize: 10 }}>{selectedTicket.priority}</span>
                    <span className={`badge badge-${selectedTicket.status}`} style={{ fontSize: 10 }}>{selectedTicket.status.replace('_', ' ')}</span>
                    <SLACountdown deadline={selectedTicket.sla_deadline} status={selectedTicket.status} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedTicket.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, color: 'var(--text-3)', fontSize: 12, flexWrap: 'wrap' }}>
                    <span>{selectedTicket.reporter_name}</span>
                    <span>Owner: {currentUser?.name}</span>
                    <span>{formatCategoryLabel(selectedTicket.category)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {selectedTicket.status === 'assigned' && (
                    <button className="btn btn-primary btn-sm" onClick={handleStartWork}>
                      <Zap size={12} />Start
                    </button>
                  )}
                  {selectedTicket.status === 'in_progress' && (
                    <button className="btn btn-sm" style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.2)' }} onClick={handleResolveClick}>
                      <CheckCircle size={12} />Resolve
                    </button>
                  )}
                  {(selectedTicket.status === 'resolved') && (
                    <button className="btn btn-secondary btn-sm" onClick={handleClose}>
                      Close
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={handleTransfer} title="Transfer ticket">
                    <Shield size={12} />Transfer
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="agent-chat-messages">
                {messages.filter(m => !m.is_internal_note || chatMode === 'note').length === 0 && (
                  <div className="agent-chat-empty" style={{ flex: 'none', padding: '20px 0' }}>
                    <MessageSquare size={24} style={{ opacity: 0.2 }} />
                    <span style={{ fontSize: 12 }}>No messages yet. Send a greeting!</span>
                  </div>
                )}
                {messages.map(msg => (
                  msg.is_internal_note ? (
                    <div key={msg._id} className="agent-chat-msg internal-note">
                      <div className="internal-note-badge"><BookOpen size={10} />Internal Note</div>
                      <div className="agent-chat-bubble">{msg.content}</div>
                      <div className="agent-chat-time">{msg.sender_name} - {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ) : (
                    <div key={msg._id} className={`agent-chat-msg ${msg.sender_type === 'agent' ? 'outgoing' : 'incoming'}`}>
                      <div className="agent-chat-sender">{msg.sender_name}</div>
                      <div className="agent-chat-bubble">{msg.content}</div>
                      <div className="agent-chat-time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  )
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="agent-chat-input-area">
                <div className="agent-ai-strip">
                  <Bot size={14} />
                  <span>
                    AI draft: acknowledge the customer, state the next diagnostic step, and keep the SLA timer explicit.
                  </span>
                  <button
                    className="btn btn-secondary btn-xs"
                    type="button"
                    onClick={() => setChatInput('Thanks for the details. I am reviewing the issue now and will keep this ticket moving before the SLA window closes.')}
                  >
                    Use draft
                  </button>
                </div>
                <div className="agent-chat-tabs">
                  <button className={`agent-chat-tab ${chatMode === 'reply' ? 'active' : ''}`} onClick={() => setChatMode('reply')}>
                    <MessageSquare size={12} />Reply
                  </button>
                  <button className={`agent-chat-tab ${chatMode === 'note' ? 'active' : ''}`} onClick={() => setChatMode('note')}>
                    <BookOpen size={12} />Internal Note
                  </button>
                </div>
                <div className={`agent-chat-compose ${chatMode === 'note' ? 'note-mode' : ''}`}>
                  <textarea
                    rows={2}
                    placeholder={chatMode === 'note' ? 'Add an internal note (not visible to customer)...' : 'Type a reply...'}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={handleChatKey}
                  />
                  <div className="agent-chat-compose-actions" style={{ position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => setShowCanned(v => !v)}>
                        <BookOpen size={11} />Canned <ChevronDown size={10} />
                      </button>
                      {showCanned && (
                        <div className="canned-dropdown">
                          {cannedResponses.length === 0 ? (
                            <div className="canned-empty">No canned responses</div>
                          ) : cannedResponses.map(cr => (
                            <button key={cr._id || cr.title} className="canned-item" onClick={() => { setChatInput(cr.content); setShowCanned(false) }}>
                              <div className="canned-title">{cr.title}</div>
                              <div className="canned-preview">{cr.content}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={sendMessage} disabled={!chatInput.trim() || sending}>
                      {sending ? <span className="spinner spinner-sm" /> : <Send size={13} />}
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Context */}
        <div className="agent-ws-context">
          {!selectedTicket ? (
            <div className="context-empty">
              <div style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>
                <User size={28} style={{ opacity: 0.2, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                Select a ticket to see customer details
              </div>
            </div>
          ) : (
            <>
              {/* AI summary */}
              <div className="context-section">
                <div className="context-section-title"><Bot size={11} />AI Summary</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5, background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                  {selectedTicket.priority === 'critical'
                    ? 'Critical ticket with elevated SLA risk. Keep updates short, visible, and action-oriented.'
                    : 'Ticket context is ready. Use the conversation, customer history, and category to resolve quickly.'}
                </div>
              </div>

              {/* Lifecycle */}
              <div className="context-section">
                <div className="context-section-title"><Shield size={11} />Lifecycle</div>
                <div className="ticket-lifecycle-mini">
                  {['open', 'assigned', 'in_progress', 'resolved'].map(step => (
                    <span key={step} className={selectedTicket.status === step ? 'active' : ''}>{step.replace('_', ' ')}</span>
                  ))}
                </div>
              </div>

              {/* Customer */}
              <div className="context-section">
                <div className="context-section-title"><User size={11} />Customer</div>
                <div className="context-profile-card">
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: 'var(--accent-2)', flexShrink: 0 }}>
                    {selectedTicket.reporter_name?.charAt(0)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedTicket.reporter_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedTicket.reporter_email}</div>
                  </div>
                </div>
              </div>

              {/* Ticket Details */}
              <div className="context-section">
                <div className="context-section-title"><Ticket size={11} />Ticket Info</div>
                {[
                  { label: 'ID', value: selectedTicket.display_id },
                  { label: 'Category', value: formatCategoryLabel(selectedTicket.category) },
                  { label: 'Priority', value: <span className={`badge badge-${selectedTicket.priority}`}>{selectedTicket.priority}</span> },
                  { label: 'SLA', value: <SLACountdown deadline={selectedTicket.sla_deadline} status={selectedTicket.status} /> },
                  { label: 'Created', value: new Date(selectedTicket.created_at).toLocaleDateString() },
                ].map(row => (
                  <div key={row.label} className="context-var-row">
                    <span>{row.label}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div className="context-section">
                <div className="context-section-title"><AlertCircle size={11} />Issue Description</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5, background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 'var(--r-md)' }}>
                  {selectedTicket.description}
                </div>
              </div>

              {/* Service History */}
              <div className="context-section">
                <div className="context-section-title"><BookOpen size={11} />Service History</div>
                {serviceHistory.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic' }}>No previous tickets</div>
                ) : serviceHistory.map(prev => (
                  <div key={prev.id} className="context-order-item" style={{ borderLeftColor: PRIORITY_BORDER[prev.priority] || 'var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prev.title}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className={`badge badge-${prev.priority}`} style={{ fontSize: 10 }}>{prev.priority}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(prev.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Attachments */}
              <div className="context-section">
                <div className="context-section-title"><AlertCircle size={11} />Attachments</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>No attachments added to this ticket.</div>
              </div>

              {/* Workflow actions */}
              <div className="context-section">
                <div className="context-section-title"><Zap size={11} />Workflow</div>
                <div className="context-actions">
                  {selectedTicket.status === 'assigned' && (
                    <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={handleStartWork}>
                      <Zap size={12} />Start Working
                    </button>
                  )}
                  {selectedTicket.status === 'in_progress' && (
                    <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.2)' }} onClick={handleResolveClick}>
                      <CheckCircle size={12} />Resolve Ticket
                    </button>
                  )}
                  {selectedTicket.status === 'resolved' && (
                    <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={handleClose}>
                      Close Ticket
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={handleTransfer}>
                    <Shield size={12} />Transfer / Escalate
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {workLogModal && (
        <WorkLogModal
          ticket={workLogModal}
          onClose={() => setWorkLogModal(null)}
          onSubmit={handleWorkLogSubmit}
          loading={workLogLoading}
        />
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Account Settings</div>
              <button className="close-btn" onClick={() => setShowSettings(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <AccountPasswordPanel API={API} addToast={addToast} compact />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
