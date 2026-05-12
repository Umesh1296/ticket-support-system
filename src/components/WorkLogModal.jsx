import { useState } from 'react'
import { ClipboardList, X } from 'lucide-react'

const SERVICE_TYPES = [
  { value: 'replacement', label: 'Replacement' },
  { value: 'repair', label: 'Repair' },
  { value: 'configuration', label: 'Configuration' },
  { value: 'software_fix', label: 'Software Fix' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
]

export default function WorkLogModal({ ticket, onSubmit, onClose, loading }) {
  const [form, setForm] = useState({
    diagnosis: '',
    resolution: '',
    service_type: 'configuration',
    parts_changed: '',
    time_spent_minutes: '',
    notes: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.diagnosis.trim() || !form.resolution.trim()) return
    onSubmit({
      diagnosis: form.diagnosis.trim(),
      resolution: form.resolution.trim(),
      service_type: form.service_type,
      parts_changed: form.parts_changed.trim() || 'N/A',
      time_spent_minutes: parseInt(form.time_spent_minutes) || 0,
      notes: form.notes.trim(),
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--r-md)', background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={16} color="var(--green)" />
            </div>
            <div>
              <div className="modal-title">Service Report</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                Required before resolving: {ticket?.display_id || ticket?.title}
              </div>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '10px 14px', background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--r-md)', fontSize: 12.5, color: 'var(--amber)' }}>
              This service report will be filed as part of the audit trail and visible to the manager.
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Service Type <span style={{ color: 'var(--red)' }}>*</span></label>
                <select className="select" value={form.service_type} onChange={e => set('service_type', e.target.value)}>
                  {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Time Spent (minutes)</label>
                <input className="input" type="number" min="0" placeholder="e.g. 45" value={form.time_spent_minutes} onChange={e => set('time_spent_minutes', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Diagnosis <span style={{ color: 'var(--red)' }}>*</span></label>
              <textarea className="textarea" placeholder="What was the root cause of the issue? Describe what you found..." value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)} required rows={3} />
            </div>

            <div className="form-group">
              <label className="form-label">Resolution Steps <span style={{ color: 'var(--red)' }}>*</span></label>
              <textarea className="textarea" placeholder="How did you fix it? List the steps taken to resolve the issue..." value={form.resolution} onChange={e => set('resolution', e.target.value)} required rows={3} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Parts / Items Changed</label>
                <input className="input" placeholder="e.g. Monitor cable, RAM module" value={form.parts_changed} onChange={e => set('parts_changed', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Additional Notes</label>
                <input className="input" placeholder="Optional follow-up notes..." value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !form.diagnosis.trim() || !form.resolution.trim()}>
              {loading ? <><span className="spinner spinner-sm" />Saving...</> : 'Resolve & File Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
