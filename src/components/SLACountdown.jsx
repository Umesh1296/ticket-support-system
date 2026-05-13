import { useEffect, useState } from 'react'

function getSLADisplay(deadline, status) {
  if (status === 'resolved' || status === 'closed') {
    return { label: 'SLA Met', cls: 'sla-met' }
  }

  const now = new Date()
  const end = new Date(deadline)
  const diffMs = end - now
  const diffH = diffMs / (1000 * 60 * 60)

  if (diffMs < 0) {
    const agoH = Math.abs(Math.round(diffH))
    return { label: `Breached ${agoH}h ago`, cls: 'sla-breached' }
  }
  if (diffH <= 1) {
    const mins = Math.round(diffH * 60)
    return { label: `${mins}m left`, cls: 'sla-critical' }
  }
  if (diffH <= 4) {
    return { label: `${diffH.toFixed(1)}h left`, cls: 'sla-warning' }
  }
  return { label: `${Math.round(diffH)}h left`, cls: 'sla-ok' }
}

export default function SLACountdown({ deadline, status }) {
  const [display, setDisplay] = useState(() => getSLADisplay(deadline, status))

  useEffect(() => {
    setDisplay(getSLADisplay(deadline, status))
    const id = setInterval(() => setDisplay(getSLADisplay(deadline, status)), 30000)
    return () => clearInterval(id)
  }, [deadline, status])

  return (
    <span className={`sla-chip ${display.cls}`}>
      <span className="sla-chip-dot" aria-hidden="true" />
      {display.label}
    </span>
  )
}
