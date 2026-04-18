import * as React from 'react';
import type { Book, Highlight, Note } from '../../shared/ipc';
import { toJSON, toMarkdown } from '@/lib/book-export';
import type { ExportFormat } from '@/components/ExportDialog';

type ExportPayload = {
  book: Book;
  notes: Note[];
  highlights: Highlight[];
};

type UseFlowExportOptions = {
  bookId: string;
  title: string;
};

function hasExportApi(
  api: Window['api']
): api is NonNullable<Window['api']> & {
  export: {
    getBookData: (payload: { bookId: string }) => Promise<unknown>;
    saveFile: (payload: { suggestedName: string; ext: 'md' | 'json'; content: string }) => Promise<unknown>;
  };
} {
  return Boolean(
    api && api.export && typeof api.export.getBookData === 'function' && typeof api.export.saveFile === 'function'
  );
}

function toPreview(text: string, maxLines: number): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return text;
  }
  return `${lines.slice(0, maxLines).join('\n')}\n...`;
}

function sanitizeExportName(value: string): string {
  const trimmed = value.trim() || 'book-export';
  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'book-export';
}

export function useFlowExport({ bookId, title }: UseFlowExportOptions) {
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>('markdown');
  const [exportLoading, setExportLoading] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [exportMessage, setExportMessage] = React.useState<string | null>(null);
  const [exportData, setExportData] = React.useState<ExportPayload | null>(null);

  const exportContent = React.useMemo(() => {
    if (!exportData) {
      return '';
    }
    return exportFormat === 'json'
      ? toJSON(exportData.book, exportData.notes, exportData.highlights)
      : toMarkdown(exportData.book.title, exportData.notes, exportData.highlights);
  }, [exportData, exportFormat]);

  const exportPreview = React.useMemo(() => toPreview(exportContent, 40), [exportContent]);

  const openExportDialog = React.useCallback(async () => {
    const api = window.api;
    if (!hasExportApi(api)) {
      setExportError('Export API is unavailable. Restart the app to reload Electron preload.');
      setExportDialogOpen(true);
      return;
    }

    setExportLoading(true);
    setExportError(null);
    setExportMessage(null);
    try {
      const result = await api.export.getBookData({ bookId });
      if (!result || typeof result !== 'object' || !('ok' in result) || !result.ok) {
        setExportError(result && typeof result === 'object' && 'error' in result ? String(result.error) : 'Failed to prepare export.');
        setExportDialogOpen(true);
        return;
      }

      setExportData((result as { ok: true; data: ExportPayload }).data);
      setExportDialogOpen(true);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
      setExportDialogOpen(true);
    } finally {
      setExportLoading(false);
    }
  }, [bookId]);

  const copyExportContent = React.useCallback(async () => {
    if (!exportContent) {
      return;
    }
    setExportError(null);
    setExportMessage(null);
    try {
      await navigator.clipboard.writeText(exportContent);
      setExportMessage('Copied to clipboard.');
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    }
  }, [exportContent]);

  const saveExportContent = React.useCallback(async () => {
    const api = window.api;
    if (!hasExportApi(api)) {
      setExportError('Export API is unavailable. Restart the app to reload Electron preload.');
      return;
    }
    if (!exportContent) {
      return;
    }

    setExportLoading(true);
    setExportError(null);
    setExportMessage(null);
    try {
      const ext = exportFormat === 'json' ? 'json' : 'md';
      const result = await api.export.saveFile({
        suggestedName: sanitizeExportName(title),
        ext,
        content: exportContent
      });
      if (!result || typeof result !== 'object' || !('ok' in result)) {
        setExportError('Failed to save export.');
        return;
      }
      if (!result.ok) {
        if ('cancelled' in result && result.cancelled) {
          return;
        }
        setExportError('error' in result ? String(result.error) : 'Failed to save export.');
        return;
      }
      setExportMessage(`Saved to ${(result as { ok: true; path: string }).path}`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      setExportLoading(false);
    }
  }, [exportContent, exportFormat, title]);

  React.useEffect(() => {
    setExportDialogOpen(false);
    setExportError(null);
    setExportMessage(null);
    setExportData(null);
    setExportFormat('markdown');
  }, [bookId]);

  return {
    exportDialogOpen,
    exportFormat,
    exportLoading,
    exportError,
    exportMessage,
    exportPreview,
    setExportFormat,
    openExportDialog,
    copyExportContent,
    saveExportContent,
    closeExportDialog: () => setExportDialogOpen(false)
  };
}

