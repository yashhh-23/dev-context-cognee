import { Toast } from '../page';

export default function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} role="status">
          <span className="toast-dot" />
          {t.msg}
        </div>
      ))}
    </div>
  );
}
