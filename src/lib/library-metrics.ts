import * as React from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker?url';
import ePub from 'epubjs';
import { parseFb2Document } from '@/lib/fb2';
import { parseTxtDocument } from '@/lib/txt';
import type { Book, RecentBookEntry } from '../../shared/ipc';

GlobalWorkerOptions.workerSrc = workerSrc;

export type BookMetric = {
  pageCount: number | null;
  currentLocation: number | null;
  progressPercent: number | null;
  progressLabel: string;
  pageCountLabel: string;
  currentLocationLabel: string;
};

export type BookActivitySummary = {
  highlightCount: number;
  bookmarkCount: number;
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
    currentLocation: safeLastPage,
    progressPercent,
    progressLabel: formatPercent(progressPercent),
    pageCountLabel: `${pageCount} pages`,
    currentLocationLabel: safeLastPage ? `Page ${safeLastPage} / ${pageCount}` : `Start on page 1`
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
      currentLocation: progressResult.cfi ? 1 : null,
      progressPercent,
      progressLabel: formatPercent(progressPercent),
      pageCountLabel: pageCount ? `${pageCount} locations` : 'EPUB',
      currentLocationLabel: progressResult.cfi ? 'Continue Reading' : 'Start Reading'
    };
  } finally {
    epubBook.destroy?.();
  }
}

async function loadFb2Metric(book: Book): Promise<BookMetric> {
  const api = getRendererApi();
  const [fb2Result, progressResult] = await Promise.all([
    api.books.getFb2Data({ bookId: book.id }),
    api.flowProgress.get({ bookId: book.id })
  ]);

  if (!fb2Result.ok) {
    throw new Error(fb2Result.error);
  }
  if (!progressResult.ok) {
    throw new Error(progressResult.error);
  }

  const parsed = parseFb2Document(fb2Result.content);
  const chapterCount = parsed.chapters.length || null;
  const chapterIndex = progressResult.progress.chapterIndex;
  const progressPercent =
    chapterCount && chapterIndex !== null
      ? ((chapterIndex + (progressResult.progress.scrollRatio ?? 0)) / chapterCount) * 100
      : 0;

  return {
    pageCount: chapterCount,
    currentLocation: chapterIndex,
    progressPercent,
    progressLabel: formatPercent(progressPercent),
    pageCountLabel: chapterCount ? `${chapterCount} chapters` : 'FB2',
    currentLocationLabel: chapterIndex !== null ? `Chapter ${chapterIndex + 1}` : 'Start Reading'
  };
}

async function loadTxtMetric(book: Book): Promise<BookMetric> {
  const api = getRendererApi();
  const [txtResult, progressResult] = await Promise.all([
    api.books.getTxtData({ bookId: book.id }),
    api.flowProgress.get({ bookId: book.id })
  ]);

  if (!txtResult.ok) {
    throw new Error(txtResult.error);
  }
  if (!progressResult.ok) {
    throw new Error(progressResult.error);
  }

  const parsed = parseTxtDocument(txtResult.content, txtResult.title);
  const sectionCount = parsed.chapters.length || null;
  const chapterIndex = progressResult.progress.chapterIndex;
  const progressPercent =
    sectionCount && chapterIndex !== null
      ? ((chapterIndex + (progressResult.progress.scrollRatio ?? 0)) / sectionCount) * 100
      : 0;

  return {
    pageCount: sectionCount,
    currentLocation: chapterIndex,
    progressPercent,
    progressLabel: formatPercent(progressPercent),
    pageCountLabel: sectionCount ? `${sectionCount} sections` : 'TXT',
    currentLocationLabel: chapterIndex !== null ? `Section ${chapterIndex + 1}` : 'Start Reading'
  };
}

async function loadBookMetric(book: Book): Promise<BookMetric> {
  if (book.format === 'pdf') {
    return loadPdfMetric(book);
  }
  if (book.format === 'fb2') {
    return loadFb2Metric(book);
  }
  if (book.format === 'txt') {
    return loadTxtMetric(book);
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
                currentLocation: null,
                progressPercent: null,
                progressLabel: 'Progress unavailable',
                pageCountLabel:
                  book.format === 'pdf' ? 'Pages unavailable' : book.format === 'fb2' ? 'FB2' : book.format === 'txt' ? 'TXT' : 'EPUB',
                currentLocationLabel:
                  book.format === 'pdf' ? 'Page unavailable' : 'Continue Reading'
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

export function useLibraryBookActivity(books: Book[]) {
  const [activity, setActivity] = React.useState<Record<string, BookActivitySummary>>({});

  React.useEffect(() => {
    let canceled = false;

    const load = async () => {
      const entries = await Promise.all(
        books.map(async (book) => {
          try {
            const api = getRendererApi();

            if (book.format === 'pdf') {
              const [highlightsResult, bookmarksResult] = await Promise.all([
                api.highlights.list({ bookId: book.id }),
                api.bookmarks.list({ bookId: book.id })
              ]);

              return [
                book.id,
                {
                  highlightCount: highlightsResult.ok ? highlightsResult.highlights.length : 0,
                  bookmarkCount: bookmarksResult.ok ? bookmarksResult.bookmarks.length : 0
                }
              ] as const;
            }

            const [highlightsResult, bookmarksResult] = await Promise.all([
              api.epubHighlights.list({ bookId: book.id }),
              api.epubBookmarks.list({ bookId: book.id })
            ]);

            return [
              book.id,
              {
                highlightCount: highlightsResult.ok ? highlightsResult.highlights.length : 0,
                bookmarkCount: bookmarksResult.ok ? bookmarksResult.bookmarks.length : 0
              }
            ] as const;
          } catch {
            return [
              book.id,
              {
                highlightCount: 0,
                bookmarkCount: 0
              }
            ] as const;
          }
        })
      );

      if (!canceled) {
        setActivity(Object.fromEntries(entries));
      }
    };

    if (books.length === 0) {
      setActivity({});
      return () => {
        canceled = true;
      };
    }

    void load();

    return () => {
      canceled = true;
    };
  }, [books]);

  return activity;
}

export function useRecentBooks(refreshKey?: string) {
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
  }, [refreshKey]);

  return { recentBooks, loading };
}
