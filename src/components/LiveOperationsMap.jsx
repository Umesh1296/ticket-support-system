import { Activity, AlertTriangle, CheckCircle, Clock, Users } from 'lucide-react'

export default function LiveOperationsMap({ stats }) {
  if (!stats) return null
  const { overview, operators, sla } = stats

  const metrics = [
    {
      icon: Activity,
      label: 'Open Tickets',
      value: overview?.open_tickets ?? 0,
      color: 'var(--blue)',
      bg: 'var(--blue-dim)',
    },
    {
      icon: Clock,
      label: 'In Progress',
      value: overview?.in_progress_tickets ?? 0,
      color: 'var(--amber)',
      bg: 'var(--amber-dim)',
    },
    {
      icon: CheckCircle,
      label: 'Resolved Today',
      value: overview?.resolved_tickets ?? 0,
      color: 'var(--green)',
      bg: 'var(--green-dim)',
    },
    {
      icon: AlertTriangle,
      label: 'SLA Breached',
      value: sla?.breached ?? 0,
      color: sla?.breached > 0 ? 'var(--red)' : 'var(--text-3)',
      bg: sla?.breached > 0 ? 'var(--red-dim)' : 'var(--bg-secondary)',
    },
    {
      icon: Users,
      label: 'Agents Online',
      value: operators?.available ?? 0,
      color: 'var(--green)',
      bg: 'var(--green-dim)',
    },
  ]

  return (
    <div className="live-ops-bar">
      {metrics.map(m => {
        const Icon = m.icon
        return (
          <div key={m.label} className="ops-metric">
            <div className="ops-metric-icon" style={{ background: m.bg }}>
              <Icon size={16} color={m.color} />
            </div>
            <div>
              <div className="ops-metric-val" style={{ color: m.color }}>{m.value}</div>
              <div className="ops-metric-label">{m.label}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
