import { useEffect, useState } from 'react'
import { Key, Plus, RefreshCw, Trash2, Users, X } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'
import { formatCategoryLabel } from '../lib/taxonomy.js'

function normalizeSkillValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
}

function parseSkillEntries(value) {
  const nextSkills = []
  const seen = new Set()

  for (const chunk of String(value || '').split(/[,\n]+/)) {
    const normalized = normalizeSkillValue(chunk)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    nextSkills.push(normalized)
  }

  return nextSkills
}

function mergeSkills(currentSkills, incomingSkills) {
  const nextSkills = []
  const seen = new Set()

  for (const skill of [...(currentSkills || []), ...(incomingSkills || [])]) {
    const normalized = normalizeSkillValue(skill)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    nextSkills.push(normalized)
  }

  return nextSkills
}

function CreateOperatorModal({ API, addToast, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', skills: [], max_load: 5, status: 'available' })
  const [skillInput, setSkillInput] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addSkillEntries = (rawValue = skillInput) => {
    const nextSkills = mergeSkills(form.skills, parseSkillEntries(rawValue))
    if (nextSkills.length === form.skills.length) {
      if (rawValue === skillInput) setSkillInput('')
      return nextSkills
    }

    set('skills', nextSkills)
    if (rawValue === skillInput) setSkillInput('')
    return nextSkills
  }

  const removeSkill = (skillToRemove) => {
    set('skills', form.skills.filter(skill => skill !== skillToRemove))
  }

  const handleSkillKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (!skillInput.trim()) return
      e.preventDefault()
      addSkillEntries()
      return
    }

    if (e.key === 'Backspace' && !skillInput && form.skills.length) {
      removeSkill(form.skills[form.skills.length - 1])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const normalizedSkills = mergeSkills(form.skills, parseSkillEntries(skillInput))
    if (!normalizedSkills.length) { addToast('Add at least one skill', 'error'); return }

    set('skills', normalizedSkills)
    setSkillInput('')
    setLoading(true)
    try {
      const { data } = await API.post('/operators', { ...form, skills: normalizedSkills })
      const creds = data.data?.credentials
      addToast(`${data.data.operator.name} added${creds ? ` - Password: ${creds.password}` : ''}`, 'success')
      onCreated()
      onClose()
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Failed to create agent'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add Support Agent</div>
          <button className="close-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name <span style={{ color: 'var(--red)' }}>*</span></label>
                <input className="input" placeholder="Agent Name" value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email <span style={{ color: 'var(--red)' }}>*</span></label>
                <input className="input" type="email" placeholder="agent@company.com" value={form.email} onChange={e => set('email', e.target.value)} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Max Ticket Load</label>
                <input className="input" type="number" min="1" max="20" value={form.max_load} onChange={e => set('max_load', parseInt(e.target.value, 10) || 5)} />
              </div>
              <div className="form-group">
                <label className="form-label">Initial Status</label>
                <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password (optional)</label>
              <input className="input" type="text" placeholder="Auto-generated if blank" value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Support Skills <span style={{ color: 'var(--red)' }}>*</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 28 }}>
                  {form.skills.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--text-4)' }}>No skills added yet</span>
                  ) : form.skills.map(skill => (
                    <span
                      key={skill}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 10px',
                        borderRadius: 'var(--r-full)',
                        background: 'var(--accent-dim)',
                        color: 'var(--accent-2)',
                        border: '1px solid var(--accent-glow)',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {formatCategoryLabel(skill)}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        aria-label={`Remove ${skill}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    className="input"
                    placeholder="Type a skill and press Enter or comma"
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                    onBlur={() => {
                      if (skillInput.trim()) addSkillEntries()
                    }}
                    style={{ flex: '1 1 240px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => addSkillEntries()}
                    disabled={!skillInput.trim()}
                    style={{ justifyContent: 'center', minWidth: 96 }}
                  >
                    Add Skill
                  </button>
                </div>
              </div>
              <span className="form-hint">Add skills as tags or comma-separated entries. Example: billing, vpn, software installation</span>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner spinner-sm" /> : <Plus size={14} />}Add Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Operators({ API, addToast, onRefresh, refreshKey }) {
  const [operators, setOperators] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [resettingId, setResettingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const fetchOperators = async () => {
    setLoading(true)
    try {
      const { data } = await API.get('/operators')
      setOperators(data.data || [])
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Failed to load agents'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOperators() }, [refreshKey])

  const handleReset = async (op) => {
    setResettingId(op.id)
    try {
      const { data } = await API.post(`/operators/${op.id}/reset-password`)
      addToast(`Password reset: ${data.data?.credentials?.password}`, 'success')
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Reset failed'), 'error')
    } finally {
      setResettingId(null)
    }
  }

  const handleDelete = async (op) => {
    if (!confirm(`Remove ${op.name}? Active tickets will be reassigned.`)) return
    setDeletingId(op.id)
    try {
      const { data } = await API.delete(`/operators/${op.id}`)
      addToast(data.message || `${op.name} removed`, 'success')
      fetchOperators()
      onRefresh?.()
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Delete failed'), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title"><Users size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Support Agents</div>
          <div className="section-sub">{operators.length} agent{operators.length !== 1 ? 's' : ''} configured</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchOperators}><RefreshCw size={13} /></button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} />Add Agent</button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state card"><span className="spinner spinner-lg" /><div className="empty-state-title">Loading agents</div></div>
      ) : operators.length === 0 ? (
        <div className="empty-state card">
          <Users size={34} className="empty-state-icon" />
          <div className="empty-state-title">No agents configured</div>
          <div className="empty-state-sub">Add support agents to start routing work by skill and capacity.</div>
        </div>
      ) : (
        <div className="resource-grid">
          {operators.map(op => (
            <div key={op.id} className="resource-card card-hover">
              <div className="resource-card-head">
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--blue-dim)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 760, flexShrink: 0 }}>
                  {op.name?.charAt(0) || '?'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="resource-title">{op.name}</div>
                  <div className="resource-subtitle">{op.email}</div>
                </div>
                <span className={`badge badge-${op.status}`}>{op.status}</span>
              </div>

              <div className="resource-load">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--text-3)', fontSize: 12, marginBottom: 6 }}>
                  <span>{op.display_id}</span>
                  <span style={{ fontFamily: 'var(--mono)' }}>{op.current_load}/{op.max_load} - {op.load_percentage}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${op.load_percentage}%`,
                    background: op.load_percentage >= 90 ? 'var(--red)' : op.load_percentage >= 60 ? 'var(--amber)' : 'var(--green)',
                  }} />
                </div>
              </div>

              <div className="skill-list">
                {(op.skills || []).length === 0 ? (
                  <span style={{ color: 'var(--text-4)', fontSize: 12 }}>No skills</span>
                ) : (op.skills || []).map(skill => (
                  <span key={skill} className="skill-tag">{formatCategoryLabel(skill)}</span>
                ))}
              </div>

              <div className="resource-footer">
                <span>{op.current_load >= op.max_load ? 'At capacity' : 'Ready for work'}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-xs" onClick={() => handleReset(op)} disabled={resettingId === op.id} title="Reset password">
                    {resettingId === op.id ? <span className="spinner spinner-sm" /> : <Key size={12} />}
                  </button>
                  <button className="btn btn-danger btn-xs" onClick={() => handleDelete(op)} disabled={deletingId === op.id} title="Remove agent">
                    {deletingId === op.id ? <span className="spinner spinner-sm" /> : <Trash2 size={12} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateOperatorModal API={API} addToast={addToast} onClose={() => setShowCreate(false)} onCreated={fetchOperators} />
      )}
    </div>
  )
}
