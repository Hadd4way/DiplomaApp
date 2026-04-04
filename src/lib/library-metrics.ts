import * as React from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker?url';
import ePub from 'epubjs';
import type { Book, RecentBookEntry } from '../../shared/ipc';

GlobalWorkerOptions.workerSrc = workerSrc;

export type BookMetric = {
  pageCount: number | null;
  progressPercent: number | null;
  progressLabel: string;
  pageCountLabel: string;
};

function getRendererApi() {
  if (!window.api) {
    throw new Error('Renderer API is unavailable. Open this app via Electron.');
  }

  return window.api;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return 'No progress yet';
  }
  return `${Math.round(clampPercent(value))}% read`;
}

async function loadPdfMetric(book: Book): Promise<BookMetric> {
  const api = getRendererApi();
  const [pdfResult, lastPage] = await Promise.all([
    api.books.getPdfData({ bookId: book.id }),
    api.getLastPage({ bookId: book.id })
  ]);

  if (!pdfResult.ok) {
    throw new Error(pdfResult.error);
  }

  const documentProxy = await getDocument({ data: base64ToUint8Array(pdfResult.base64) }).promise;
  const pageCount = documentProxy.numPages;
  const safeLastPage = lastPage && lastPage > 0 ? Math.min(lastPage, pageCount) : null;
  const progressPercent = safeLastPage ? (safeLastPage / pageCount) * 100 : 0;

  return {
    pageCount,
    progressPercent,
    progressLabel: formatPercent(progressPercent),
    pageCountLabel: `${pageCount} pages`
  };
}

async function loadEpubMetric(book: Book): Promise<BookMetric> {
  const api = getRendererApi();
  const [epubResult, progressResult] = await Promise.all([
    api.books.getEpubData({ bookId: book.id }),
    api.epubProgress.get({ bookId: book.id })
  ]);

  if (!epubResult.ok) {
    throw new Error(epubResult.error);
  }
  if (!progressResult.ok) {
    throw new Error(progressResult.error);
  }

  const epubBook = ePub(epubResult.base64, { encoding: 'base64' });

  try {
    await epubBook.ready;
    await epubBook.locations?.generate?.(1000);

    const pageCount = epubBook.locations?.length?.() ?? null;
    const progressPercent =
      progressResult.cfi && epubBook.locations?.percentageFromCfi
        ? epubBook.locations.percentageFromCfi(progressResult.cfi) * 100
        : 0;

    return {
      pageCount,
      progressPercent,
      progressLabel: formatPercent(progressPercent),
      pageCountLabel: pageCount ? `${pageCount} locations` : 'EPUB'
    };
  } finally {
    epubBook.destroy?.();
  }
}

async function loadBookMetric(book: Book): Promise<BookMetric> {
  if (book.format === 'pdf') {
    return loadPdfMetric(book);
  }

  return loadEpubMetric(book);
}

export function useLibraryBookMetrics(books: Book[]) {
  const [metrics, setMetrics] = React.useState<Record<string, BookMetric>>({});

  React.useEffect(() => {
    let canceled = false;

    const load = async () => {
      const entries = await Promise.all(
        books.map(async (book) => {
          try {
            const metric = await loadBookMetric(book);
            return [book.id, metric] as const;
          } catch {
            return [
              book.id,
              {
                pageCount: null,
                progressPercent: null,
                progressLabel: 'Progress unavailable',
                pageCountLabel: book.format === 'pdf' ? 'Pages unavailable' : 'EPUB'
              }
            ] as const;
          }
        })
      );

      if (!canceled) {
        setMetrics(Object.fromEntries(entries));
      }
    };

    if (books.length === 0) {
      setMetrics({});
      return () => {
        canceled = true;
      };
    }

    void load();

    return () => {
      canceled = true;
    };
  }, [books]);

  return metrics;
}

export function useRecentBooks() {
  const [recentBooks, setRecentBooks] = React.useState<RecentBookEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let canceled = false;

    const load = async () => {
      setLoading(true);
      try {
        const result = await getRendererApi().stats.getRecentBooks();
        if (!canceled && result.ok) {
          setRecentBooks(result.books);
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      canceled = true;
    };
  }, []);

  return { recentBooks, loading };
}
