export const SCHEMA_VERSION = 1;

export interface Book {
  id: string;
  title: string;
  author?: string;
  totalPages: number;
  /** Primera página que cuenta como lectura (para saltar prólogos). Por defecto 1. */
  startPage?: number;
  /** Última página que cuenta como lectura (para saltar notas o índices). Por defecto totalPages. */
  endPage?: number;
  color: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Entry {
  id: string;
  bookId: string;
  /** Fecha local en formato YYYY-MM-DD. */
  date: string;
  pages: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** Datos que se guardan en local y se sincronizan con Google Drive. */
export interface AppData {
  schemaVersion: number;
  books: Book[];
  entries: Entry[];
  updatedAt: string;
}

export type UsageMode = 'offline' | 'cloud';

export interface Settings {
  clientId: string;
  connected: boolean;
  /** undefined = aún no ha elegido modo (se muestra la bienvenida). */
  mode?: UsageMode;
  folderId?: string;
  fileId?: string;
  lastSyncedAt?: string;
}

export interface PersistedState {
  schemaVersion: number;
  data: AppData;
  settings: Settings;
  dirty: boolean;
}

export interface BookInput {
  title: string;
  author?: string;
  totalPages: number;
  startPage?: number;
  endPage?: number;
  color: string;
}

export const BOOK_COLORS = [
  '#b4532b',
  '#3d6b5a',
  '#8a6a2f',
  '#4b5d8a',
  '#8c4a6b',
  '#5b7c99',
] as const;

export const DEFAULT_BOOK_COLOR = BOOK_COLORS[0];

export type SyncStatus =
  | 'disconnected'
  | 'idle'
  | 'syncing'
  | 'auth-required'
  | 'offline'
  | 'error';

export interface SyncState {
  status: SyncStatus;
  message?: string;
  lastSyncedAt?: string;
}
