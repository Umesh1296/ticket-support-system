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
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="spinner spinner-lg" /></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Priority</th>
                <th>Assigned To</th>
                <th>Score</th>
                <th>Assigned At</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr className="table-empty"><td colSpan={5}>No assignment logs yet. Create tickets to trigger auto-assignment.</td></tr>
              ) : logs.map((log, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{log.ticket_title}</div>
                  </td>
                  <td><span className={`badge badge-${log.priority}`}>{log.priority}</span></td>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{log.operator_name}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 800, color: 'var(--accent-2)' }}>
                      {log.score ?? '—'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>/115</span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                    {new Date(log.assigned_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
