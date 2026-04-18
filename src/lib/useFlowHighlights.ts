import * as React from 'react';
import type { Highlight } from '../../shared/ipc';

type CreateFlowHighlightInput = {
  location: string;
  text: string | null;
  note?: string | null;
};

export function useFlowHighlights(bookId: string) {
  const [highlights, setHighlights] = React.useState<Highlight[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const loadHighlights = React.useCallback(async () => {
    if (!window.api?.epubHighlights) {
      setHighlights([]);
      setError('Highlights API is unavailable. Restart the app to reload Electron preload.');
      return;
    }

    setError(null);
    try {
      const result = await window.api.epubHighlights.list({ bookId });
      if (!result.ok) {
        setHighlights([]);
        setError(result.error);
        return;
      }
      setHighlights(result.highlights);
    } catch (loadError) {
      setHighlights([]);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [bookId]);

  const createHighlight = React.useCallback(async ({ location, text, note = null }: CreateFlowHighlightInput) => {
    if (!window.api?.highlights) {
      setError('Highlights API is unavailable. Restart the app to reload Electron preload.');
      return null;
    }

    setError(null);
    try {
      const result = await window.api.highlights.insertRaw({
        bookId,
        cfiRange: location,
        text,
        note
      });
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      setHighlights((prev) => [...prev, result.highlight].sort((a, b) => a.createdAt - b.createdAt));
      return result.highlight;
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
      return null;
    }
  }, [bookId]);

  const deleteHighlight = React.useCallback(async (highlightId: string) => {
    if (!window.api?.highlights) {
      setError('Highlights API is unavailable. Restart the app to reload Electron preload.');
      return false;
    }

    setError(null);
    try {
      const result = await window.api.highlights.delete({ highlightId });
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setHighlights((prev) => prev.filter((highlight) => highlight.id !== highlightId));
      return true;
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
      return false;
    }
  }, []);

  const updateHighlightNote = React.useCallback(async (highlightId: string, note: string | null) => {
    if (!window.api?.highlights) {
      setError('Highlights API is unavailable. Restart the app to reload Electron preload.');
      return null;
    }

    setError(null);
    try {
      const result = await window.api.highlights.updateNote({ highlightId, note });
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      setHighlights((prev) =>
        prev.map((highlight) => (highlight.id === highlightId ? result.highlight : highlight))
      );
      return result.highlight;
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : String(updateError));
      return null;
    }
  }, []);

  React.useEffect(() => {
    void loadHighlights();
  }, [loadHighlights]);

  return {
    highlights,
    error,
    setHighlights,
    loadHighlights,
    createHighlight,
    deleteHighlight,
    updateHighlightNote
  };
}
