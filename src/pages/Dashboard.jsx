import { Activity, AlertTriangle, CheckCircle2, Clock3, Headset, Ticket, TrendingUp, Zap } from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import SLACountdown from '../components/SLACountdown.jsx'
import { formatCategoryLabel } from '../lib/taxonomy.js'

const PRIORITY_COLORS = {
  critical: '#dc2626',
  high: '#d97706',
  medium: '#2563eb',
  low: '#059669',
}

function MetricCard({ icon: Icon, label, value, sub, color, bg, delay = 0 }) {
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

function OperationalItem({ ticket }) {
  return (
    <div className="ops-list-item" style={{ padding: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 760, color: 'var(--text-1)' }}>{ticket.title}</div>
          <div className="ticket-card-meta" style={{ marginTop: 6 }}>
            <span style={{ fontFamily: 'var(--mono)' }}>{ticket.display_id}</span>
            <span>{ticket.reporter_name}</span>
            {ticket.category && <span>{formatCategoryLabel(ticket.category)}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className={`badge badge-${ticket.priority}`}>{ticket.priority}</span>
          <span className={`badge badge-${ticket.status}`}>{ticket.status?.replace('_', ' ')}</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 12 }}>
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{ticket.operator_name || 'Unassigned'}</span>
        <SLACountdown deadline={ticket.sla_deadline} status={ticket.status} />
      </div>
    </div>
  )
}

export default function Dashboard({ stats }) {
  if (!stats) {
    return (
      <div className="empty-state card">
        <span className="spinner spinner-lg" />
        <div className="empty-state-title">Loading operational health</div>
      </div>
    )
  }

  const {
    overview = {},
    sla = {},
    tickets_by_priority = [],
    operators = {},
    recent_tickets = [],
    recent_assignments = [],
    daily_tickets = [],
    top_operators = [],
  } = stats

  const totalPriority = tickets_by_priority.reduce((sum, item) => sum + item.count, 0) || 1
  const complianceTone = sla.compliance_rate >= 90 ? 'var(--green)' : sla.compliance_rate >= 70 ? 'var(--amber)' : 'var(--red)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="stat-grid">
        <MetricCard
          icon={Ticket}
          label="Needs action"
          value={(overview.open_tickets || 0) + (overview.assigned_tickets || 0)}
          sub={`${overview.in_progress_tickets || 0} in progress`}
          color="var(--blue)"
          bg="var(--blue-dim)"
        />
        <MetricCard
          icon={AlertTriangle}
          label="SLA risk"
          value={sla.breached || 0}
          sub={`${sla.at_risk || 0} at risk`}
          color={(sla.breached || 0) > 0 ? 'var(--red)' : 'var(--text-3)'}
          bg={(sla.breached || 0) > 0 ? 'var(--red-dim)' : 'var(--bg-secondary)'}
          delay={60}
        />
        <MetricCard
          icon={Headset}
          label="Agent capacity"
          value={operators.available || 0}
          sub={`${operators.total || 0} total agents`}
          color="var(--green)"
          bg="var(--green-dim)"
          delay={120}
        />
        <MetricCard
          icon={TrendingUp}
          label="SLA compliance"
          value={`${sla.compliance_rate ?? 0}%`}
          sub="rolling operations score"
          color={complianceTone}
          bg={sla.compliance_rate >= 90 ? 'var(--green-dim)' : sla.compliance_rate >= 70 ? 'var(--amber-dim)' : 'var(--red-dim)'}
          delay={180}
        />
      </div>

      <div className="dashboard-grid">
        <div className="chart-card">
          <div className="chart-title"><Activity size={16} /> Ticket volume, last 7 days</div>
          {daily_tickets.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={daily_tickets} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                  tickFormatter={d => new Date(d).toLocaleDateString([], { weekday: 'short' })}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)' }}
                  labelFormatter={d => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {daily_tickets.map((_, i) => (
                    <Cell key={i} fill={i === daily_tickets.length - 1 ? '#8b5cf6' : '#52525b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ minHeight: 230 }}>
              <Activity size={28} className="empty-state-icon" />
              <div className="empty-state-title">No trend data yet</div>
            </div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-title"><Clock3 size={16} /> Priority and capacity</div>
          {['critical', 'high', 'medium', 'low'].map(priority => {
            const item = tickets_by_priority.find(x => x.priority === priority)
            const count = item?.count || 0
            const pct = Math.round((count / totalPriority) * 100)
            return (
              <div key={priority} className="priority-bar-row">
                <div className="priority-bar-label" style={{ textTransform: 'capitalize' }}>{priority}</div>
                <div className="priority-bar-track">
                  <div className="priority-bar-fill" style={{ width: `${pct}%`, background: PRIORITY_COLORS[priority] }} />
                </div>
                <div className="priority-bar-count" style={{ color: PRIORITY_COLORS[priority] }}>{count}</div>
              </div>
            )
          })}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 18 }}>
            {[
              { label: 'Available', value: operators.available || 0, color: 'var(--green)', bg: 'var(--green-dim)' },
              { label: 'Busy', value: operators.busy || 0, color: 'var(--amber)', bg: 'var(--amber-dim)' },
              { label: 'Offline', value: operators.offline || 0, color: 'var(--text-3)', bg: 'var(--bg-secondary)' },
            ].map(item => (
              <div key={item.label} style={{ padding: 12, borderRadius: 'var(--r-md)', background: item.bg, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 760, color: item.color }}>{item.value}</div>
                <div style={{ color: 'var(--text-3)', fontSize: 11 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {top_operators.length > 0 && (
        <div className="card">
          <div className="section-header">
            <div>
              <div className="section-title"><Zap size={16} /> Team performance</div>
              <div className="section-sub">Resolution throughput by support agent</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
            {top_operators.map((agent, index) => (
              <div key={agent.name} className="resource-card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: index === 0 ? 'var(--accent-dim)' : 'var(--bg-secondary)', color: index === 0 ? 'var(--accent-2)' : 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 760 }}>
                    {index + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 760, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: 12 }}>{agent.total_resolved} resolved</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="card">
          <div className="section-header">
            <div>
              <div className="section-title"><Ticket size={16} /> Tickets needing attention</div>
              <div className="section-sub">Newest work across priority and SLA windows</div>
            </div>
          </div>
          <div className="ops-list">
            {recent_tickets.length === 0 ? (
              <div className="empty-state">
                <CheckCircle2 size={32} className="empty-state-icon" />
                <div className="empty-state-title">No recent tickets</div>
              </div>
            ) : recent_tickets.map(ticket => (
              <OperationalItem key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <div>
              <div className="section-title"><Zap size={16} /> Smart assignment feed</div>
              <div className="section-sub">Latest routing decisions and scores</div>
            </div>
          </div>
          <div className="ops-list">
            {recent_assignments.length === 0 ? (
              <div className="empty-state">
                <Zap size={32} className="empty-state-icon" />
                <div className="empty-state-title">No routing decisions yet</div>
              </div>
            ) : recent_assignments.map((assignment, index) => (
              <div className="ops-list-item" key={`${assignment.ticket_title}-${index}`} style={{ padding: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 760 }}>{assignment.ticket_title}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 5 }}>Assigned to {assignment.operator_name}</div>
                  </div>
                  <span className={`badge badge-${assignment.priority}`}>{assignment.priority}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent-2)', fontWeight: 760 }}>Score {assignment.score ?? '-'}</span>
                  <span style={{ color: 'var(--text-4)', fontSize: 11 }}>{new Date(assignment.assigned_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
