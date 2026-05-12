import { useEffect, useState } from 'react'
import { Settings, Shield, Sliders } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'

export default function ManagerSettings({ API, addToast, user, onAccountDeleted }) {
  const [slaRules, setSlaRules] = useState([])
  const [routing, setRouting] = useState(null)
  const [savingSLA, setSavingSLA] = useState(false)
  const [savingRouting, setSavingRouting] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const [slaRes, routingRes] = await Promise.all([
          API.get('/settings/sla'),
          API.get('/settings/routing'),
        ])
        setSlaRules(slaRes.data.data || [])
        setRouting(routingRes.data.data)
      } catch (err) {
        addToast(getFriendlyErrorMessage(err, 'Failed to load settings'), 'error')
      }
    })()
  }, [])

  const updateSLA = (priority, hours) => {
    setSlaRules(rules => rules.map(r => r.priority === priority ? { ...r, hours_limit: parseFloat(hours) || r.hours_limit } : r))
  }

  const saveSLA = async () => {
    setSavingSLA(true)
    try {
      const { data } = await API.put('/settings/sla', { rules: slaRules })
      setSlaRules(data.data)
      addToast('SLA rules saved', 'success')
    } catch (err) { addToast(getFriendlyErrorMessage(err, 'Failed to save SLA'), 'error') }
    finally { setSavingSLA(false) }
  }

  const setRouteField = (k, v) => setRouting(r => ({ ...r, [k]: v }))

  const saveRouting = async () => {
    setSavingRouting(true)
    try {
      const { data } = await API.put('/settings/routing', routing)
      setRouting(data.data)
      addToast('Routing config saved', 'success')
    } catch (err) { addToast(getFriendlyErrorMessage(err, 'Failed to save routing'), 'error') }
    finally { setSavingRouting(false) }
  }

  const priorityOrder = ['critical', 'high', 'medium', 'low']
  const sortedRules = [...slaRules].sort((a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority))

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title"><Settings size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Settings</div>
          <div className="section-sub">SLA rules, routing configuration, and account management</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* SLA Rules */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={15} /> SLA Rules
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>Configure resolution time targets per priority level</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveSLA} disabled={savingSLA}>
              {savingSLA ? <span className="spinner spinner-sm" /> : null}Save SLA Rules
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedRules.map(rule => (
              <div key={rule.priority} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)' }}>
                <span className={`badge badge-${rule.priority}`} style={{ minWidth: 72, justifyContent: 'center' }}>{rule.priority}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{rule.description || `${rule.priority} priority tickets`}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number" min="0.5" step="0.5"
                    value={rule.hours_limit}
                    onChange={e => updateSLA(rule.priority, e.target.value)}
                    style={{ width: 72, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-card)', color: 'var(--text-1)', fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, textAlign: 'center', outline: 'none' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>hours</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Routing Config */}
        {routing && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sliders size={15} /> Auto-Routing Configuration
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>Control how tickets are automatically assigned to agents</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={saveRouting} disabled={savingRouting}>
                {savingRouting ? <span className="spinner spinner-sm" /> : null}Save Routing
              </button>
            </div>
            <div>
              {[
                { key: 'skill_routing_enabled', label: 'Skill-Based Routing', sub: 'Prioritize agents whose skills match the ticket category' },
                { key: 'load_balancing_enabled', label: 'Load Balancing', sub: 'Prefer agents with lighter workloads for fair distribution' },
                { key: 'priority_boost_enabled', label: 'Priority Boost', sub: 'Give critical tickets a scoring boost for faster assignment' },
              ].map(item => (
                <div key={item.key} className="settings-row">
                  <div>
                    <div className="settings-row-label">{item.label}</div>
                    <div className="settings-row-sub">{item.sub}</div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={!!routing[item.key]} onChange={e => setRouteField(item.key, e.target.checked)} />
                    <div className="toggle-track" />
                    <div className="toggle-thumb" />
                  </label>
                </div>
              ))}
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Global Max Ticket Load</div>
                  <div className="settings-row-sub">Default maximum tickets per agent if not individually set</div>
                </div>
                <input
                  type="number" min="1" max="20"
                  value={routing.max_load_global || 5}
                  onChange={e => setRouteField('max_load_global', parseInt(e.target.value) || 5)}
                  style={{ width: 72, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-secondary)', color: 'var(--text-1)', fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, textAlign: 'center', outline: 'none' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Account */}
        {user?.role === 'manager' && (
          <div className="card" style={{ borderColor: 'rgba(239,68,68,0.15)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Danger Zone</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 14 }}>These actions are permanent and cannot be undone.</div>
            <button
              className="btn btn-danger"
              disabled={deletingAccount}
              onClick={async () => {
                if (!confirm('Delete your manager account? This cannot be undone.')) return
                setDeletingAccount(true)
                try {
                  await API.delete('/superadmin/managers/me')
                  onAccountDeleted?.()
                } catch {
                  addToast('Contact your Super Admin to delete your account', 'error')
                } finally { setDeletingAccount(false) }
              }}
            >
              Delete Manager Account
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
