import { useApp } from '../state/store';
import { Icon } from './Icon';

export function ToastHost() {
  const { toast } = useApp();
  if (!toast) return null;

  return (
    <div className="toast-host" aria-live="polite">
      <div className={`toast ${toast.kind}`} role="status">
        <Icon name={toast.kind === 'error' ? 'alert' : toast.kind === 'info' ? 'cloud' : 'check'} size={18} />
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
