import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppData, Book, Entry } from '../src/types';
import { synchronizeOnce } from '../src/lib/drive/sync';
import { parsePayloadText } from '../src/lib/validate';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FOLDER_NAME = 'Proyecto Lectura';
const FILE_NAME = 'lecturas.json';

interface FakeFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  content: string;
  etag: string;
  modifiedTime: string;
  trashed: boolean;
}

interface FakeDrive {
  files: Map<string, FakeFile>;
  requests: string[];
  beforePatch: ((file: FakeFile) => void) | null;
  remoteData: () => AppData | null;
  setRemoteData: (data: AppData) => void;
  folder: () => FakeFile | undefined;
  syncFile: () => FakeFile | undefined;
}

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'b1',
    title: 'Meditaciones',
    totalPages: 200,
    color: '#b4532b',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'e1',
    bookId: 'b1',
    date: '2026-01-02',
    pages: 12,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    schemaVersion: 1,
    books: [],
    entries: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function installFakeDrive(): FakeDrive {
  const files = new Map<string, FakeFile>();
  let idCounter = 0;
  let version = 0;

  const nextId = (prefix: string) => `${prefix}-${++idCounter}`;
  const now = () => new Date(2026, 0, 10, 12, 0, 0).toISOString();

  const drive: FakeDrive = {
    files,
    requests: [],
    beforePatch: null,
    remoteData: () => {
      const file = [...files.values()].find((item) => item.name === FILE_NAME);
      if (!file || !file.content.trim()) return null;
      return parsePayloadText(file.content);
    },
    setRemoteData: (data) => {
      const file = [...files.values()].find((item) => item.name === FILE_NAME);
      if (!file) throw new Error('El archivo remoto no existe');
      file.content = JSON.stringify(data, null, 2);
      file.etag = `"v${++version}"`;
      file.modifiedTime = now();
    },
    folder: () => [...files.values()].find((item) => item.mimeType === FOLDER_MIME),
    syncFile: () => [...files.values()].find((item) => item.name === FILE_NAME),
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    drive.requests.push(url.toString());
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname;
    const headers = new Headers(init?.headers ?? {});

    if (path === '/drive/v3/files' && method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      const nameMatch = q.match(/name = '([^']+)'/);
      const parentMatch = q.match(/'([^']+)' in parents/);
      let list = [...files.values()].filter((file) => !file.trashed);
      if (q.includes(FOLDER_MIME)) list = list.filter((file) => file.mimeType === FOLDER_MIME);
      else list = list.filter((file) => file.mimeType !== FOLDER_MIME);
      if (nameMatch) list = list.filter((file) => file.name === nameMatch[1]);
      if (parentMatch) list = list.filter((file) => file.parents?.includes(parentMatch[1]));
      return json({ files: list.map((file) => ({ id: file.id, name: file.name })) });
    }

    if (path === '/drive/v3/files' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { name: string; mimeType: string };
      const file: FakeFile = {
        id: nextId('folder'),
        name: body.name,
        mimeType: body.mimeType,
        content: '',
        etag: `"v${++version}"`,
        modifiedTime: now(),
        trashed: false,
      };
      files.set(file.id, file);
      return json({ id: file.id, name: file.name });
    }

    if (path === '/upload/drive/v3/files' && method === 'POST') {
      const body = String(init?.body ?? '');
      const name = body.match(/"name":"([^"]+)"/)?.[1] ?? FILE_NAME;
      const folderId = body.match(/"parents":\["([^"]+)"\]/)?.[1];
      const file: FakeFile = {
        id: nextId('file'),
        name,
        mimeType: 'application/json',
        parents: folderId ? [folderId] : undefined,
        content: '',
        etag: `"v${++version}"`,
        modifiedTime: now(),
        trashed: false,
      };
      files.set(file.id, file);
      return json(
        {
          id: file.id,
          name: file.name,
          etag: file.etag,
          modifiedTime: file.modifiedTime,
        },
        200,
        { ETag: file.etag },
      );
    }

    const fileIdMatch = path.match(/\/drive\/v3\/files\/([^/]+)$/);
    if (fileIdMatch) {
      const file = files.get(decodeURIComponent(fileIdMatch[1]));
      if (!file) return json({ error: { message: 'File not found' } }, 404);

      if (method === 'PATCH') {
        if (drive.beforePatch) {
          const hook = drive.beforePatch;
          drive.beforePatch = null;
          hook(file);
        }
        const ifMatch = headers.get('If-Match');
        if (ifMatch && ifMatch !== file.etag) {
          return json({ error: { message: 'Precondition Failed' } }, 412);
        }
        file.content = String(init?.body ?? '');
        file.etag = `"v${++version}"`;
        file.modifiedTime = now();
        return json(
          {
            id: file.id,
            etag: file.etag,
            modifiedTime: file.modifiedTime,
          },
          200,
          { ETag: file.etag },
        );
      }

      if (url.searchParams.get('alt') === 'media') {
        return new Response(file.content, { status: 200 });
      }

      return json(
        {
          id: file.id,
          name: file.name,
          etag: file.etag,
          modifiedTime: file.modifiedTime,
          trashed: file.trashed,
          parents: file.parents,
        },
        200,
        { ETag: file.etag },
      );
    }

    return json({ error: { message: `Sin ruta: ${method} ${path}` } }, 400);
  });

  vi.stubGlobal('fetch', fetchMock);
  return drive;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('synchronizeOnce', () => {
  it('crea la carpeta y el archivo, y sube los datos locales', async () => {
    const drive = installFakeDrive();
    const local = makeData({
      books: [makeBook()],
      entries: [makeEntry()],
      updatedAt: '2026-01-05T00:00:00.000Z',
    });

    const outcome = await synchronizeOnce({ token: 'token', local });

    expect(outcome.pushed).toBe(true);
    expect(outcome.pulled).toBe(false);
    expect(drive.folder()?.name).toBe(FOLDER_NAME);
    expect(drive.syncFile()?.name).toBe(FILE_NAME);

    const remote = drive.remoteData();
    expect(remote?.books[0].title).toBe('Meditaciones');
    expect(remote?.entries[0].pages).toBe(12);
    expect(outcome.fileId).toBe(drive.syncFile()?.id);
    expect(outcome.folderId).toBe(drive.folder()?.id);
  });

  it('descarga y combina los cambios hechos en otro dispositivo', async () => {
    const drive = installFakeDrive();
    const local = makeData({
      books: [makeBook()],
      entries: [makeEntry()],
      updatedAt: '2026-01-05T00:00:00.000Z',
    });
    const first = await synchronizeOnce({ token: 'token', local });
    expect(first.pushed).toBe(true);

    const remote = drive.remoteData();
    expect(remote).not.toBeNull();
    drive.setRemoteData({
      ...(remote as AppData),
      books: [
        ...(remote as AppData).books,
        makeBook({
          id: 'b2',
          title: 'El nombre del viento',
          createdAt: '2026-01-06T00:00:00.000Z',
          updatedAt: '2026-01-06T00:00:00.000Z',
        }),
      ],
      entries: [
        ...(remote as AppData).entries,
        makeEntry({
          id: 'e2',
          bookId: 'b2',
          date: '2026-01-07',
          pages: 30,
          createdAt: '2026-01-07T00:00:00.000Z',
          updatedAt: '2026-01-07T00:00:00.000Z',
        }),
      ],
      updatedAt: '2026-01-08T00:00:00.000Z',
    });

    const second = await synchronizeOnce({
      token: 'token',
      local,
      fileId: first.fileId,
      folderId: first.folderId,
    });

    expect(second.pulled).toBe(true);
    expect(second.data.books.map((book) => book.id).sort()).toEqual(['b1', 'b2']);
    expect(second.data.entries.map((entry) => entry.id).sort()).toEqual(['e1', 'e2']);
  });

  it('reintenta el merge si el archivo cambia durante la subida', async () => {
    const drive = installFakeDrive();
    const local = makeData({
      books: [makeBook()],
      entries: [makeEntry()],
      updatedAt: '2026-01-05T00:00:00.000Z',
    });
    const first = await synchronizeOnce({ token: 'token', local });

    drive.beforePatch = (file) => {
      const current = parsePayloadText(file.content);
      if (!current) return;
      const injected = makeEntry({
        id: 'e-other-device',
        date: '2026-01-09',
        pages: 44,
        createdAt: '2026-01-09T00:00:00.000Z',
        updatedAt: '2026-01-09T12:00:00.000Z',
      });
      file.content = JSON.stringify(
        { ...current, entries: [...current.entries, injected] },
        null,
        2,
      );
      file.etag = '"cambio-externo"';
    };

    const localWithNewEntry = makeData({
      books: local.books,
      entries: [
        ...local.entries,
        makeEntry({
          id: 'e-local-nueva',
          date: '2026-01-10',
          pages: 18,
          createdAt: '2026-01-10T00:00:00.000Z',
          updatedAt: '2026-01-10T10:00:00.000Z',
        }),
      ],
      updatedAt: '2026-01-10T10:00:00.000Z',
    });

    const outcome = await synchronizeOnce({
      token: 'token',
      local: localWithNewEntry,
      fileId: first.fileId,
      folderId: first.folderId,
    });

    expect(outcome.pushed).toBe(true);
    const remote = drive.remoteData();
    expect(remote?.entries.map((entry) => entry.id).sort()).toEqual([
      'e-local-nueva',
      'e-other-device',
      'e1',
    ]);
  });

  it('nunca pide etag como campo de la API (viene en la cabecera HTTP)', async () => {
    const drive = installFakeDrive();
    await synchronizeOnce({
      token: 'token',
      local: makeData({ books: [makeBook()], entries: [makeEntry()] }),
    });

    const invalidFields = drive.requests.filter((url) => {
      const fields = new URL(url).searchParams.get('fields') ?? '';
      return /(^|,)\s*etag\s*(,|$)/i.test(fields);
    });
    expect(invalidFields).toEqual([]);
  });

  it('no sube nada si todo coincide', async () => {
    const drive = installFakeDrive();
    const local = makeData({
      books: [makeBook()],
      entries: [makeEntry()],
      updatedAt: '2026-01-05T00:00:00.000Z',
    });
    const first = await synchronizeOnce({ token: 'token', local });
    const second = await synchronizeOnce({
      token: 'token',
      local,
      fileId: first.fileId,
      folderId: first.folderId,
    });
    expect(second.pushed).toBe(false);
    expect(second.pulled).toBe(false);
    expect(drive.files.size).toBe(2);
  });
});
