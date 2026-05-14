import { useEffect, useState } from 'react'
import { Crown, Eye, Key, Plus, Trash2, X } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'

function CreateManagerModal({ API, addToast, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await API.post('/superadmin/managers', form)
      const creds = data.data?.credentials
      addToast(`${data.data.manager.name} created${creds ? ` - Password: ${creds.password}` : ''}`, 'success')
      onCreated(); onClose()
    } catch (err) { addToast(getFriendlyErrorMessage(err, 'Failed to create manager'), 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Create Admin Account</div>
          <button className="close-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Full Name <span style={{ color: 'var(--red)' }}>*</span></label>
              <input className="input" placeholder="Manager Name" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email <span style={{ color: 'var(--red)' }}>*</span></label>
              <input className="input" type="email" placeholder="manager@company.com" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password (optional)</label>
              <input className="input" type="text" placeholder="Auto-generated if blank" value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner spinner-sm" /> : <Plus size={14} />}Create Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SuperAdminDashboard({ API, addToast, onSelectManager }) {
  const [overview, setOverview] = useState(null)
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [resettingId, setResettingId] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [ovRes, mgRes] = await Promise.all([
        API.get('/superadmin/overview'),
        API.get('/superadmin/managers'),
      ])
      setOverview(ovRes.data.data)
      setManagers(mgRes.data.data || [])
    } catch (err) { addToast(getFriendlyErrorMessage(err, 'Failed to load'), 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleDelete = async (mgr) => {
    if (!confirm(`Remove manager ${mgr.name}?`)) return
    setDeletingId(mgr.id)
    try {
      await API.delete(`/superadmin/managers/${mgr.id}`)
      addToast(`${mgr.name} removed`, 'success')
      fetchData()
    } catch (err) { addToast(getFriendlyErrorMessage(err, 'Failed to delete'), 'error') }
    finally { setDeletingId(null) }
  }

  const handleReset = async (mgr) => {
    setResettingId(mgr.id)
    try {
      const { data } = await API.post(`/superadmin/managers/${mgr.id}/reset-password`)
      addToast(`Password: ${data.data?.credentials?.password}`, 'success')
    } catch (err) { addToast(getFriendlyErrorMessage(err, 'Reset failed'), 'error') }
    finally { setResettingId(null) }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="spinner spinner-lg" /></div>
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title"><Crown size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Super Admin Console</div>
          <div className="section-sub">System-wide overview and manager management</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} />Create Admin</button>
      </div>

      {/* System overview */}
      {overview && (
        <div className="stat-grid" style={{ marginBottom: 28 }}>
          {[
            { label: 'Total Managers', value: overview.total_managers, color: 'var(--accent-2)', bg: 'var(--accent-dim)' },
            { label: 'Total Agents', value: overview.total_operators, color: 'var(--blue)', bg: 'var(--blue-dim)' },
            { label: 'Total Users', value: overview.total_employees, color: 'var(--green)', bg: 'var(--green-dim)' },
            { label: 'Total Tickets', value: overview.total_tickets, color: 'var(--purple)', bg: 'var(--purple-dim)' },
            { label: 'Open Tickets', value: overview.open_tickets, color: 'var(--amber)', bg: 'var(--amber-dim)' },
            { label: 'Online Agents', value: overview.online_agents, color: overview.online_agents > 0 ? 'var(--green)' : 'var(--red)', bg: overview.online_agents > 0 ? 'var(--green-dim)' : 'var(--red-dim)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-card-label">{s.label}</div>
              <div className="stat-card-value" style={{ color: s.color, background: 'none' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* System health */}
      {overview && (
        <div className="card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: overview.system_health === 'operational' ? 'var(--green)' : 'var(--red)', boxShadow: `0 0 8px ${overview.system_health === 'operational' ? 'var(--green)' : 'var(--red)'}`, animation: 'pulse 2s infinite' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>System {overview.system_health === 'operational' ? 'Operational' : 'Degraded'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{overview.online_agents} agent{overview.online_agents !== 1 ? 's' : ''} currently online</div>
          </div>
        </div>
      )}

      {/* Manager list */}
      <div className="section-header">
        <div className="section-title">Admin Accounts</div>
      </div>
      {managers.length === 0 ? (
        <div className="empty-state card">
          <Crown size={32} className="empty-state-icon" />
          <div className="empty-state-title">No admin accounts yet</div>
          <div className="empty-state-sub">Create an admin account to get started with ticket management.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {managers.map(mgr => (
            <div key={mgr.id} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, color: '#fff', flexShrink: 0 }}>
                  {mgr.name?.charAt(0)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mgr.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mgr.email}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { label: 'Users', value: mgr.employee_count || 0 },
                  { label: 'Agents', value: mgr.operator_count || 0 },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, minWidth: 80, padding: '8px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 18, color: 'var(--accent-2)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onSelectManager(mgr.id, mgr.name)}>
                  <Eye size={13} />View Context
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleReset(mgr)} disabled={resettingId === mgr.id} title="Reset password">
                  {resettingId === mgr.id ? <span className="spinner spinner-sm" /> : <Key size={13} />}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(mgr)} disabled={deletingId === mgr.id} title="Delete admin">
                  {deletingId === mgr.id ? <span className="spinner spinner-sm" /> : <Trash2 size={13} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateManagerModal API={API} addToast={addToast} onClose={() => setShowCreate(false)} onCreated={fetchData} />
      )}
    </div>
  )
}
