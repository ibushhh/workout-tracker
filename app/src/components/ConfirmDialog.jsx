import Modal from "./Modal.jsx";

export default function ConfirmDialog({ title = "Are you sure?", message, confirmLabel = "Delete", danger = true, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel} width="380px">
      <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{message}</div>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
