import * as React from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker?url';
import ePub from 'epubjs';
import { useLanguage } from '@/contexts/LanguageContext';
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

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bytes = base64ToUint8Array(base64);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number | null, t: ReturnType<typeof useLanguage>['t']): string {
  if (value === null) {
    return t.bookCard.noProgressYet;
  }
  return `${Math.round(clampPercent(value))}${t.bookCard.percentRead}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function getMetricFallback(book: Book, t: ReturnType<typeof useLanguage>['t']): BookMetric {
  return {
    pageCount: null,
    currentLocation: null,
    progressPercent: null,
    progressLabel: t.bookCard.progressUnavailable,
    pageCountLabel:
      book.format === 'pdf' ? t.bookCard.pagesUnavailable : book.format === 'fb2' ? 'FB2' : book.format === 'txt' ? 'TXT' : 'EPUB',
    currentLocationLabel: book.format === 'pdf' ? t.bookCard.pageUnavailable : t.bookCard.continueReading
  };
}

function getActivityFallback(): BookActivitySummary {
  return {
    highlightCount: 0,
    bookmarkCount: 0
  };
}

async function loadPdfMetric(book: Book, t: ReturnType<typeof useLanguage>['t']): Promise<BookMetric> {
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
    progressLabel: formatPercent(progressPercent, t),
    pageCountLabel: `${pageCount} ${t.bookCard.pages}`,
    currentLocationLabel: safeLastPage ? `${t.bookCard.pageOf} ${safeLastPage} / ${pageCount}` : t.bookCard.startOnPage
  };
}

async function loadEpubMetric(book: Book, t: ReturnType<typeof useLanguage>['t']): Promise<BookMetric> {
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

  const epubArrayBuffer = base64ToArrayBuffer(epubResult.base64);
  const openCandidates = [
    () => ePub(epubArrayBuffer, { openAs: 'binary' }),
    () => ePub(epubArrayBuffer, { openAs: 'epub', replacements: 'blobUrl' }),
    () => ePub(epubArrayBuffer, { replacements: 'blobUrl' }),
    () => ePub(epubResult.base64, { openAs: 'base64', replacements: 'blobUrl' }),
    () => ePub(epubResult.base64, { encoding: 'base64' })
  ];

  let epubBook: ReturnType<typeof ePub> | null = null;

  try {
    let lastError: unknown = null;
    for (const createBook of openCandidates) {
      let candidate: ReturnType<typeof ePub> | null = null;
      try {
        candidate = createBook();
        await withTimeout(candidate.ready, 8000, `Timed out while opening EPUB "${book.title}".`);
        epubBook = candidate;
        break;
      } catch (error) {
        lastError = error;
        candidate?.destroy?.();
      }
    }

    if (!epubBook) {
      throw lastError instanceof Error ? lastError : new Error('Failed to open EPUB for metrics.');
    }

    try {
      await withTimeout(
        epubBook.locations?.generate?.(1000) ?? Promise.resolve(),
        12000,
        `Timed out while generating EPUB locations for "${book.title}".`
      );
    } catch {
      // Fall back to spine length if locations generation is too slow or unsupported.
    }

    const generatedLocationCount = epubBook.locations?.length?.() ?? null;
    const spineSectionCount =
      Array.isArray((epubBook as { spine?: { spineItems?: unknown[]; items?: unknown[] } }).spine?.spineItems)
        ? (epubBook as { spine?: { spineItems?: unknown[] } }).spine?.spineItems?.length ?? null
        : Array.isArray((epubBook as { spine?: { items?: unknown[] } }).spine?.items)
          ? (epubBook as { spine?: { items?: unknown[] } }).spine?.items?.length ?? null
          : null;
    const pageCount = generatedLocationCount || spineSectionCount || null;
    const progressPercent = progressResult.cfi
      ? epubBook.locations?.percentageFromCfi && generatedLocationCount
        ? epubBook.locations.percentageFromCfi(progressResult.cfi) * 100
        : spineSectionCount
          ? Math.min(100, Math.max(1, (1 / spineSectionCount) * 100))
          : 0
      : 0;
    const pageCountLabel = generatedLocationCount
      ? `${generatedLocationCount} ${t.bookCard.locations}`
      : spineSectionCount
        ? `${spineSectionCount} ${t.bookCard.sections}`
        : 'EPUB';

    return {
      pageCount,
      currentLocation: progressResult.cfi ? 1 : null,
      progressPercent,
      progressLabel: formatPercent(progressPercent, t),
      pageCountLabel,
      currentLocationLabel: progressResult.cfi ? t.bookCard.continueReading : t.bookCard.startReading
    };
  } finally {
    epubBook.destroy?.();
  }
}

async function loadFb2Metric(book: Book, t: ReturnType<typeof useLanguage>['t']): Promise<BookMetric> {
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
    progressLabel: formatPercent(progressPercent, t),
    pageCountLabel: chapterCount ? `${chapterCount} ${t.bookCard.chapters}` : 'FB2',
    currentLocationLabel: chapterIndex !== null ? `${t.bookCard.chapter} ${chapterIndex + 1}` : t.bookCard.startReading
  };
}

async function loadTxtMetric(book: Book, t: ReturnType<typeof useLanguage>['t']): Promise<BookMetric> {
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
    progressLabel: formatPercent(progressPercent, t),
    pageCountLabel: sectionCount ? `${sectionCount} ${t.bookCard.sections}` : 'TXT',
    currentLocationLabel: chapterIndex !== null ? `${t.bookCard.section} ${chapterIndex + 1}` : t.bookCard.startReading
  };
}

async function loadBookMetric(book: Book, t: ReturnType<typeof useLanguage>['t']): Promise<BookMetric> {
  if (book.format === 'pdf') {
    return loadPdfMetric(book, t);
  }
  if (book.format === 'fb2') {
    return loadFb2Metric(book, t);
  }
  if (book.format === 'txt') {
    return loadTxtMetric(book, t);
  }

  return loadEpubMetric(book, t);
}

function useLibraryRefreshSignal(refreshKey?: string) {
  const [refreshSignal, setRefreshSignal] = React.useState(0);

  React.useEffect(() => {
    setRefreshSignal((value) => value + 1);
  }, [refreshKey]);

  return refreshSignal;
}

export function useLibraryBookMetrics(books: Book[], refreshKey?: string) {
  const { t } = useLanguage();
  const [metrics, setMetrics] = React.useState<Record<string, BookMetric>>({});
  const refreshSignal = useLibraryRefreshSignal(refreshKey);

  React.useEffect(() => {
    let canceled = false;

    if (books.length === 0) {
      setMetrics({});
      return () => {
        canceled = true;
      };
    }

    const nextMetrics = Object.fromEntries(books.map((book) => [book.id, getMetricFallback(book, t)]));
    setMetrics(nextMetrics);

    for (const book of books) {
      void withTimeout(loadBookMetric(book, t), 15000, `Timed out while loading metrics for ${book.title}`)
        .then((metric) => {
          if (canceled) {
            return;
          }
          setMetrics((current) => ({
            ...current,
            [book.id]: metric
          }));
        })
        .catch(() => {
          if (canceled) {
            return;
          }
          setMetrics((current) => ({
            ...current,
            [book.id]: getMetricFallback(book, t)
          }));
        });
    }

    return () => {
      canceled = true;
    };
  }, [books, refreshSignal, t]);

  return metrics;
}

export function useLibraryBookActivity(books: Book[], refreshKey?: string) {
  const [activity, setActivity] = React.useState<Record<string, BookActivitySummary>>({});
  const refreshSignal = useLibraryRefreshSignal(refreshKey);

  React.useEffect(() => {
    let canceled = false;

    if (books.length === 0) {
      setActivity({});
      return () => {
        canceled = true;
      };
    }

    setActivity(Object.fromEntries(books.map((book) => [book.id, getActivityFallback()])));

    for (const book of books) {
      void withTimeout(
        (async () => {
          const api = getRendererApi();

          if (book.format === 'pdf') {
            const [highlightsResult, bookmarksResult] = await Promise.all([
              api.highlights.list({ bookId: book.id }),
              api.bookmarks.list({ bookId: book.id })
            ]);

            return {
              highlightCount: highlightsResult.ok ? highlightsResult.highlights.length : 0,
              bookmarkCount: bookmarksResult.ok ? bookmarksResult.bookmarks.length : 0
            };
          }

          const [highlightsResult, bookmarksResult] = await Promise.all([
            api.epubHighlights.list({ bookId: book.id }),
            api.epubBookmarks.list({ bookId: book.id })
          ]);

          return {
            highlightCount: highlightsResult.ok ? highlightsResult.highlights.length : 0,
            bookmarkCount: bookmarksResult.ok ? bookmarksResult.bookmarks.length : 0
          };
        })(),
        10000,
        `Timed out while loading activity for ${book.title}`
      )
        .then((summary) => {
          if (canceled) {
            return;
          }
          setActivity((current) => ({
            ...current,
            [book.id]: summary
          }));
        })
        .catch(() => {
          if (canceled) {
            return;
          }
          setActivity((current) => ({
            ...current,
            [book.id]: getActivityFallback()
          }));
        });
    }

    return () => {
      canceled = true;
    };
  }, [books, refreshSignal]);

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
