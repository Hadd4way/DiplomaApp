import * as React from 'react';
import type { EpubBookmark } from '../../shared/ipc';

type UseFlowBookmarksOptions = {
  bookId: string;
  currentLocation: string | null;
  currentLabel: string | null;
  matchLocation: (current: string | null, saved: string | null) => boolean;
};

export function useFlowBookmarks({
  bookId,
  currentLocation,
  currentLabel,
  matchLocation
}: UseFlowBookmarksOptions) {
  const [bookmarks, setBookmarks] = React.useState<EpubBookmark[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadBookmarks = React.useCallback(async () => {
    if (!window.api?.epubBookmarks) {
      setBookmarks([]);
      setError('Bookmarks API is unavailable. Restart the app to reload Electron preload.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await window.api.epubBookmarks.list({ bookId });
      if (!result.ok) {
        setBookmarks([]);
        setError(result.error);
        return;
      }
      setBookmarks(result.bookmarks);
    } catch (loadError) {
      setBookmarks([]);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  const toggleCurrentBookmark = React.useCallback(async () => {
    if (!window.api?.epubBookmarks) {
      setError('Bookmarks API is unavailable. Restart the app to reload Electron preload.');
      return false;
    }
    if (!currentLocation) {
      setError('Current reading location is unavailable.');
      return false;
    }

    setError(null);
    try {
      const result = await window.api.epubBookmarks.toggle({
        bookId,
        cfi: currentLocation,
        label: currentLabel ?? 'Location'
      });
      if (!result.ok) {
        setError(result.error);
        return false;
      }

      setBookmarks((prev) => {
        const withoutMatches = prev.filter((bookmark) => !matchLocation(currentLocation, bookmark.cfi));
        if (!result.bookmarked || !result.bookmark) {
          return withoutMatches;
        }
        return [...withoutMatches, result.bookmark].sort((a, b) => a.createdAt - b.createdAt);
      });
      return result.bookmarked;
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : String(toggleError));
      return false;
    }
  }, [bookId, currentLabel, currentLocation, matchLocation]);

  const removeBookmark = React.useCallback(async (bookmark: EpubBookmark) => {
    if (!window.api?.epubBookmarks) {
      setError('Bookmarks API is unavailable. Restart the app to reload Electron preload.');
      return false;
    }

    try {
      const result = await window.api.epubBookmarks.toggle({
        bookId,
        cfi: bookmark.cfi,
        label: bookmark.label
      });
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setBookmarks((prev) => prev.filter((item) => item.id !== bookmark.id));
      return true;
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : String(removeError));
      return false;
    }
  }, [bookId]);

  const activeBookmark = React.useMemo(
    () => bookmarks.find((bookmark) => matchLocation(currentLocation, bookmark.cfi)) ?? null,
    [bookmarks, currentLocation, matchLocation]
  );

  React.useEffect(() => {
    void loadBookmarks();
  }, [loadBookmarks]);

  return {
    bookmarks,
    loading,
    error,
    activeBookmark,
    isCurrentLocationBookmarked: activeBookmark !== null,
    loadBookmarks,
    toggleCurrentBookmark,
    removeBookmark
  };
}

