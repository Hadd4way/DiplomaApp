import * as React from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type PdfSearchResult = {
  page: number;
  snippet: string;
  start: number;
  end: number;
};

type UsePdfSearchState = {
  query: string;
  results: PdfSearchResult[];
  isSearching: boolean;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  clearQuery: () => void;
};

const PAGE_BATCH_SIZE = 7;
const MAX_RESULTS = 200;
const SNIPPET_RADIUS = 40;

function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function buildSnippet(text: string, matchStart: number, matchEnd: number): Pick<PdfSearchResult, 'snippet' | 'start' | 'end'> {
  const snippetStart = Math.max(0, matchStart - SNIPPET_RADIUS);
  const snippetEnd = Math.min(text.length, matchEnd + SNIPPET_RADIUS);
  const snippetPrefix = snippetStart > 0 ? '...' : '';
  const snippetSuffix = snippetEnd < text.length ? '...' : '';
  const snippetCore = text.slice(snippetStart, snippetEnd);
  const snippet = `${snippetPrefix}${snippetCore}${snippetSuffix}`;
  const start = snippetPrefix.length + (matchStart - snippetStart);
  const end = start + (matchEnd - matchStart);
  return { snippet, start, end };
}

async function extractPageText(pdfDoc: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await pdfDoc.getPage(pageNumber);
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item) => {
      if (typeof item === 'object' && item !== null && 'str' in item) {
        const value = (item as { str?: unknown }).str;
        return typeof value === 'string' ? value : '';
      }
      return '';
    })
    .join(' ');
}

export function usePdfSearch(pdfDoc: PDFDocumentProxy | null, bookId: string): UsePdfSearchState {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<PdfSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const pageTextCacheRef = React.useRef<Map<number, string>>(new Map());
  const pageTextPromiseCacheRef = React.useRef<Map<number, Promise<string>>>(new Map());
  const searchTokenRef = React.useRef(0);

  const clearQuery = React.useCallback(() => {
    setQuery('');
  }, []);

  const getPageText = React.useCallback(
    async (pageNumber: number): Promise<string> => {
      const cached = pageTextCacheRef.current.get(pageNumber);
      if (cached !== undefined) {
        return cached;
      }

      const pending = pageTextPromiseCacheRef.current.get(pageNumber);
      if (pending) {
        return pending;
      }

      if (!pdfDoc) {
        return '';
      }

      const task = extractPageText(pdfDoc, pageNumber)
        .then((text) => {
          pageTextCacheRef.current.set(pageNumber, text);
          pageTextPromiseCacheRef.current.delete(pageNumber);
          return text;
        })
        .catch((error) => {
          pageTextPromiseCacheRef.current.delete(pageNumber);
          throw error;
        });

      pageTextPromiseCacheRef.current.set(pageNumber, task);
      return task;
    },
    [pdfDoc]
  );

  React.useEffect(() => {
    setQuery('');
    setResults([]);
    setIsSearching(false);
    pageTextCacheRef.current.clear();
    pageTextPromiseCacheRef.current.clear();
    searchTokenRef.current += 1;
  }, [bookId]);

  React.useEffect(() => {
    const activeToken = searchTokenRef.current + 1;
    searchTokenRef.current = activeToken;

    const trimmedQuery = query.trim();
    if (!pdfDoc || !trimmedQuery) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let canceled = false;
    const normalizedNeedle = trimmedQuery.toLowerCase();

    const run = async () => {
      setIsSearching(true);
      const nextResults: PdfSearchResult[] = [];

      for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
        if (canceled || searchTokenRef.current !== activeToken) {
          return;
        }

        try {
          const pageText = await getPageText(pageNumber);
          const haystack = pageText.toLowerCase();
          let fromIndex = 0;

          while (fromIndex < haystack.length && nextResults.length < MAX_RESULTS) {
            const matchStart = haystack.indexOf(normalizedNeedle, fromIndex);
            if (matchStart < 0) {
              break;
            }
            const matchEnd = matchStart + normalizedNeedle.length;
            const snippetData = buildSnippet(pageText, matchStart, matchEnd);
            nextResults.push({
              page: pageNumber,
              snippet: snippetData.snippet,
              start: snippetData.start,
              end: snippetData.end
            });
            fromIndex = matchEnd;
          }
        } catch {
        }

        if (pageNumber % PAGE_BATCH_SIZE === 0 || nextResults.length >= MAX_RESULTS) {
          if (canceled || searchTokenRef.current !== activeToken) {
            return;
          }
          setResults([...nextResults]);
          await nextTick();
        }

        if (nextResults.length >= MAX_RESULTS) {
          break;
        }
      }

      if (canceled || searchTokenRef.current !== activeToken) {
        return;
      }
      setResults(nextResults);
      setIsSearching(false);
    };

    void run().finally(() => {
      if (canceled || searchTokenRef.current !== activeToken) {
        return;
      }
      setIsSearching(false);
    });

    return () => {
      canceled = true;
    };
  }, [getPageText, pdfDoc, query]);

  return {
    query,
    results,
    isSearching,
    setQuery,
    clearQuery
  };
}
