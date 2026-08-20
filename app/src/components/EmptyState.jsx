export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-state-icon">
          <Icon size={26} />
        </div>
      )}
      <div className="empty-state-title">{title}</div>
      {message && <p style={{ fontSize: 13, maxWidth: 320, margin: "0 auto" }}>{message}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
