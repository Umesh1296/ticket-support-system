import { useEffect, useState } from 'react'
import { FileText, X } from 'lucide-react'
import SLACountdown from './SLACountdown.jsx'

export default function ReportsModal({ API, addToast, onClose }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const { data } = await API.get('/tickets/reports')
        setReports(data.data || [])
      } catch { addToast('Failed to load reports', 'error') }
      finally { setLoading(false) }
    })()
  }, [API])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: 'var(--blue-dim)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={16} color="var(--blue)" />
            </div>
            <div>
              <div className="modal-title">Closure Reports</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{reports.length} resolved tickets</div>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><span className="spinner" /></div>
          ) : reports.length === 0 ? (
            <div className="empty-state" style={{ padding: 60 }}>
              <FileText size={32} className="empty-state-icon" />
              <div className="empty-state-title">No closed tickets yet</div>
              <div className="empty-state-sub">Reports appear here once tickets are resolved and closed.</div>
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Reporter</th>
                    <th>Agent</th>
                    <th>Resolved</th>
                    <th>SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{r.ticket?.title || '-'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                          {r.ticket?.display_id} - <span className={`badge badge-${r.ticket?.priority}`} style={{ fontSize: 10 }}>{r.ticket?.priority}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12.5 }}>{r.reporter_name}</td>
                      <td style={{ fontSize: 12.5 }}>{r.operator_name || '-'}</td>
                      <td style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>
                        {new Date(r.resolved_at).toLocaleDateString()}
                      </td>
                      <td>
                        {r.sla_status && (
                          <span style={{
                            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                            color: r.sla_status.status === 'met' ? 'var(--green)' : 'var(--red)',
                          }}>
                            {r.sla_status.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
