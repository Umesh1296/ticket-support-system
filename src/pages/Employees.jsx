import { useEffect, useState } from 'react'
import { Key, Plus, RefreshCw, Trash2, UserRound, X } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'

function CreateEmployeeModal({ API, addToast, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await API.post('/employees', form)
      const creds = data.data?.credentials
      addToast(`${data.data.employee.name} added${creds ? ` — Password: ${creds.password}` : ''}`, 'success')
      onCreated()
      onClose()
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Failed to create employee'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add End User</div>
          <button className="close-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Full Name <span style={{ color: 'var(--red)' }}>*</span></label>
              <input className="input" placeholder="John Smith" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email <span style={{ color: 'var(--red)' }}>*</span></label>
              <input className="input" type="email" placeholder="john@company.com" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password (optional)</label>
              <input className="input" type="text" placeholder="Auto-generated if blank" value={form.password} onChange={e => set('password', e.target.value)} />
              <span className="form-hint">Leave blank to auto-generate (shown after creation)</span>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner spinner-sm" /> : <Plus size={14} />}Add User
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Employees({ API, addToast, onRefresh, refreshKey }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [resettingId, setResettingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const { data } = await API.get('/employees')
      setEmployees(data.data || [])
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Failed to load employees'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEmployees() }, [refreshKey])

  const handleResetPassword = async (emp) => {
    setResettingId(emp.id)
    try {
      const { data } = await API.post(`/employees/${emp.id}/reset-password`)
      const pw = data.data?.credentials?.password
      addToast(`Password reset: ${pw}`, 'success')
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Reset failed'), 'error')
    } finally {
      setResettingId(null)
    }
  }

  const handleDelete = async (emp) => {
    if (!confirm(`Remove ${emp.name}? Their ticket history will be retained.`)) return
    setDeletingId(emp.id)
    try {
      await API.delete(`/employees/${emp.id}`)
      addToast(`${emp.name} removed`, 'success')
      fetchEmployees()
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
          <div className="section-title"><UserRound size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />End Users</div>
          <div className="section-sub">{employees.length} user{employees.length !== 1 ? 's' : ''} managed</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchEmployees}><RefreshCw size={13} /></button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} />Add User</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="spinner spinner-lg" /></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Display ID</th>
                <th>Tickets</th>
                <th>Active</th>
                <th>Resolved</th>
                <th>Last Ticket</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr className="table-empty"><td colSpan={7}>No end users yet. Add one to get started.</td></tr>
              ) : employees.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'var(--accent-2)', flexShrink: 0 }}>
                        {emp.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>{emp.display_id}</span></td>
                  <td><span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{emp.total_tickets}</span></td>
                  <td><span style={{ fontFamily: 'var(--mono)', color: emp.active_tickets > 0 ? 'var(--amber)' : 'var(--text-3)' }}>{emp.active_tickets}</span></td>
                  <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--green)' }}>{emp.resolved_tickets}</span></td>
                  <td style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                    {emp.last_ticket_at ? new Date(emp.last_ticket_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => handleResetPassword(emp)} disabled={resettingId === emp.id} title="Reset password">
                        {resettingId === emp.id ? <span className="spinner spinner-sm" /> : <Key size={11} />}
                      </button>
                      <button className="btn btn-danger btn-xs" onClick={() => handleDelete(emp)} disabled={deletingId === emp.id} title="Remove user">
                        {deletingId === emp.id ? <span className="spinner spinner-sm" /> : <Trash2 size={11} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateEmployeeModal
          API={API} addToast={addToast}
          onClose={() => setShowCreate(false)}
          onCreated={fetchEmployees}
        />
      )}
    </div>
  )
}
