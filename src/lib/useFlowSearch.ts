import * as React from 'react';
import { DEBOUNCE_MS } from '@/lib/constants';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

export type FlowSearchResult = {
  id: string;
  blockId: string;
  excerpt: string;
  start: number;
  end: number;
  chapterIndex: number;
  chapterLabel?: string;
};

type SearchBlock = {
  id: string;
  chapterIndex: number;
  chapterTitle: string;
  text: string;
};

type UseFlowSearchState = {
  query: string;
  results: FlowSearchResult[];
  isSearching: boolean;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  clearQuery: () => void;
};

const MAX_RESULTS = 200;
const queryCacheByBook = new Map<string, Map<string, FlowSearchResult[]>>();

function buildExcerpt(text: string, query: string): Pick<FlowSearchResult, 'excerpt' | 'start' | 'end'> {
  const normalized = text.trim() || query;
  const lowerText = normalized.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);
  const startIndex = matchIndex >= 0 ? matchIndex : 0;
  const endIndex = matchIndex >= 0 ? startIndex + query.length : Math.min(normalized.length, query.length);
  const windowStart = Math.max(0, startIndex - 40);
  const windowEnd = Math.min(normalized.length, endIndex + 60);
  const excerpt = normalized.slice(windowStart, windowEnd).trim();
  return {
    excerpt,
    start: Math.max(0, startIndex - windowStart),
    end: Math.max(0, endIndex - windowStart)
  };
}

export function useFlowSearch(blocks: SearchBlock[], bookId: string): UseFlowSearchState {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<FlowSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS.search);
  const queryCacheRef = React.useRef<Map<string, FlowSearchResult[]>>(queryCacheByBook.get(bookId) ?? new Map());

  const clearQuery = React.useCallback(() => {
    setQuery('');
  }, []);

  React.useEffect(() => {
    let cache = queryCacheByBook.get(bookId);
    if (!cache) {
      cache = new Map();
      queryCacheByBook.set(bookId, cache);
    }
    queryCacheRef.current = cache;
    setQuery('');
    setResults([]);
    setIsSearching(false);
  }, [bookId]);

  React.useEffect(() => {
    const trimmedQuery = debouncedQuery.trim();
    if (!trimmedQuery) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let canceled = false;
    const cacheKey = `${bookId}:${trimmedQuery.toLowerCase()}`;
    const cachedResults = queryCacheRef.current.get(cacheKey);
    if (cachedResults) {
      setResults(cachedResults);
      setIsSearching(false);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      const nextResults: FlowSearchResult[] = [];
      for (let index = 0; index < blocks.length && nextResults.length < MAX_RESULTS; index += 1) {
        const block = blocks[index];
        const lowerText = block.text.toLowerCase();
        const lowerQuery = trimmedQuery.toLowerCase();
        if (!lowerText.includes(lowerQuery)) {
          continue;
        }

        const excerpt = buildExcerpt(block.text, trimmedQuery);
        nextResults.push({
          id: `${block.id}:${nextResults.length}`,
          blockId: block.id,
          excerpt: excerpt.excerpt,
          start: excerpt.start,
          end: excerpt.end,
          chapterIndex: block.chapterIndex,
          chapterLabel: block.chapterTitle || undefined
        });
      }

      if (!canceled) {
        queryCacheRef.current.set(cacheKey, nextResults);
        setResults(nextResults);
        setIsSearching(false);
      }
    }, 0);

    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [blocks, bookId, debouncedQuery]);

  return {
    query,
    results,
    isSearching,
    setQuery,
    clearQuery
  };
}
