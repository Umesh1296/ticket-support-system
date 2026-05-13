export function TicketFlowMark({ className = '', size = 36 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="TicketFlow"
      focusable="false"
    >
      <defs>
        <linearGradient id="tf-mark-gradient" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset=".46" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="var(--brand-ink, #09090B)" />
      <path d="M18 22.5c0-3 2.4-5.5 5.5-5.5h24c3 0 5.5 2.4 5.5 5.5v5.2c-3.4 0-6.1 2.7-6.1 6.1 0 3.4 2.7 6.1 6.1 6.1v1.6c0 3-2.4 5.5-5.5 5.5h-24c-3 0-5.5-2.4-5.5-5.5v-1.6c3.4 0 6.1-2.7 6.1-6.1 0-3.4-2.7-6.1-6.1-6.1v-5.2Z" fill="url(#tf-mark-gradient)" />
      <path d="M32 21h4l-3 9h7L28.8 44l3.1-10H25l7-13Z" fill="white" />
    </svg>
  )
}

export function TicketFlowLogo({ className = '', compact = false, subtitle }) {
  return (
    <div className={`tf-logo ${compact ? 'compact' : ''} ${className}`}>
      <TicketFlowMark className="tf-logo-mark" size={compact ? 32 : 38} />
      {!compact && (
        <div className="tf-logo-copy">
          <div className="tf-logo-name">TicketFlow</div>
          {subtitle && <div className="tf-logo-subtitle">{subtitle}</div>}
        </div>
      )}
    </div>
  )
}
