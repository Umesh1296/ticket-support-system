import { useState } from 'react'
import { Bot, Sparkles, X } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'

export default function CreateTicketModal({ API, currentUser, onClose, onSuccess, onError }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) { onError('Title and description are required'); return }
    setLoading(true)
    try {
      const { data } = await API.post('/tickets', { title: title.trim(), description: description.trim() })
      const msg = data.message || 'Ticket created successfully'
      onSuccess(msg)
    } catch (err) {
      onError(getFriendlyErrorMessage(err, 'Failed to create ticket'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">New Support Ticket</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Category and priority will be auto-detected</div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'var(--accent-dim)', borderRadius: 'var(--r-md)', border: '1px solid var(--accent-glow)', alignItems: 'flex-start' }}>
              <Bot size={16} color="var(--accent-2)" style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
                Just describe your issue. TicketFlow will automatically classify the category and priority.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Issue Title <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                className="input"
                placeholder="e.g. My monitor is flickering and causing eye strain"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required maxLength={120}
                autoFocus
              />
              <span className="form-hint">{title.length}/120 characters</span>
            </div>

            <div className="form-group">
              <label className="form-label">Description <span style={{ color: 'var(--red)' }}>*</span></label>
              <textarea
                className="textarea"
                placeholder="Describe the problem in detail. Include when it started, what you were doing, and any error messages you see..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                required rows={5}
                style={{ minHeight: 120 }}
              />
              <span className="form-hint">{description.length} characters</span>
            </div>

            <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={13} color="var(--purple)" />
              <span>An available support agent will be automatically assigned based on skills and availability.</span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !title.trim() || !description.trim()}>
              {loading ? <><span className="spinner spinner-sm" />Submitting...</> : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
