import type { SyncState } from '../types';
import { formatDateTime } from '../lib/date';
import { Icon, type IconName } from './Icon';

interface SyncPillProps {
  sync: SyncState;
  dirty: boolean;
  onClick?: () => void;
}

interface PillDescriptor {
  label: string;
  tone: string;
  icon: IconName;
  title: string;
  spinning?: boolean;
}

function describe(sync: SyncState, dirty: boolean): PillDescriptor {
  switch (sync.status) {
    case 'syncing':
      return {
        label: 'Sincronizando…',
        tone: 'busy',
        icon: 'sync',
        title: 'Subiendo tus cambios a Google Drive',
        spinning: true,
      };
    case 'auth-required':
      return {
        label: 'Reconectar Drive',
        tone: 'warn',
        icon: 'cloudOff',
        title: sync.message ?? 'Vuelve a conectar Google Drive',
      };
    case 'offline':
      return {
        label: 'Sin conexión',
        tone: 'offline',
        icon: 'cloudOff',
        title: sync.message ?? 'Los cambios se guardan en este dispositivo',
      };
    case 'error':
      return {
        label: 'Error al sincronizar',
        tone: 'error',
        icon: 'alert',
        title: sync.message ?? 'No se pudo sincronizar',
      };
    case 'idle':
      return dirty
        ? {
            label: 'Cambios sin subir',
            tone: 'warn',
            icon: 'cloud',
            title: 'Hay cambios pendientes de subir a Drive',
          }
        : {
            label: 'Sincronizado',
            tone: 'ok',
            icon: 'cloud',
            title: sync.lastSyncedAt
              ? `Última sincronización: ${formatDateTime(sync.lastSyncedAt)}`
              : 'Todo guardado en Drive',
          };
    default:
      return {
        label: 'Solo en este dispositivo',
        tone: 'off',
        icon: 'cloudOff',
        title: 'Conecta Google Drive en Ajustes para sincronizar',
      };
  }
}

export function SyncPill({ sync, dirty, onClick }: SyncPillProps) {
  const descriptor = describe(sync, dirty);
  const content = (
    <>
      <Icon
        name={descriptor.icon}
        size={16}
        className={descriptor.spinning ? 'spin' : undefined}
      />
      <span>{descriptor.label}</span>
    </>
  );

  if (!onClick) {
    return (
      <span className={`sync-pill ${descriptor.tone}`} title={descriptor.title}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`sync-pill ${descriptor.tone}`}
      title={descriptor.title}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
