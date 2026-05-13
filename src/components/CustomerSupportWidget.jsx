import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, X } from 'lucide-react'

export default function CustomerSupportWidget({ currentUser, API, addToast }) {
  const [open, setOpen] = useState(false)
  const [tickets, setTickets] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [unread, setUnread] = useState(0)
  const [lastSeen, setLastSeen] = useState(0)
  const bottomRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    (async () => {
      try {
        const { data } = await API.get('/tickets')
        const active = (data.data || []).filter(t => !['closed'].includes(t.status))
        setTickets(active)
        if (active.length > 0 && !selectedId) setSelectedId(active[0].id)
      } catch { /* silent */ }
    })()
  }, [API])

  const fetchMessages = async () => {
    if (!selectedId) return
    try {
      const { data } = await API.get(`/chat/${selectedId}/messages`)
      const msgs = data.data || []
      setMessages(msgs)
      if (!open) {
        const agentMsgs = msgs.filter(m => m.sender_type === 'agent' && !m.is_internal_note)
        const newCount = agentMsgs.filter(m => new Date(m.created_at).getTime() > lastSeen).length
        setUnread(newCount)
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchMessages()
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(fetchMessages, 5000)
    return () => clearInterval(pollRef.current)
  }, [selectedId, open])

  useEffect(() => {
    if (open) {
      setUnread(0)
      setLastSeen(Date.now())
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [open, messages])

  const sendMessage = async () => {
    if (!input.trim() || !selectedId) return
    setSending(true)
    try {
      await API.post(`/chat/${selectedId}/messages`, { content: input.trim(), sender_type: 'customer' })
      setInput('')
      await fetchMessages()
    } catch { addToast('Failed to send message', 'error') }
    finally { setSending(false) }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const selected = tickets.find(t => t.id === selectedId)

  return (
    <>
      {open && (
        <div className="csw-panel">
          <div className="csw-header">
            <div>
              <div className="csw-header-title">Support Chat</div>
              <div className="csw-header-sub">{selected ? selected.title : 'Select a ticket'}</div>
            </div>
            <button className="csw-close" onClick={() => setOpen(false)}><X size={14} /></button>
          </div>

          {tickets.length > 1 && (
            <div className="csw-ticket-select">
              <select className="select" style={{ fontSize: 12 }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                {tickets.map(t => (
                  <option key={t.id} value={t.id}>{t.display_id} - {t.title.slice(0, 40)}</option>
                ))}
              </select>
            </div>
          )}

          <div className="csw-messages">
            {messages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-3)', fontSize: 12.5, textAlign: 'center', padding: '20px 0' }}>
                <MessageSquare size={24} style={{ opacity: 0.3 }} />
                <span>No messages yet.<br />Send a message to start.</span>
              </div>
            ) : messages.map(msg => (
              <div key={msg._id} className={`csw-msg ${msg.sender_type === 'agent' ? 'from-agent' : 'from-customer'}`}>
                <div className="csw-sender">{msg.sender_name}</div>
                <div className="csw-bubble">{msg.content}</div>
                <div className="csw-time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="csw-input-area">
            <input
              placeholder={selectedId ? 'Type a message...' : 'Select a ticket first'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={!selectedId}
            />
            <button className="csw-send" onClick={sendMessage} disabled={!input.trim() || !selectedId || sending}>
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      <button className="csw-trigger" onClick={() => setOpen(v => !v)} title="Open Support Chat">
        {open ? <X size={20} color="#fff" /> : <MessageSquare size={20} color="#fff" />}
        {!open && unread > 0 && <span className="csw-unread">{unread > 9 ? '9+' : unread}</span>}
      </button>
    </>
  )
}
