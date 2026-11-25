import { useEffect, useState } from 'react';
import { useApp } from './state/store';
import type { Screen } from './navigation';
import { Icon, type IconName } from './components/Icon';
import { SyncPill } from './components/SyncPill';
import { ToastHost } from './components/Toast';
import { TodayScreen } from './screens/TodayScreen';
import { BooksScreen } from './screens/BooksScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';

const NAV_ITEMS: Array<{ id: Screen; label: string; icon: IconName }> = [
  { id: 'today', label: 'Hoy', icon: 'today' },
  { id: 'books', label: 'Biblioteca', icon: 'library' },
  { id: 'progress', label: 'Progreso', icon: 'chart' },
  { id: 'settings', label: 'Ajustes', icon: 'settings' },
];

const TITLES: Record<Screen, string> = {
  today: 'Hoy',
  books: 'Biblioteca',
  progress: 'Progreso',
  settings: 'Ajustes',
};

export default function App() {
  const { sync, dirty, settings } = useApp();
  const [screen, setScreen] = useState<Screen>('today');
  const [booksFormOpen, setBooksFormOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.title = `${TITLES[screen]} · Páginas`;
  }, [screen]);

  if (settings.mode === undefined) {
    return <WelcomeScreen />;
  }

  const go = (next: Screen) => setScreen(next);

  const openAddBook = () => {
    setBooksFormOpen(true);
    setScreen('books');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="book" size={20} />
          </span>
          <div className="brand-text">
            <span className="brand-name">Páginas</span>
            <span className="brand-sub">registro de lectura</span>
          </div>
        </div>

        <nav className="nav" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${screen === item.id ? ' is-active' : ''}`}
              onClick={() => go(item.id)}
              aria-current={screen === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button type="button" className="btn primary sidebar-add" onClick={openAddBook}>
          <Icon name="plus" size={18} />
          Añadir libro
        </button>

        <div className="sidebar-foot">
          <SyncPill sync={sync} dirty={dirty} onClick={() => go('settings')} />
          <p className="sidebar-note">
            {settings.mode === 'offline'
              ? 'Modo sin conexión: tus datos se guardan solo en este dispositivo.'
              : settings.connected
                ? 'Tus datos se sincronizan con Google Drive.'
                : 'Conecta Google Drive en Ajustes para usar la app en varios dispositivos.'}
          </p>
        </div>
      </aside>

      <main className="main">
        <header className="mobile-head">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <Icon name="book" size={18} />
            </span>
            <span className="brand-name">Páginas</span>
          </div>
          <SyncPill sync={sync} dirty={dirty} onClick={() => go('settings')} />
        </header>

        <div className="page" key={screen}>
          {screen === 'today' ? (
            <TodayScreen onNavigate={go} onAddBook={openAddBook} />
          ) : null}
          {screen === 'books' ? (
            <BooksScreen
              formOpen={booksFormOpen}
              onFormClose={() => setBooksFormOpen(false)}
            />
          ) : null}
          {screen === 'progress' ? <ProgressScreen /> : null}
          {screen === 'settings' ? <SettingsScreen /> : null}
        </div>

        <nav className="tabbar" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tab-item${screen === item.id ? ' is-active' : ''}`}
              onClick={() => go(item.id)}
              aria-current={screen === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} size={21} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </main>

      <ToastHost />
    </div>
  );
}
