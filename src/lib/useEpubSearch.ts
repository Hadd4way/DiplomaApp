import * as React from 'react';

export type EpubSearchResult = {
  id: string;
  cfi: string;
  excerpt: string;
  chapterLabel?: string;
  spineIndex: number;
  start: number;
  end: number;
};

type EpubSearchBook = {
  ready?: Promise<unknown>;
  load?: (path: string) => Promise<unknown>;
  spine?: {
    spineItems?: Array<{
      href?: string;
      index?: number;
      load?: (request?: (path: string) => Promise<unknown>) => Promise<unknown>;
      unload?: () => void;
      search?: (query: string, maxSeqEle?: number) => Array<{ cfi?: string; excerpt?: string }>;
      find?: (query: string) => Array<{ cfi?: string; excerpt?: string }>;
    }>;
  };
};

type UseEpubSearchState = {
  query: string;
  results: EpubSearchResult[];
  isSearching: boolean;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  clearQuery: () => void;
};

const SEARCH_DEBOUNCE_MS = 250;
const SECTION_BATCH_SIZE = 2;
const MAX_RESULTS = 200;

function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function normalizeExcerpt(rawExcerpt: string | undefined, query: string): Pick<EpubSearchResult, 'excerpt' | 'start' | 'end'> {
  const excerpt = rawExcerpt?.trim() || query;
  const lowerExcerpt = excerpt.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const rawStart = lowerExcerpt.indexOf(lowerQuery);
  const start = rawStart >= 0 ? rawStart : 0;
  const end = rawStart >= 0 ? start + query.length : Math.min(excerpt.length, query.length);
  return { excerpt, start, end };
}

export function useEpubSearch(
  book: EpubSearchBook | null,
  bookId: string,
  getChapterLabel: (href: string | null) => string | null
): UseEpubSearchState {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<EpubSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const searchTokenRef = React.useRef(0);

  const clearQuery = React.useCallback(() => {
    setQuery('');
  }, []);

  React.useEffect(() => {
    setQuery('');
    setResults([]);
    setIsSearching(false);
    searchTokenRef.current += 1;
  }, [bookId]);

  React.useEffect(() => {
    const activeToken = searchTokenRef.current + 1;
    searchTokenRef.current = activeToken;

    const trimmedQuery = query.trim();
    if (!book || !trimmedQuery) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let canceled = false;
    const debounceTimer = setTimeout(() => {
      const run = async () => {
        setIsSearching(true);
        try {
          await book.ready;
          const sections = book.spine?.spineItems ?? [];
          const nextResults: EpubSearchResult[] = [];

          for (let index = 0; index < sections.length; index += 1) {
            if (canceled || searchTokenRef.current !== activeToken) {
              return;
            }

            const section = sections[index];
            if (!section) {
              continue;
            }

            try {
              await section.load?.(book.load?.bind(book));
              const rawMatches =
                (typeof section.search === 'function' ? section.search(trimmedQuery) : section.find?.(trimmedQuery)) ?? [];

              for (let matchIndex = 0; matchIndex < rawMatches.length && nextResults.length < MAX_RESULTS; matchIndex += 1) {
                const match = rawMatches[matchIndex];
                const cfi = match?.cfi?.trim();
                if (!cfi) {
                  continue;
                }
                const excerptData = normalizeExcerpt(match.excerpt, trimmedQuery);
                nextResults.push({
                  id: `${section.index ?? index}:${matchIndex}:${cfi}`,
                  cfi,
                  excerpt: excerptData.excerpt,
                  chapterLabel: getChapterLabel(section.href?.trim() ?? null) ?? undefined,
                  spineIndex: typeof section.index === 'number' ? section.index : index,
                  start: excerptData.start,
                  end: excerptData.end
                });
              }
            } catch {
            }

            if ((index + 1) % SECTION_BATCH_SIZE === 0 || nextResults.length >= MAX_RESULTS) {
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

          nextResults.sort((left, right) => {
            if (left.spineIndex !== right.spineIndex) {
              return left.spineIndex - right.spineIndex;
            }
            return left.id.localeCompare(right.id);
          });
          setResults(nextResults);
        } finally {
          if (!canceled && searchTokenRef.current === activeToken) {
            setIsSearching(false);
          }
        }
      };

      void run();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      canceled = true;
      clearTimeout(debounceTimer);
    };
  }, [book, getChapterLabel, query]);

  return {
    query,
    results,
    isSearching,
    setQuery,
    clearQuery
  };
}
