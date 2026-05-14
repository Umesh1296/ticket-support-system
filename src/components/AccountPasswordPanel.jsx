import { useState } from 'react'
import { KeyRound, Save } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'

export default function AccountPasswordPanel({ API, addToast, compact = false }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (form.newPassword.length < 8) {
      addToast('New password must be at least 8 characters', 'error')
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      addToast('New passwords do not match', 'error')
      return
    }

    setSaving(true)
    try {
      await API.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      addToast('Password changed successfully', 'success')
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Could not change password'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700 }}>
          <KeyRound size={15} /> Account Password
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>
          Change the password used for this TicketFlow account.
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <label className="form-group">
          <span className="form-label">Current password</span>
          <input
            className="input"
            type="password"
            value={form.currentPassword}
            onChange={event => set('currentPassword', event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="form-group">
          <span className="form-label">New password</span>
          <input
            className="input"
            type="password"
            value={form.newPassword}
            onChange={event => set('newPassword', event.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </label>
        <label className="form-group">
          <span className="form-label">Confirm password</span>
          <input
            className="input"
            type="password"
            value={form.confirmPassword}
            onChange={event => set('confirmPassword', event.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </label>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
            {saving ? <span className="spinner spinner-sm" /> : <Save size={13} />}
            Save password
          </button>
        </div>
      </form>
    </div>
  )
}
