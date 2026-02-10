import Store from 'electron-store';
import type { ProgressGetRequest, ProgressSetRequest, ReaderProgress } from '../shared/ipc';

const MIN_PAGE = 1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

const store = new Store<Record<string, ReaderProgress>>({
  name: 'reader-progress'
});
const storeCompat = store as unknown as {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

function clampScale(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function clampPage(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_PAGE;
  }
  return Math.max(MIN_PAGE, Math.floor(value));
}

function makeKey(userId: string, bookId: string): string | null {
  const safeUserId = userId.trim();
  const safeBookId = bookId.trim();
  if (!safeUserId || !safeBookId) {
    return null;
  }
  return `progress:${safeUserId}:${safeBookId}`;
}

function normalizeProgress(progress: ReaderProgress): ReaderProgress {
  return {
    lastPage: clampPage(progress.lastPage),
    scaleMode: progress.scaleMode === 'manual' ? 'manual' : 'fitWidth',
    scale: clampScale(progress.scale),
    updatedAt: Number.isFinite(progress.updatedAt) ? Math.floor(progress.updatedAt) : Date.now()
  };
}

export function getReaderProgress(payload: ProgressGetRequest): ReaderProgress | null {
  const key = makeKey(payload.userId, payload.bookId);
  if (!key) {
    return null;
  }

  const value = storeCompat.get(key);
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as ReaderProgress;
  return normalizeProgress(candidate);
}

export function setReaderProgress(payload: ProgressSetRequest): void {
  const key = makeKey(payload.userId, payload.bookId);
  if (!key) {
    return;
  }

  const normalized = normalizeProgress(payload.progress);
  storeCompat.set(key, normalized);
}
