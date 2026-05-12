export default function Toast({ message, type = 'info' }) {
  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-dot" />
      <span>{message}</span>
    </div>
  )
}
