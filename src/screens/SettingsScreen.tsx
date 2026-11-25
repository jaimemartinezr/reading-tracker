import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { formatDateTime, todayISO } from '../lib/date';
import { formatNumber } from '../lib/format';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon } from '../components/Icon';
import { SyncPill } from '../components/SyncPill';

export function SettingsScreen() {
  const {
    data,
    settings,
    sync,
    dirty,
    setClientId,
    setMode,
    connectDrive,
    syncNow,
    disconnectDrive,
    exportJson,
    importJson,
    resetAll,
    notify,
  } = useApp();

  const [clientIdDraft, setClientIdDraft] = useState(settings.clientId);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setClientIdDraft(settings.clientId);
  }, [settings.clientId]);

  const trimmedDraft = clientIdDraft.trim();
  const draftChanged = trimmedDraft !== settings.clientId;

  const booksCount = data.books.filter((book) => !book.deletedAt).length;
  const entriesCount = data.entries.filter((entry) => !entry.deletedAt).length;

  const origins = Array.from(new Set([window.location.origin, 'http://localhost:5173']));

  const handleSaveClientId = () => {
    setClientId(trimmedDraft);
    if (trimmedDraft) {
      notify('Client ID guardado. Ahora pulsa «Conectar» para autorizar Drive.', 'info');
    } else {
      notify('Client ID eliminado. La app seguirá funcionando solo en local.', 'info');
    }
  };

  const handleConnect = async () => {
    if (draftChanged) {
      setClientId(trimmedDraft);
    }
    setBusy(true);
    try {
      const result = await connectDrive();
      if (!result.ok) {
        notify(result.error ?? 'No se pudo conectar con Google Drive.', 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleModeOffline = () => {
    if (settings.mode === 'offline') return;
    void setMode('offline');
    notify('Modo sin conexión activado. Tus datos se guardan solo aquí.', 'info');
  };

  const handleModeCloud = async () => {
    if (settings.mode === 'cloud' && settings.connected) return;
    setBusy(true);
    try {
      await setMode('cloud');
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    try {
      await syncNow();
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lecturas-${todayISO()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify('Copia de seguridad descargada.');
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const result = importJson(text);
      notify(
        `Importación lista: ${formatNumber(result.books)} libros y ${formatNumber(
          result.entries,
        )} registros nuevos.`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo importar el archivo.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="screen">
      <header className="page-head">
        <div>
          <p className="eyebrow">Sincronización y respaldo</p>
          <h1 className="page-title">Ajustes</h1>
        </div>
      </header>

      <section className="card settings-card">
        <div className="section-head">
          <h2>Modo de uso</h2>
          <span className={`mode-badge ${settings.mode === 'offline' ? 'offline' : 'cloud'}`}>
            {settings.mode === 'offline' ? 'Sin conexión' : 'Google Drive'}
          </span>
        </div>
        <p className="muted">
          Elige si quieres usar Páginas solo en este dispositivo o sincronizarla con tu Google
          Drive. Puedes cambiarlo en cualquier momento.
        </p>
        <div className="mode-options">
          <button
            type="button"
            className={`mode-option${settings.mode === 'offline' ? ' is-active' : ''}`}
            onClick={handleModeOffline}
            aria-pressed={settings.mode === 'offline'}
          >
            <span className="mode-option-icon">
              <Icon name="cloudOff" size={20} />
            </span>
            <span className="mode-option-text">
              <strong>Solo local</strong>
              <small>Sin cuenta. Los datos se quedan en este dispositivo.</small>
            </span>
            {settings.mode === 'offline' ? (
              <Icon name="check" size={18} className="mode-check" />
            ) : null}
          </button>
          <button
            type="button"
            className={`mode-option${settings.mode === 'cloud' ? ' is-active' : ''}`}
            onClick={() => void handleModeCloud()}
            disabled={busy}
            aria-pressed={settings.mode === 'cloud'}
          >
            <span className="mode-option-icon">
              <Icon name="cloud" size={20} />
            </span>
            <span className="mode-option-text">
              <strong>Google Drive</strong>
              <small>Sincroniza tu progreso entre dispositivos.</small>
            </span>
            {settings.mode === 'cloud' ? (
              <Icon name="check" size={18} className="mode-check" />
            ) : null}
          </button>
        </div>
        {settings.mode === 'offline' && settings.connected ? (
          <p className="hint">
            La sincronización está pausada. El acceso a Drive se conserva para cuando quieras
            volver a activarlo.
          </p>
        ) : null}
      </section>

      <section className="card settings-card">
        <div className="section-head">
          <h2>Google Drive</h2>
          <SyncPill sync={sync} dirty={dirty} />
        </div>
        <p className="muted">
          Tus libros y registros se guardan primero en este dispositivo. Con Drive conectado, se
          sincronizan automáticamente en la carpeta <strong>«Proyecto Lectura»</strong> para que los
          tengas en todos tus dispositivos.
        </p>

        {settings.lastSyncedAt ? (
          <p className="sync-last">
            Última sincronización: {formatDateTime(settings.lastSyncedAt)}
            {settings.fileId ? ' · lecturas.json' : ''}
          </p>
        ) : null}

        <div className="setting-block">
          <label className="field">
            <span className="label">Client ID de OAuth (aplicación web)</span>
            <div className="inline-field">
              <input
                className="input"
                value={clientIdDraft}
                onChange={(event) => setClientIdDraft(event.target.value)}
                placeholder="123456-abc.apps.googleusercontent.com"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className="btn ghost"
                onClick={handleSaveClientId}
                disabled={!draftChanged}
              >
                Guardar
              </button>
            </div>
          </label>
          <p className="hint">
            Se guarda solo en este dispositivo. Cada persona que use su propia copia de la app puede
            usar su propio Client ID.
          </p>
        </div>

        <div className="button-row">
          <button
            type="button"
            className="btn primary"
            onClick={handleConnect}
            disabled={busy || !trimmedDraft}
          >
            <Icon name="cloud" size={18} />
            {settings.mode === 'cloud' && settings.connected
              ? 'Reconectar Drive'
              : 'Conectar Drive'}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={handleSync}
            disabled={busy || !settings.connected || settings.mode !== 'cloud'}
          >
            <Icon name="sync" size={17} className={busy || sync.status === 'syncing' ? 'spin' : undefined} />
            Sincronizar ahora
          </button>
          {settings.connected ? (
            <button type="button" className="btn ghost danger-text" onClick={disconnectDrive}>
              Desconectar
            </button>
          ) : null}
        </div>

        {sync.status === 'error' || sync.status === 'auth-required' ? (
          <p className="status-message" role="alert">
            <Icon name="alert" size={16} />
            {sync.message ?? 'No se pudo sincronizar.'}
          </p>
        ) : null}

        <details className="guide">
          <summary>
            <Icon name="external" size={16} />
            Cómo obtener tu Client ID (5 minutos)
          </summary>
          <div className="guide-body">
            <ol className="steps">
              <li>
                Entra en{' '}
                <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">
                  console.cloud.google.com
                </a>{' '}
                y crea un proyecto (por ejemplo, «Páginas»).
              </li>
              <li>
                Ve a <strong>APIs y servicios → Biblioteca</strong>, busca{' '}
                <strong>Google Drive API</strong> y pulsa <strong>Habilitar</strong>.
              </li>
              <li>
                En <strong>Pantalla de consentimiento de OAuth</strong>, elige tipo{' '}
                <strong>Externo</strong>, pon un nombre y añade tu correo como{' '}
                <strong>usuario de prueba</strong>.
              </li>
              <li>
                En <strong>Credenciales → Crear credenciales → ID de cliente de OAuth</strong>, elige{' '}
                <strong>Aplicación web</strong>.
              </li>
              <li>
                En <strong>Orígenes de JavaScript autorizados</strong> añade exactamente:
                <code className="code-block">{origins.join('\n')}</code>
              </li>
              <li>
                Copia el <strong>Client ID</strong> que termina en{' '}
                <code>.apps.googleusercontent.com</code>, pégalo arriba y pulsa Guardar.
              </li>
            </ol>
            <p className="hint">
              La app solo pide el permiso <code>drive.file</code>: puede ver y modificar únicamente
              los archivos que ella misma crea. No tiene acceso al resto de tu Drive.
            </p>
          </div>
        </details>
      </section>

      <section className="card settings-card">
        <div className="section-head">
          <h2>Tus datos</h2>
          <span className="muted">
            {formatNumber(booksCount)} libros · {formatNumber(entriesCount)} registros
          </span>
        </div>
        <p className="muted">
          Descarga una copia en JSON cuando quieras. También puedes importar una copia: los datos se
          combinan sin borrar lo que ya tienes.
        </p>
        <div className="button-row">
          <button type="button" className="btn ghost" onClick={handleExport}>
            <Icon name="download" size={17} />
            Exportar JSON
          </button>
          <button type="button" className="btn ghost" onClick={() => fileInputRef.current?.click()}>
            <Icon name="upload" size={17} />
            Importar JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(event) => void handleImportFile(event.target.files?.[0])}
          />
        </div>
        <div className="danger-zone">
          <div>
            <strong>Empezar de cero</strong>
            <p className="hint">
              Elimina todos los libros y registros de este dispositivo y de Drive. Exporta antes una
              copia si quieres conservarlos.
            </p>
          </div>
          <button type="button" className="btn ghost danger-text" onClick={() => setConfirmReset(true)}>
            <Icon name="trash" size={17} />
            Borrar todo
          </button>
        </div>
      </section>

      <section className="card settings-card about-card">
        <div className="section-head">
          <h2>Acerca de Páginas</h2>
          <span className="badge">v1.0.0</span>
        </div>
        <p className="muted">
          Registro de lectura local-first: funciona sin conexión y guarda en tu Google Drive solo lo
          que tú decides. Instálala desde el menú del navegador («Añadir a pantalla de inicio») para
          abrirla como una app en el móvil.
        </p>
        <p className="hint">
          Cada dispositivo combina sus cambios con los del resto usando la fecha de modificación de
          cada registro, así que no se pierden lecturas aunque anotes en varios sitios.
        </p>
        <p className="legal-links">
          <a
            href={`${import.meta.env.BASE_URL}privacy.html`}
            target="_blank"
            rel="noreferrer"
          >
            Política de privacidad
          </a>
          <span aria-hidden="true">·</span>
          <a href={`${import.meta.env.BASE_URL}terms.html`} target="_blank" rel="noreferrer">
            Términos del servicio
          </a>
        </p>
      </section>

      {confirmReset ? (
        <ConfirmDialog
          title="Borrar todos los datos"
          message="Se eliminarán todos los libros y registros, también en Google Drive cuando vuelvas a sincronizar. Esta acción no se puede deshacer."
          confirmLabel="Sí, borrar todo"
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            resetAll();
            notify('Todos los datos se han eliminado.', 'info');
          }}
        />
      ) : null}
    </div>
  );
}
