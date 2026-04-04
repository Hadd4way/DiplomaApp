import * as React from 'react';
import type { BookFormat } from '../../shared/ipc';

function getRendererApi() {
  if (!window.api) {
    throw new Error('Renderer API is unavailable. Open this app via Electron.');
  }

  return window.api;
}

export function useReadingSessionStats({
  bookId,
  format,
  rootRef
}: {
  bookId: string;
  format: BookFormat;
  rootRef?: React.RefObject<HTMLElement | null>;
}) {
  React.useEffect(() => {
    void getRendererApi().stats.markOpened({ bookId, format }).catch(() => undefined);
  }, [bookId, format, rootRef]);

  const registerActivity = React.useCallback(() => undefined, []);
  const bindActivityTarget = React.useCallback((_target: Window | Document | HTMLElement | null) => () => undefined, []);
  const flush = React.useCallback(() => undefined, []);

  return {
    registerActivity,
    bindActivityTarget,
    flush
  };
}
