export const OFFLINE_ERROR_MESSAGE = '__APP_OFFLINE__';

export function isNavigatorOnline() {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

export function createOfflineError() {
  return new Error(OFFLINE_ERROR_MESSAGE);
}

export function assertOnline() {
  if (!isNavigatorOnline()) {
    throw createOfflineError();
  }
}

export function isOfflineError(error: unknown) {
  return error instanceof Error && error.message === OFFLINE_ERROR_MESSAGE;
}
