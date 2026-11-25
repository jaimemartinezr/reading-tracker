import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppData,
  Book,
  BookInput,
  Entry,
  PersistedState,
  Settings,
  SyncState,
  UsageMode,
} from '../types';
import { SCHEMA_VERSION } from '../types';
import { newId } from '../lib/id';
import { emptyData, defaultSettings, loadPersisted, savePersisted } from '../lib/storage';
import { mergeData, sameContent } from '../lib/merge';
import { sanitizeData } from '../lib/validate';
import { getAccessToken, clearTokenCache, revokeAccessToken } from '../lib/drive/auth';
import { synchronizeOnce } from '../lib/drive/sync';
import { DriveAuthError, DriveError } from '../lib/drive/errors';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

type SyncMode = 'auto' | 'manual' | 'connect';

export interface SyncResult {
  ok: boolean;
  error?: string;
}

export interface AppContextValue {
  data: AppData;
  settings: Settings;
  sync: SyncState;
  dirty: boolean;
  toast: Toast | null;
  notify: (message: string, kind?: ToastKind) => void;
  addBook: (input: BookInput) => Book;
  updateBook: (id: string, input: BookInput) => void;
  deleteBook: (id: string) => void;
  logPages: (bookId: string, date: string, pages: number) => void;
  deleteEntry: (id: string) => void;
  setClientId: (clientId: string) => void;
  setMode: (mode: UsageMode) => Promise<SyncResult>;
  connectDrive: () => Promise<SyncResult>;
  disconnectDrive: () => void;
  syncNow: () => Promise<void>;
  importJson: (text: string) => { books: number; entries: number };
  exportJson: () => string;
  resetAll: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const AUTO_SYNC_DELAY = 4000;

export function AppProvider({ children }: { children: ReactNode }) {
  const [initial] = useState<PersistedState | null>(() => loadPersisted());
  const [data, setData] = useState<AppData>(() => initial?.data ?? emptyData());
  const [settings, setSettings] = useState<Settings>(
    () => initial?.settings ?? defaultSettings(),
  );
  const [dirty, setDirty] = useState<boolean>(initial?.dirty ?? false);
  const [sync, setSync] = useState<SyncState>(() => {
    const current = initial?.settings;
    return current && current.mode === 'cloud' && current.connected && current.clientId
      ? { status: 'idle' }
      : { status: 'disconnected' };
  });
  const [toast, setToast] = useState<Toast | null>(null);

  const dataRef = useRef(data);
  const settingsRef = useRef(settings);
  const inFlight = useRef(false);
  const queued = useRef(false);
  const autoTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);
  const lastAutoSync = useRef(0);
  const cloudIntent = useRef(false);
  const performSyncRef = useRef<
    ((interactive: boolean, mode: SyncMode) => Promise<SyncResult>) | null
  >(null);

  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, kind });
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      kind === 'error' ? 7000 : 3500,
    );
  }, []);

  const applySettings = useCallback((patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const applyData = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const commitData = useCallback(
    (next: AppData, options: { sync?: boolean } = {}) => {
      applyData(next);
      setDirty(true);
      if (options.sync === false) return;
      if (!settingsRef.current.connected) return;
      if (settingsRef.current.mode !== 'cloud') return;
      if (autoTimer.current !== undefined) window.clearTimeout(autoTimer.current);
      autoTimer.current = window.setTimeout(() => {
        void performSyncRef.current?.(false, 'auto');
      }, AUTO_SYNC_DELAY);
    },
    [applyData],
  );

  const recomputeDirty = useCallback((value: boolean) => {
    setDirty(value);
  }, []);

  const performSync = useCallback(
    async (interactive: boolean, mode: SyncMode): Promise<SyncResult> => {
      if (mode === 'auto' && settingsRef.current.mode !== 'cloud') return { ok: true };

      const current = settingsRef.current;
      if (!current.clientId.trim()) {
        const message = 'Añade tu Client ID de Google en Ajustes para sincronizar.';
        setSync({ status: 'error', message });
        if (mode === 'manual') notify(message, 'error');
        return { ok: false, error: message };
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const message = 'Estás sin conexión. Los cambios se guardan aquí.';
        setSync({ status: 'offline', message });
        if (mode === 'manual') {
          notify('Sin conexión: los cambios se guardan en este dispositivo.', 'info');
        }
        return { ok: false, error: message };
      }

      if (inFlight.current) {
        queued.current = true;
        return { ok: false, error: 'Ya hay una sincronización en curso.' };
      }

      inFlight.current = true;
      setSync({ status: 'syncing' });
      try {
        const token = await getAccessToken(current.clientId, interactive);
        const outcome = await synchronizeOnce({
          token,
          local: dataRef.current,
          folderId: settingsRef.current.folderId,
          fileId: settingsRef.current.fileId,
        });

        const latest = dataRef.current;
        const reconciled = mergeData(latest, outcome.data);
        if (!sameContent(latest, reconciled)) applyData(reconciled);

        // Si en Drive no está todo lo que tenemos en local, queda trabajo pendiente.
        const pending = !sameContent(outcome.data, reconciled);
        recomputeDirty(pending);

        // Si el usuario pasó a modo sin conexión mientras sincronizaba, no pisamos ese estado.
        if (settingsRef.current.mode === 'offline' && !cloudIntent.current) {
          return { ok: true };
        }

        const lastSyncedAt = new Date().toISOString();
        applySettings({
          connected: true,
          fileId: outcome.fileId,
          folderId: outcome.folderId,
          lastSyncedAt,
        });
        setSync({ status: 'idle', lastSyncedAt });

        if (pending) {
          if (autoTimer.current !== undefined) window.clearTimeout(autoTimer.current);
          autoTimer.current = window.setTimeout(() => {
            void performSyncRef.current?.(false, 'auto');
          }, 1200);
        } else if (mode === 'manual') {
          notify(
            outcome.pulled && !outcome.pushed
              ? 'Datos actualizados desde Google Drive.'
              : 'Todo sincronizado con Google Drive.',
          );
        }
        return { ok: true };
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Error desconocido');
        const abandoned =
          settingsRef.current.mode === 'offline' && !cloudIntent.current;
        if (!abandoned) {
          if (error instanceof DriveAuthError) {
            setSync({ status: 'auth-required', message: err.message });
          } else if (error instanceof DriveError && error.code === 'offline') {
            setSync({ status: 'offline', message: err.message });
          } else {
            setSync({ status: 'error', message: err.message });
          }
          if (mode === 'manual') notify(err.message, 'error');
          else if (mode === 'auto' && !(error instanceof DriveAuthError)) {
            console.warn('Sincronización:', err);
          }
        }
        return { ok: false, error: err.message };
      } finally {
        inFlight.current = false;
        if (queued.current) {
          queued.current = false;
          window.setTimeout(() => {
            void performSyncRef.current?.(false, 'auto');
          }, 800);
        }
      }
    },
    [applyData, applySettings, notify, recomputeDirty],
  );

  performSyncRef.current = performSync;

  // Guardado local en cada cambio.
  useEffect(() => {
    savePersisted({ schemaVersion: SCHEMA_VERSION, data, settings, dirty });
  }, [data, settings, dirty]);

  // Primer intento de sincronización silenciosa al abrir.
  useEffect(() => {
    const current = settingsRef.current;
    if (!current.connected || !current.clientId || current.mode !== 'cloud') return;
    const timer = window.setTimeout(() => {
      void performSyncRef.current?.(false, 'auto');
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  // Reintentos al recuperar conexión o volver a la pestaña.
  // También sirve para traer cambios hechos en otros dispositivos.
  useEffect(() => {
    const attempt = () => {
      if (!settingsRef.current.connected) return;
      if (settingsRef.current.mode !== 'cloud') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const now = Date.now();
      if (now - lastAutoSync.current < 45_000) return;
      lastAutoSync.current = now;
      void performSyncRef.current?.(false, 'auto');
    };
    const onOnline = () => {
      lastAutoSync.current = 0;
      attempt();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') attempt();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', attempt);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', attempt);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const touchData = useCallback(
    (books: Book[], entries: Entry[]) => {
      commitData({
        schemaVersion: SCHEMA_VERSION,
        books,
        entries,
        updatedAt: new Date().toISOString(),
      });
    },
    [commitData],
  );

  const addBook = useCallback(
    (input: BookInput): Book => {
      const now = new Date().toISOString();
      const book: Book = {
        id: newId(),
        title: input.title.trim().slice(0, 200),
        totalPages: Math.max(1, Math.round(input.totalPages)),
        color: input.color,
        createdAt: now,
        updatedAt: now,
      };
      const author = input.author?.trim();
      if (author) book.author = author.slice(0, 160);
      touchData([...dataRef.current.books, book], dataRef.current.entries);
      return book;
    },
    [touchData],
  );

  const updateBook = useCallback(
    (id: string, input: BookInput) => {
      const now = new Date().toISOString();
      const books = dataRef.current.books.map((book) => {
        if (book.id !== id) return book;
        const updated: Book = {
          ...book,
          title: input.title.trim().slice(0, 200),
          totalPages: Math.max(1, Math.round(input.totalPages)),
          color: input.color,
          updatedAt: now,
        };
        const author = input.author?.trim();
        if (author) updated.author = author.slice(0, 160);
        else delete updated.author;
        return updated;
      });
      touchData(books, dataRef.current.entries);
    },
    [touchData],
  );

  const deleteBook = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      const books = dataRef.current.books.map((book) =>
        book.id === id ? { ...book, deletedAt: now, updatedAt: now } : book,
      );
      touchData(books, dataRef.current.entries);
    },
    [touchData],
  );

  const logPages = useCallback(
    (bookId: string, date: string, pages: number) => {
      const amount = Math.round(pages);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const now = new Date().toISOString();
      const entries = dataRef.current.entries;
      const existing = entries.find(
        (entry) => entry.bookId === bookId && entry.date === date && !entry.deletedAt,
      );
      const nextEntries = existing
        ? entries.map((entry) =>
            entry.id === existing.id
              ? { ...entry, pages: entry.pages + amount, updatedAt: now }
              : entry,
          )
        : [
            ...entries,
            {
              id: newId(),
              bookId,
              date,
              pages: amount,
              createdAt: now,
              updatedAt: now,
            },
          ];
      touchData(dataRef.current.books, nextEntries);
    },
    [touchData],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      const entries = dataRef.current.entries.map((entry) =>
        entry.id === id ? { ...entry, deletedAt: now, updatedAt: now } : entry,
      );
      touchData(dataRef.current.books, entries);
    },
    [touchData],
  );

  const setClientId = useCallback(
    (clientId: string) => {
      const trimmed = clientId.trim();
      if (trimmed === settingsRef.current.clientId) return;
      clearTokenCache();
      applySettings({
        clientId: trimmed,
        connected: false,
        fileId: undefined,
        folderId: undefined,
        lastSyncedAt: undefined,
      });
      setSync({ status: 'disconnected' });
    },
    [applySettings],
  );

  const connectDrive = useCallback(async (): Promise<SyncResult> => {
    if (!settingsRef.current.clientId.trim()) {
      return { ok: false, error: 'Primero pega tu Client ID de Google y guárdalo.' };
    }

    cloudIntent.current = true;
    const result = await performSync(true, 'connect');
    if (result.ok && cloudIntent.current) {
      applySettings({ mode: 'cloud' });
      notify('Google Drive conectado. Tus datos se sincronizarán solos.');
    } else if (result.ok) {
      setSync({ status: 'disconnected' });
    }
    return result;
  }, [applySettings, notify, performSync]);

  const setMode = useCallback(
    async (mode: UsageMode): Promise<SyncResult> => {
      if (mode === 'offline') {
        cloudIntent.current = false;
        applySettings({ mode: 'offline' });
        setSync({ status: 'disconnected' });
        if (autoTimer.current !== undefined) {
          window.clearTimeout(autoTimer.current);
          autoTimer.current = undefined;
        }
        queued.current = false;
        return { ok: true };
      }

      if (!settingsRef.current.clientId.trim()) {
        const error = 'Añade tu Client ID de Google en Ajustes para activar la sincronización.';
        setSync({ status: 'error', message: error });
        notify(error, 'error');
        return { ok: false, error };
      }

      cloudIntent.current = true;
      const result = await performSync(true, 'connect');
      if (result.ok && cloudIntent.current) {
        applySettings({ mode: 'cloud' });
        notify('Sincronización con Google Drive activada.');
      } else if (result.ok) {
        setSync({ status: 'disconnected' });
      } else {
        notify(result.error ?? 'No se pudo activar la sincronización.', 'error');
      }
      return result;
    },
    [applySettings, notify, performSync],
  );

  const disconnectDrive = useCallback(() => {
    revokeAccessToken();
    cloudIntent.current = false;
    applySettings({ connected: false, mode: 'offline' });
    setSync({ status: 'disconnected' });
    notify(
      'Drive desconectado. La app pasa a modo sin conexión; tus datos siguen aquí.',
      'info',
    );
  }, [applySettings, notify]);

  const syncNow = useCallback(async () => {
    if (settingsRef.current.mode !== 'cloud') {
      notify('Activa el modo Google Drive para sincronizar.', 'info');
      return;
    }
    await performSync(true, 'manual');
  }, [notify, performSync]);

  const importJson = useCallback(
    (text: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        throw new Error('El archivo no es un JSON válido.');
      }
      const incoming = sanitizeData(parsed);
      const before = dataRef.current;
      const beforeBooks = new Set(before.books.filter((book) => !book.deletedAt).map((b) => b.id));
      const beforeEntries = new Set(
        before.entries.filter((entry) => !entry.deletedAt).map((entry) => entry.id),
      );

      const merged = mergeData(before, incoming);
      const next: AppData = { ...merged, updatedAt: new Date().toISOString() };
      commitData(next);

      return {
        books: next.books.filter((book) => !book.deletedAt && !beforeBooks.has(book.id)).length,
        entries: next.entries.filter(
          (entry) => !entry.deletedAt && !beforeEntries.has(entry.id),
        ).length,
      };
    },
    [commitData],
  );

  const exportJson = useCallback(() => JSON.stringify(dataRef.current, null, 2), []);

  const resetAll = useCallback(() => {
    const now = new Date().toISOString();
    const current = dataRef.current;
    const books = current.books.map((book) =>
      book.deletedAt ? book : { ...book, deletedAt: now, updatedAt: now },
    );
    const entries = current.entries.map((entry) =>
      entry.deletedAt ? entry : { ...entry, deletedAt: now, updatedAt: now },
    );
    commitData({ ...current, books, entries, updatedAt: now });
  }, [commitData]);

  const value: AppContextValue = {
    data,
    settings,
    sync,
    dirty,
    toast,
    notify,
    addBook,
    updateBook,
    deleteBook,
    logPages,
    deleteEntry,
    setClientId,
    setMode,
    connectDrive,
    disconnectDrive,
    syncNow,
    importJson,
    exportJson,
    resetAll,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return context;
}
