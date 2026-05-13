import { useEffect, useState } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'

export default function AssignmentLogs({ API, addToast, refreshKey }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const { data } = await API.get('/dashboard/stats')
      const assignments = data.data?.recent_assignments || []
      setLogs(assignments)
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Failed to load logs'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [refreshKey])

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title"><Activity size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Assignment Logs</div>
          <div className="section-sub">Auto-routing decisions with scoring breakdown</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchLogs}><RefreshCw size={13} /></button>
      </div>

      {loading ? (
        <div className="empty-state card"><span className="spinner spinner-lg" /><div className="empty-state-title">Loading routing feed</div></div>
      ) : logs.length === 0 ? (
        <div className="empty-state card">
          <Activity size={34} className="empty-state-icon" />
          <div className="empty-state-title">No assignment decisions yet</div>
          <div className="empty-state-sub">Create tickets to trigger smart assignment scoring.</div>
        </div>
      ) : (
        <div className="routing-feed">
          {logs.map((log, i) => (
            <div key={i} className="routing-feed-item">
              <div className="timeline-dot" style={{ background: log.priority === 'critical' ? 'var(--red)' : 'var(--accent)' }} />
              <div className="routing-feed-content">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div className="resource-title">{log.ticket_title}</div>
                    <div className="resource-subtitle">Assigned to {log.operator_name}</div>
                  </div>
                  <span className={`badge badge-${log.priority}`}>{log.priority}</span>
                </div>
                <div className="resource-metrics" style={{ marginTop: 12 }}>
                  <div><strong>{log.score ?? '-'}</strong><span>Score</span></div>
                  <div><strong>{log.priority}</strong><span>Priority</span></div>
                  <div><strong>{new Date(log.assigned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong><span>Assigned</span></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
