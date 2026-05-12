import { Activity, AlertTriangle, CheckCircle, Clock, Ticket, TrendingUp, Users, Zap } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import SLACountdown from '../components/SLACountdown.jsx'
import { formatCategoryLabel } from '../lib/taxonomy.js'

function StatCard({ icon: Icon, label, value, sub, color, bg, delay = 0 }) {
  return (
    <div className="stat-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="stat-card-top">
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-icon" style={{ background: bg }}>
          <Icon size={16} color={color} />
        </div>
      </div>
      <div className="stat-card-value" style={{ color }}>{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  )
}

const PRIORITY_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981',
}

export default function Dashboard({ stats }) {
  if (!stats) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320, gap: 14 }}>
        <span className="spinner spinner-lg" />
        <span style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading dashboard...</span>
      </div>
    )
  }

  const { overview, sla, tickets_by_status, tickets_by_priority, tickets_by_category, operators, recent_tickets, recent_assignments, daily_tickets, top_operators, assignment_overview } = stats

  const totalPriority = tickets_by_priority?.reduce((s, x) => s + x.count, 0) || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stat Cards */}
      <div className="stat-grid">
        <StatCard icon={Ticket} label="Total Tickets" value={overview.total_tickets} sub={`${overview.open_tickets} open`} color="var(--accent-2)" bg="var(--accent-dim)" delay={0} />
        <StatCard icon={Clock} label="In Progress" value={overview.in_progress_tickets} sub={`${overview.assigned_tickets} assigned`} color="var(--amber)" bg="var(--amber-dim)" delay={60} />
        <StatCard icon={CheckCircle} label="Resolved" value={overview.resolved_tickets} sub="total closed" color="var(--green)" bg="var(--green-dim)" delay={120} />
        <StatCard icon={AlertTriangle} label="SLA Breached" value={sla.breached} sub={`${sla.compliance_rate}% compliance`} color={sla.breached > 0 ? 'var(--red)' : 'var(--text-3)'} bg={sla.breached > 0 ? 'var(--red-dim)' : 'var(--bg-secondary)'} delay={180} />
        <StatCard icon={Users} label="Agents Online" value={operators.available} sub={`${operators.total} total`} color="var(--green)" bg="var(--green-dim)" delay={240} />
        <StatCard icon={TrendingUp} label="SLA Compliance" value={`${sla.compliance_rate}%`} sub={`${sla.at_risk} at risk`} color={sla.compliance_rate >= 90 ? 'var(--green)' : sla.compliance_rate >= 70 ? 'var(--amber)' : 'var(--red)'} bg={sla.compliance_rate >= 90 ? 'var(--green-dim)' : sla.compliance_rate >= 70 ? 'var(--amber-dim)' : 'var(--red-dim)'} delay={300} />
      </div>

      {/* Charts Row */}
      <div className="dashboard-grid">
        {/* 7-day chart */}
        <div className="chart-card">
          <div className="chart-title">
            <Activity size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Ticket Volume — Last 7 Days
          </div>
          {daily_tickets?.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={daily_tickets} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickFormatter={d => new Date(d).toLocaleDateString([], { weekday: 'short' })} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={d => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--accent)">
                  {daily_tickets.map((_, i) => <Cell key={i} fill="var(--accent)" fillOpacity={0.75 + i * 0.03} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 13 }}>No data yet</div>
          )}
        </div>

        {/* Priority breakdown */}
        <div className="chart-card">
          <div className="chart-title">Priority Breakdown</div>
          <div style={{ paddingTop: 8 }}>
            {['critical', 'high', 'medium', 'low'].map(p => {
              const item = tickets_by_priority?.find(x => x.priority === p)
              const count = item?.count || 0
              const pct = Math.round((count / totalPriority) * 100)
              return (
                <div key={p} className="priority-bar-row">
                  <div className="priority-bar-label" style={{ textTransform: 'capitalize', fontSize: 12.5 }}>{p}</div>
                  <div className="priority-bar-track">
                    <div className="priority-bar-fill" style={{ width: `${pct}%`, background: PRIORITY_COLORS[p] }} />
                  </div>
                  <div className="priority-bar-count" style={{ color: PRIORITY_COLORS[p] }}>{count}</div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 20 }}>
            <div className="chart-title" style={{ fontSize: 13, marginBottom: 10 }}>Agent Status</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Available', value: operators.available, color: 'var(--green)', bg: 'var(--green-dim)' },
                { label: 'Busy', value: operators.busy, color: 'var(--amber)', bg: 'var(--amber-dim)' },
                { label: 'Offline', value: operators.offline, color: 'var(--text-3)', bg: 'var(--bg-secondary)' },
              ].map(o => (
                <div key={o.label} style={{ flex: 1, padding: '10px', background: o.bg, borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 800, color: o.color }}>{o.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{o.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Operators */}
      {top_operators?.length > 0 && (
        <div className="card">
          <div className="section-header">
            <div>
              <div className="section-title"><Zap size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Top Agents</div>
              <div className="section-sub">Ranked by tickets resolved</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {top_operators.map((op, i) => (
              <div key={op.name} style={{ flex: 1, minWidth: 140, padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', border: i === 0 ? '1px solid var(--accent-glow)' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? 'var(--accent-dim)' : 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: i === 0 ? 'var(--accent-2)' : 'var(--text-3)' }}>
                    #{i + 1}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.name}</div>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 800, color: 'var(--accent-2)' }}>{op.total_resolved}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>tickets resolved</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Tickets */}
      {recent_tickets?.length > 0 && (
        <div className="card">
          <div className="section-header">
            <div>
              <div className="section-title">Recent Tickets</div>
              <div className="section-sub">Latest 5 tickets across all categories</div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Agent</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {recent_tickets.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{t.display_id} • {t.reporter_name}</div>
                    </td>
                    <td><span className={`badge badge-${t.priority}`}>{t.priority}</span></td>
                    <td><span className={`badge badge-${t.status}`}>{t.status.replace('_', ' ')}</span></td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{t.operator_name || '—'}</td>
                    <td><SLACountdown deadline={t.sla_deadline} status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Assignments */}
      {recent_assignments?.length > 0 && (
        <div className="card">
          <div className="section-header">
            <div>
              <div className="section-title">Recent Auto-Assignments</div>
              <div className="section-sub">Latest smart routing decisions</div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Assigned To</th>
                  <th>Score</th>
                  <th>Assigned At</th>
                </tr>
              </thead>
              <tbody>
                {recent_assignments.map((a, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.ticket_title}</div>
                      <span className={`badge badge-${a.priority}`} style={{ fontSize: 10 }}>{a.priority}</span>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{a.operator_name}</td>
                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent-2)' }}>{a.score}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                      {new Date(a.assigned_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
