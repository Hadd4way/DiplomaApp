import type { Book } from '../../shared/ipc';

export type StoredBookMetric = {
  pageCount: number | null;
  currentLocation: number | null;
  progressPercent: number | null;
  pageCountKind: 'pages' | 'locations' | 'sections' | 'chapters' | 'format';
  currentLocationKind: 'pageOf' | 'startOnPage' | 'chapter' | 'section' | 'continueReading' | 'startReading';
};

type StoredMetricCacheEntry = {
  signature: string;
  metric: StoredBookMetric;
  dirty: boolean;
  updatedAt: number;
};

type StoredMetricCachePayload = {
  version: 1;
  entries: Record<string, StoredMetricCacheEntry>;
};

const CACHE_KEY = 'diplomaapp.library-metrics.v1';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readCache(): StoredMetricCachePayload {
  const storage = getStorage();
  if (!storage) {
    return { version: 1, entries: {} };
  }

  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) {
      return { version: 1, entries: {} };
    }

    const parsed = JSON.parse(raw) as Partial<StoredMetricCachePayload>;
    if (parsed.version !== 1 || !parsed.entries || typeof parsed.entries !== 'object') {
      return { version: 1, entries: {} };
    }

    return {
      version: 1,
      entries: parsed.entries as Record<string, StoredMetricCacheEntry>
    };
  } catch {
    return { version: 1, entries: {} };
  }
}

function writeCache(payload: StoredMetricCachePayload): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore cache write failures.
  }
}

export function getBookMetricCacheSignature(book: Book): string {
  return [book.format, book.filePath ?? '', String(book.createdAt)].join('|');
}

export function getCachedBookMetric(book: Book): { metric: StoredBookMetric; dirty: boolean } | null {
  const cache = readCache();
  const entry = cache.entries[book.id];
  if (!entry) {
    return null;
  }

  if (entry.signature !== getBookMetricCacheSignature(book)) {
    return null;
  }

  return {
    metric: entry.metric,
    dirty: entry.dirty
  };
}

export function saveCachedBookMetric(book: Book, metric: StoredBookMetric): void {
  const cache = readCache();
  cache.entries[book.id] = {
    signature: getBookMetricCacheSignature(book),
    metric,
    dirty: false,
    updatedAt: Date.now()
  };
  writeCache(cache);
}

export function markCachedBookMetricDirty(bookId: string): void {
  const safeBookId = bookId.trim();
  if (!safeBookId) {
    return;
  }

  const cache = readCache();
  const entry = cache.entries[safeBookId];
  if (!entry) {
    return;
  }

  cache.entries[safeBookId] = {
    ...entry,
    dirty: true,
    updatedAt: Date.now()
  };
  writeCache(cache);
}
