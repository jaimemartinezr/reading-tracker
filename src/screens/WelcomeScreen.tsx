import { useState } from 'react';
import { useApp } from '../state/store';
import { activeBooks } from '../lib/stats';
import { formatNumber } from '../lib/format';
import { Icon } from '../components/Icon';
import { ToastHost } from '../components/Toast';

export function WelcomeScreen() {
  const { data, connectDrive, setMode } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bookCount = activeBooks(data.books).length;

  const chooseOffline = () => {
    void setMode('offline');
  };

  const chooseCloud = async () => {
    setBusy(true);
    setError(null);
    const result = await connectDrive();
    if (!result.ok) {
      setError(result.error ?? 'No se pudo conectar con Google Drive.');
    }
    setBusy(false);
  };

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <header className="welcome-head">
          <div className="welcome-brand">
            <span className="brand-mark" aria-hidden="true">
              <Icon name="book" size={20} />
            </span>
            <span className="brand-name">Páginas</span>
          </div>
          <p className="eyebrow">Tu registro de lectura</p>
          <h1 className="welcome-title">Tus libros, día a día.</h1>
          <p className="welcome-lead">
            Anota lo que lees, mira cuánto avanzas y decide dónde guardar tu progreso. Podrás
            cambiar de modo cuando quieras.
          </p>
          {bookCount > 0 ? (
            <p className="welcome-data">
              Ya tienes {formatNumber(bookCount)}{' '}
              {bookCount === 1 ? 'libro guardado' : 'libros guardados'} en este dispositivo. No se
              perderán.
            </p>
          ) : null}
        </header>

        <div className="welcome-options">
          <article className="welcome-option">
            <span className="welcome-icon">
              <Icon name="cloudOff" size={22} />
            </span>
            <h2>Solo en este dispositivo</h2>
            <p>Funciona sin internet y sin cuenta de Google. Tus datos se quedan aquí.</p>
            <ul className="welcome-list">
              <li>Sin registro ni conexión</li>
              <li>Puedes exportar copias en JSON</li>
              <li>Podrás conectar Drive más tarde</li>
            </ul>
            <button type="button" className="btn ghost" onClick={chooseOffline} disabled={busy}>
              Empezar sin conexión
            </button>
          </article>

          <article className="welcome-option is-recommended">
            <span className="welcome-badge">Recomendado</span>
            <span className="welcome-icon">
              <Icon name="cloud" size={22} />
            </span>
            <h2>Sincronizar con Google Drive</h2>
            <p>
              Lleva tu progreso al móvil y al ordenador, con una copia en tu propio Drive.
            </p>
            <ul className="welcome-list">
              <li>Sincronización automática entre dispositivos</li>
              <li>Solo accede a la carpeta «Proyecto Lectura»</li>
              <li>Puedes desconectar cuando quieras</li>
            </ul>
            <button
              type="button"
              className="btn primary"
              onClick={() => void chooseCloud()}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Icon name="sync" size={17} className="spin" />
                  Conectando…
                </>
              ) : (
                <>
                  <Icon name="cloud" size={17} />
                  Conectar con Google Drive
                </>
              )}
            </button>
            {error ? (
              <div className="welcome-error" role="alert">
                <Icon name="alert" size={16} />
                <div>
                  <p>{error}</p>
                  <button type="button" className="text-btn" onClick={chooseOffline}>
                    Continuar sin conexión
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        </div>

        <footer className="welcome-foot">
          <p>
            Podrás cambiar de modo en <strong>Ajustes</strong>. La app guarda primero en este
            dispositivo y sincroniza cuando hay conexión.
          </p>
          <p>
            <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">
              Privacidad
            </a>
            <span aria-hidden="true"> · </span>
            <a href={`${import.meta.env.BASE_URL}terms.html`} target="_blank" rel="noreferrer">
              Términos
            </a>
          </p>
        </footer>
      </div>
      <ToastHost />
    </div>
  );
}
