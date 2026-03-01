import * as React from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ListTree,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Star,
  Trash2,
  X
} from 'lucide-react';
import { type PdfOutlineItem } from '@/components/outline-tree';
import { PdfSidebar } from '@/components/pdf-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlobalWorkerOptions, TextLayer, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker?url';
import type { Bookmark as BookmarkItem, Highlight, HighlightRect, Note } from '../../shared/ipc';
import { NoteEditorDialog } from '@/components/NoteEditorDialog';
import { usePdfSearch } from '@/lib/usePdfSearch';

GlobalWorkerOptions.workerSrc = workerSrc;

type Props = {
  title: string;
  base64: string;
  token: string;
  userId: string;
  bookId: string;
  initialPage?: number | null;
  onInitialPageApplied?: () => void;
  loading: boolean;
  onBack: () => void;
};

type ScaleMode = 'fitWidth' | 'fitPage' | 'manual';
type HighlightContextMenuState = { highlightId: string; x: number; y: number } | null;
type PendingHighlightDeletion = {
  id: string;
  highlight: Highlight;
};
type SearchPixelRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};
type SearchMatchRectGroup = {
  rects: SearchPixelRect[];
  bounds: SearchPixelRect;
};
type SearchLayerContext = {
  pageRoot: HTMLDivElement;
  textLayer: HTMLDivElement;
  overlayLayer: HTMLDivElement;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable;
}

function clampScale(nextScale: number): number {
  return Math.min(2.5, Math.max(0.5, nextScale));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function computeFitWidthScale(basePageWidth: number, availableWidth: number): number {
  if (basePageWidth <= 0 || availableWidth <= 0) {
    return 1;
  }
  return clampScale(availableWidth / basePageWidth);
}

function clampPage(nextPage: number, totalPages: number): number {
  if (!Number.isFinite(nextPage)) {
    return 1;
  }
  const safeTotal = Math.max(1, Math.floor(totalPages));
  const safeNext = Math.floor(nextPage);
  return Math.min(safeTotal, Math.max(1, safeNext));
}

function normalizeSelectionRect(rect: HighlightRect): HighlightRect | null {
  const x1 = clamp01(rect.x);
  const y1 = clamp01(rect.y);
  const x2 = clamp01(rect.x + rect.w);
  const y2 = clamp01(rect.y + rect.h);
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) {
    return null;
  }
  return { x: x1, y: y1, w, h };
}

function getHighlightBounds(rects: HighlightRect[]): HighlightRect | null {
  if (rects.length === 0) {
    return null;
  }
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const rect of rects) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.w);
    bottom = Math.max(bottom, rect.y + rect.h);
  }
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
    return null;
  }
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { x: left, y: top, w: width, h: height };
}

function pointInRect(x: number, y: number, rect: HighlightRect): boolean {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase();
}

function formatTimestamp(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  return new Date(value).toLocaleString();
}

function hasBookmarksApi(
  api: Window['api']
): api is NonNullable<Window['api']> & {
  bookmarks: {
    list: (payload: { token: string; bookId: string }) => Promise<unknown>;
    toggle: (payload: { token: string; bookId: string; page: number }) => Promise<unknown>;
    remove: (payload: { token: string; bookId: string; page: number }) => Promise<unknown>;
  };
} {
  return Boolean(
    api &&
      api.bookmarks &&
      typeof api.bookmarks.list === 'function' &&
      typeof api.bookmarks.toggle === 'function' &&
      typeof api.bookmarks.remove === 'function'
  );
}

function ensureSearchOverlayLayer(pageRoot: HTMLDivElement): HTMLDivElement {
  if (window.getComputedStyle(pageRoot).position === 'static') {
    pageRoot.style.position = 'relative';
  }
  const overlays = Array.from(pageRoot.querySelectorAll('[data-search-overlay]'));
  const [firstOverlay, ...extraOverlays] = overlays;
  for (const extraOverlay of extraOverlays) {
    extraOverlay.remove();
  }
  if (firstOverlay instanceof HTMLDivElement) {
    firstOverlay.className = 'absolute inset-0 z-[11] pointer-events-none';
    return firstOverlay;
  }
  const overlay = document.createElement('div');
  overlay.dataset.searchOverlay = 'true';
  overlay.className = 'absolute inset-0 z-[11] pointer-events-none';
  pageRoot.appendChild(overlay);
  return overlay;
}

function clearSearchOverlay(overlayLayer: HTMLDivElement): void {
  overlayLayer.replaceChildren();
}

function syncSearchOverlayBox(textLayer: HTMLDivElement, overlayLayer: HTMLDivElement): void {
  const parent = overlayLayer.parentElement;
  if (!(parent instanceof HTMLElement)) {
    return;
  }
  const parentRect = parent.getBoundingClientRect();
  const textLayerRect = textLayer.getBoundingClientRect();
  overlayLayer.style.left = `${textLayerRect.left - parentRect.left}px`;
  overlayLayer.style.top = `${textLayerRect.top - parentRect.top}px`;
  overlayLayer.style.width = `${textLayerRect.width}px`;
  overlayLayer.style.height = `${textLayerRect.height}px`;
}

function getTextLayerMetric(textLayer: HTMLDivElement): string {
  const spans = textLayer.querySelectorAll('span');
  const spanCount = spans.length;
  const tlRect = textLayer.getBoundingClientRect();
  const first = spans[0];
  const middle = spanCount > 0 ? spans[Math.floor(spanCount / 2)] : null;
  const last = spanCount > 0 ? spans[spanCount - 1] : null;
  const firstRect = first ? first.getBoundingClientRect() : null;
  const middleRect = middle ? middle.getBoundingClientRect() : null;
  const lastRect = last ? last.getBoundingClientRect() : null;
  return [
    spanCount,
    tlRect.width.toFixed(2),
    tlRect.height.toFixed(2),
    firstRect ? firstRect.left.toFixed(2) : '',
    firstRect ? firstRect.top.toFixed(2) : '',
    firstRect ? firstRect.width.toFixed(2) : '',
    firstRect ? firstRect.height.toFixed(2) : '',
    middleRect ? middleRect.left.toFixed(2) : '',
    middleRect ? middleRect.top.toFixed(2) : '',
    middleRect ? middleRect.width.toFixed(2) : '',
    middleRect ? middleRect.height.toFixed(2) : '',
    lastRect ? lastRect.left.toFixed(2) : '',
    lastRect ? lastRect.top.toFixed(2) : '',
    lastRect ? lastRect.width.toFixed(2) : '',
    lastRect ? lastRect.height.toFixed(2) : ''
  ].join('|');
}

function mergeSearchRects(rects: SearchPixelRect[]): SearchPixelRect[] {
  if (rects.length === 0) {
    return [];
  }
  const sorted = [...rects].sort((a, b) => {
    if (Math.abs(a.top - b.top) > 0.5) {
      return a.top - b.top;
    }
    return a.left - b.left;
  });
  const merged: SearchPixelRect[] = [];
  for (const rect of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...rect });
      continue;
    }
    const lastCenterY = last.top + last.height / 2;
    const nextCenterY = rect.top + rect.height / 2;
    const sameLine = Math.abs(lastCenterY - nextCenterY) < 3;
    const lastRight = last.left + last.width;
    const nextRight = rect.left + rect.width;
    const nearInX = rect.left - lastRight < 3;
    if (sameLine && nearInX) {
      const left = Math.min(last.left, rect.left);
      const top = Math.min(last.top, rect.top);
      const right = Math.max(lastRight, nextRight);
      const bottom = Math.max(last.top + last.height, rect.top + rect.height);
      last.left = left;
      last.top = top;
      last.width = right - left;
      last.height = bottom - top;
      continue;
    }
    merged.push({ ...rect });
  }
  return merged;
}

function getSearchRectBounds(rects: SearchPixelRect[]): SearchPixelRect | null {
  if (rects.length === 0) {
    return null;
  }
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const rect of rects) {
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.left + rect.width);
    bottom = Math.max(bottom, rect.top + rect.height);
  }
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
    return null;
  }
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { left, top, width, height };
}

function nextIndex(current: number, total: number): number {
  if (total <= 0) {
    return -1;
  }
  if (current < 0) {
    return 0;
  }
  return (current + 1) % total;
}

function prevIndex(current: number, total: number): number {
  if (total <= 0) {
    return -1;
  }
  if (current < 0) {
    return total - 1;
  }
  return (current - 1 + total) % total;
}

function getActiveMatchOrdinalOnPage(
  results: Array<{ page: number }>,
  currentPage: number,
  activeIndex: number
): number {
  if (activeIndex < 0 || activeIndex >= results.length) {
    return -1;
  }
  if (results[activeIndex]?.page !== currentPage) {
    return -1;
  }
  let ordinal = 0;
  for (let i = 0; i < activeIndex; i += 1) {
    if (results[i]?.page === currentPage) {
      ordinal += 1;
    }
  }
  return ordinal;
}

function scrollToActiveMatch(
  viewport: HTMLDivElement,
  overlayLayer: HTMLDivElement,
  activeGroup: SearchMatchRectGroup
): void {
  const viewportRect = viewport.getBoundingClientRect();
  const overlayRect = overlayLayer.getBoundingClientRect();
  const targetTop = overlayRect.top + activeGroup.bounds.top;
  const targetBottom = targetTop + activeGroup.bounds.height;
  const isVisible = targetTop >= viewportRect.top && targetBottom <= viewportRect.bottom;
  if (isVisible) {
    return;
  }
  const targetTopInScrollSpace = viewport.scrollTop + (targetTop - viewportRect.top);
  const offset = viewport.clientHeight * 0.25;
  viewport.scrollTo({
    top: Math.max(0, targetTopInScrollSpace - offset),
    behavior: 'smooth'
  });
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizeOutlineItems(items: unknown): PdfOutlineItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    const node = item as { title?: string; dest?: unknown; items?: unknown };
    return {
      title: node.title ?? '',
      dest: node.dest,
      items: normalizeOutlineItems(node.items)
    };
  });
}

export function PdfReaderScreen({
  title,
  base64,
  token,
  userId,
  bookId,
  initialPage = null,
  onInitialPageApplied,
  loading,
  onBack
}: Props) {
  const readerRootRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const pageStageRef = React.useRef<HTMLDivElement | null>(null);
  const pageRootRef = React.useRef<HTMLDivElement | null>(null);
  const textLayerRef = React.useRef<HTMLDivElement | null>(null);
  const searchOverlayRunIdRef = React.useRef(0);
  const searchOverlayRafRef = React.useRef<number | null>(null);
  const searchOverlayTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pageRootVersion, setPageRootVersion] = React.useState(0);
  const pageInputRef = React.useRef<HTMLInputElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const readerViewportRef = React.useRef<HTMLDivElement | null>(null);
  const [doc, setDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageCount, setPageCount] = React.useState(1);
  const [pageInputValue, setPageInputValue] = React.useState('1');
  const [pageInputError, setPageInputError] = React.useState<string | null>(null);
  const [scale, setScale] = React.useState(1);
  const [scaleMode, setScaleMode] = React.useState<ScaleMode>('fitWidth');
  const [fitWidthReady, setFitWidthReady] = React.useState(false);
  const [canvasWidth, setCanvasWidth] = React.useState<number>(0);
  const [canvasHeight, setCanvasHeight] = React.useState<number>(0);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const [rendering, setRendering] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [outlineItems, setOutlineItems] = React.useState<PdfOutlineItem[]>([]);
  const [outlineLoading, setOutlineLoading] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [pendingRestorePage, setPendingRestorePage] = React.useState<number | null>(null);
  const [progressLoaded, setProgressLoaded] = React.useState(false);
  const [restoreApplied, setRestoreApplied] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [noteContent, setNoteContent] = React.useState('');
  const [noteSaving, setNoteSaving] = React.useState(false);
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const [noteSuccess, setNoteSuccess] = React.useState<string | null>(null);
  const [notesPanelOpen, setNotesPanelOpen] = React.useState(false);
  const [bookmarksPanelOpen, setBookmarksPanelOpen] = React.useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = React.useState(false);
  const [bookNotes, setBookNotes] = React.useState<Note[]>([]);
  const [bookNotesLoading, setBookNotesLoading] = React.useState(false);
  const [bookNotesError, setBookNotesError] = React.useState<string | null>(null);
  const [bookmarks, setBookmarks] = React.useState<BookmarkItem[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = React.useState(false);
  const [bookmarksError, setBookmarksError] = React.useState<string | null>(null);
  const [pageHighlights, setPageHighlights] = React.useState<Highlight[]>([]);
  const [highlightContextMenu, setHighlightContextMenu] = React.useState<HighlightContextMenuState>(null);
  const [pendingHighlightDeletions, setPendingHighlightDeletions] = React.useState<PendingHighlightDeletion[]>([]);
  const outlinePageCacheRef = React.useRef<Map<string, number>>(new Map());
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeletionTimeoutsRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingHighlightDeletionsRef = React.useRef<PendingHighlightDeletion[]>([]);
  const latestPageRef = React.useRef(1);
  const canSaveRef = React.useRef(false);
  const lastSearchQueryRef = React.useRef('');
  const [activeSearchIndex, setActiveSearchIndex] = React.useState(-1);
  const { query: searchQuery, results: searchResults, isSearching, setQuery: setSearchQuery, clearQuery } = usePdfSearch(doc, bookId);
  const bookmarkedPages = React.useMemo(() => new Set(bookmarks.map((bookmark) => bookmark.page)), [bookmarks]);
  const isCurrentPageBookmarked = bookmarkedPages.has(page);

  const goPrev = React.useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const goNext = React.useCallback(() => {
    setPage((prev) => Math.min(pageCount, prev + 1));
  }, [pageCount]);

  const zoomIn = React.useCallback(() => {
    setScaleMode('manual');
    setScale((prev) => clampScale(Number((prev + 0.1).toFixed(1))));
  }, []);

  const zoomOut = React.useCallback(() => {
    setScaleMode('manual');
    setScale((prev) => clampScale(Number((prev - 0.1).toFixed(1))));
  }, []);

  const setFitMode = React.useCallback(() => {
    setScaleMode('fitWidth');
  }, []);

  const toggleContents = React.useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const toggleBookNotesPanel = React.useCallback(() => {
    setNotesPanelOpen((prev) => !prev);
  }, []);

  const openSearchPanel = React.useCallback(() => {
    setBookmarksPanelOpen(false);
    setSearchPanelOpen(true);
  }, []);

  const openBookmarksPanel = React.useCallback(() => {
    setSearchPanelOpen(false);
    setBookmarksPanelOpen(true);
  }, []);

  const focusReader = React.useCallback(() => {
    readerRootRef.current?.focus();
  }, []);

  const setPageRootNode = React.useCallback((node: HTMLDivElement | null) => {
    pageRootRef.current = node;
    if (node) {
      ensureSearchOverlayLayer(node);
      setPageRootVersion((prev) => prev + 1);
    }
  }, []);

  const clearScheduledSearchOverlayRecompute = React.useCallback(() => {
    if (searchOverlayRafRef.current !== null) {
      cancelAnimationFrame(searchOverlayRafRef.current);
      searchOverlayRafRef.current = null;
    }
    if (searchOverlayTimeoutRef.current !== null) {
      clearTimeout(searchOverlayTimeoutRef.current);
      searchOverlayTimeoutRef.current = null;
    }
  }, []);

  const waitForStableTextLayer = React.useCallback(
    async (runId: number): Promise<SearchLayerContext | null> => {
      const start = performance.now();
      let previousMetric: string | null = null;
      let stableCount = 0;

      while (performance.now() - start < 1200) {
        if (searchOverlayRunIdRef.current !== runId) {
          return null;
        }

        const pageRoot = pageRootRef.current;
        if (pageRoot) {
          const overlayLayer = ensureSearchOverlayLayer(pageRoot);
          const textLayerCandidate = pageRoot.querySelector('.textLayer');
          const textLayer = textLayerCandidate instanceof HTMLDivElement ? textLayerCandidate : null;
          if (textLayer) {
            const metric = getTextLayerMetric(textLayer);
            if (metric === previousMetric) {
              stableCount += 1;
            } else {
              stableCount = 0;
              previousMetric = metric;
            }
            if (stableCount >= 3) {
              return { pageRoot, textLayer, overlayLayer };
            }
          }
        }

        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }

      const pageRoot = pageRootRef.current;
      if (!pageRoot) {
        return null;
      }
      const bestEffortTextLayer = pageRoot.querySelector('.textLayer');
      const textLayer = bestEffortTextLayer instanceof HTMLDivElement ? bestEffortTextLayer : null;
      if (!textLayer) {
        return null;
      }
      const overlayLayer = ensureSearchOverlayLayer(pageRoot);
      return { pageRoot, textLayer, overlayLayer };
    },
    []
  );

  const computeAndRenderSearchOverlay = React.useCallback(
    (runId: number, context: SearchLayerContext) => {
      if (searchOverlayRunIdRef.current !== runId) {
        return;
      }

      const normalizedQuery = normalizeSearchText(searchQuery.trim());
      if (!normalizedQuery) {
        clearSearchOverlay(context.overlayLayer);
        return;
      }

      const { textLayer, overlayLayer } = context;
      const baseRect = overlayLayer.getBoundingClientRect();
      if (baseRect.width <= 0 || baseRect.height <= 0) {
        clearSearchOverlay(overlayLayer);
        return;
      }

      const spans = textLayer.querySelectorAll('span');
      const groups: SearchMatchRectGroup[] = [];
      const maxX = baseRect.width;
      const maxY = baseRect.height;
      for (const span of spans) {
        if (searchOverlayRunIdRef.current !== runId) {
          return;
        }
        const node = span.firstChild;
        if (!(node instanceof Text)) {
          continue;
        }
        const raw = node.textContent ?? '';
        if (!raw) {
          continue;
        }
        const rawLower = normalizeSearchText(raw);
        let startIndex = 0;
        while (startIndex < rawLower.length) {
          const matchIndex = rawLower.indexOf(normalizedQuery, startIndex);
          if (matchIndex < 0) {
            break;
          }
          const matchRects: SearchPixelRect[] = [];
          const range = document.createRange();
          range.setStart(node, matchIndex);
          range.setEnd(node, matchIndex + normalizedQuery.length);
          for (const rect of Array.from(range.getClientRects())) {
            if (
              !Number.isFinite(rect.left) ||
              !Number.isFinite(rect.top) ||
              !Number.isFinite(rect.width) ||
              !Number.isFinite(rect.height)
            ) {
              continue;
            }
            const unclampedLeft = rect.left - baseRect.left;
            const unclampedTop = rect.top - baseRect.top;
            const unclampedRight = unclampedLeft + rect.width;
            const unclampedBottom = unclampedTop + rect.height;
            const left = Math.max(0, unclampedLeft);
            const top = Math.max(0, unclampedTop);
            const right = Math.min(maxX, unclampedRight);
            const bottom = Math.min(maxY, unclampedBottom);
            const width = right - left;
            const height = bottom - top;
            if (width < 2 || height < 2) {
              continue;
            }
            matchRects.push({ left, top, width, height });
          }
          const mergedMatchRects = mergeSearchRects(matchRects);
          if (mergedMatchRects.length > 0) {
            const bounds = getSearchRectBounds(mergedMatchRects);
            if (bounds) {
              groups.push({ rects: mergedMatchRects, bounds });
            }
          }
          startIndex = matchIndex + Math.max(1, normalizedQuery.length);
        }
      }

      if (searchOverlayRunIdRef.current !== runId) {
        return;
      }

      const orderedGroups = [...groups].sort((a, b) => {
        if (Math.abs(a.bounds.top - b.bounds.top) > 0.5) {
          return a.bounds.top - b.bounds.top;
        }
        return a.bounds.left - b.bounds.left;
      });
      const activeOrdinalOnPage = getActiveMatchOrdinalOnPage(searchResults, page, activeSearchIndex);
      const activeGroupIndex =
        activeOrdinalOnPage >= 0 && activeOrdinalOnPage < orderedGroups.length ? activeOrdinalOnPage : -1;
      const fragment = document.createDocumentFragment();
      orderedGroups.forEach((group, groupIndex) => {
        const isActiveGroup = groupIndex === activeGroupIndex;
        for (const rect of group.rects) {
          const leftPercent = (rect.left / baseRect.width) * 100;
          const topPercent = (rect.top / baseRect.height) * 100;
          const widthPercent = (rect.width / baseRect.width) * 100;
          const heightPercent = (rect.height / baseRect.height) * 100;
          const box = document.createElement('div');
          box.style.position = 'absolute';
          box.style.left = `${leftPercent}%`;
          box.style.top = `${topPercent}%`;
          box.style.width = `${widthPercent}%`;
          box.style.height = `${heightPercent}%`;
          box.style.background = isActiveGroup ? 'rgba(255,193,7,0.55)' : 'rgba(255,235,59,0.35)';
          box.style.borderRadius = '2px';
          if (isActiveGroup) {
            box.style.outline = '1px solid rgba(146, 64, 14, 0.9)';
            box.style.outlineOffset = '-1px';
          }
          fragment.appendChild(box);
        }
      });
      overlayLayer.replaceChildren(fragment);
      if (activeGroupIndex >= 0) {
        const viewport = readerViewportRef.current;
        const activeGroup = orderedGroups[activeGroupIndex];
        if (viewport && activeGroup) {
          scrollToActiveMatch(viewport, overlayLayer, activeGroup);
        }
      }
    },
    [activeSearchIndex, page, searchQuery, searchResults]
  );

  const scheduleSearchOverlayRecompute = React.useCallback(
    (reason: string) => {
      void reason;
      const runId = searchOverlayRunIdRef.current + 1;
      searchOverlayRunIdRef.current = runId;
      clearScheduledSearchOverlayRecompute();
      if (!normalizeSearchText(searchQuery.trim())) {
        const pageRoot = pageRootRef.current;
        if (pageRoot) {
          clearSearchOverlay(ensureSearchOverlayLayer(pageRoot));
        }
        return;
      }
      searchOverlayTimeoutRef.current = setTimeout(() => {
        searchOverlayTimeoutRef.current = null;
        searchOverlayRafRef.current = requestAnimationFrame(() => {
          searchOverlayRafRef.current = null;
          void waitForStableTextLayer(runId).then((context) => {
            if (!context || searchOverlayRunIdRef.current !== runId) {
              return;
            }
            computeAndRenderSearchOverlay(runId, context);
          });
        });
      }, 0);
    },
    [clearScheduledSearchOverlayRecompute, computeAndRenderSearchOverlay, waitForStableTextLayer]
  );

  const navigateToSearchIndex = React.useCallback(
    (nextActiveIndex: number) => {
      const target = searchResults[nextActiveIndex];
      if (!target) {
        return;
      }
      setActiveSearchIndex(nextActiveIndex);
      setPageInputError(null);
      const targetPage = clampPage(target.page, pageCount);
      if (targetPage !== page) {
        setPage(targetPage);
        return;
      }
      scheduleSearchOverlayRecompute('active-match-navigation');
    },
    [page, pageCount, scheduleSearchOverlayRecompute, searchResults]
  );

  const goToNextSearchMatch = React.useCallback(() => {
    const nextActiveIndex = nextIndex(activeSearchIndex, searchResults.length);
    if (nextActiveIndex < 0) {
      return;
    }
    navigateToSearchIndex(nextActiveIndex);
  }, [activeSearchIndex, navigateToSearchIndex, searchResults.length]);

  const goToPrevSearchMatch = React.useCallback(() => {
    const previousActiveIndex = prevIndex(activeSearchIndex, searchResults.length);
    if (previousActiveIndex < 0) {
      return;
    }
    navigateToSearchIndex(previousActiveIndex);
  }, [activeSearchIndex, navigateToSearchIndex, searchResults.length]);

  const flushLastPageSave = React.useCallback(() => {
    if (!canSaveRef.current || !window.api) {
      return;
    }
    const safeUserId = userId.trim();
    const safeBookId = bookId.trim();
    if (!safeUserId || !safeBookId) {
      return;
    }
    void window.api.setLastPage(safeUserId, safeBookId, Math.max(1, latestPageRef.current));
  }, [bookId, userId]);

  const handleBack = React.useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    flushLastPageSave();
    onBack();
  }, [flushLastPageSave, onBack]);

  const openAddNote = React.useCallback(() => {
    setNoteError(null);
    setNoteSuccess(null);
    setNoteContent('');
    setNoteOpen(true);
  }, []);

  const saveNote = React.useCallback(async () => {
    if (!window.api) {
      setNoteError('Renderer API is unavailable. Open this app via Electron.');
      return;
    }

    const content = noteContent.trim();
    if (!content) {
      setNoteError('Note content is required.');
      return;
    }

    setNoteSaving(true);
    setNoteError(null);
    try {
      const result = await window.api.notes.create({
        token,
        bookId,
        page,
        content
      });
      if (!result.ok) {
        setNoteError(result.error);
        return;
      }

      setBookNotes((prev) => [result.note, ...prev].sort((a, b) => b.updatedAt - a.updatedAt));
      setNoteOpen(false);
      setNoteContent('');
      setNoteSuccess('Note added.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setNoteError(message);
    } finally {
      setNoteSaving(false);
    }
  }, [bookId, noteContent, page, token]);

  const loadBookNotes = React.useCallback(async () => {
    if (!window.api) {
      setBookNotesError('Renderer API is unavailable. Open this app via Electron.');
      return;
    }

    setBookNotesLoading(true);
    setBookNotesError(null);
    try {
      const result = await window.api.notes.list({ token, bookId, q: null });
      if (!result.ok) {
        setBookNotesError(result.error);
        return;
      }
      setBookNotes(result.notes);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setBookNotesError(message);
    } finally {
      setBookNotesLoading(false);
    }
  }, [bookId, token]);

  const loadBookmarks = React.useCallback(async () => {
    if (!hasBookmarksApi(window.api)) {
      setBookmarks([]);
      setBookmarksError('Bookmarks API is unavailable. Restart the app to reload Electron preload.');
      return;
    }

    setBookmarksLoading(true);
    setBookmarksError(null);
    try {
      const result = await window.api.bookmarks.list({ token, bookId });
      if (!result.ok) {
        setBookmarksError(result.error);
        setBookmarks([]);
        return;
      }
      setBookmarks(result.bookmarks);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setBookmarksError(message);
      setBookmarks([]);
    } finally {
      setBookmarksLoading(false);
    }
  }, [bookId, token]);

  const toggleBookmarkForPage = React.useCallback(
    async (targetPage: number) => {
      if (!hasBookmarksApi(window.api)) {
        setBookmarksError('Bookmarks API is unavailable. Restart the app to reload Electron preload.');
        return;
      }
      try {
        const result = await window.api.bookmarks.toggle({ token, bookId, page: targetPage });
        if (!result.ok) {
          setBookmarksError(result.error);
          return;
        }
        await loadBookmarks();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setBookmarksError(message);
      }
    },
    [bookId, loadBookmarks, token]
  );

  const removeBookmarkByPage = React.useCallback(
    async (targetPage: number) => {
      if (!hasBookmarksApi(window.api)) {
        setBookmarksError('Bookmarks API is unavailable. Restart the app to reload Electron preload.');
        return;
      }
      try {
        const result = await window.api.bookmarks.remove({ token, bookId, page: targetPage });
        if (!result.ok) {
          setBookmarksError(result.error);
          return;
        }
        await loadBookmarks();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setBookmarksError(message);
      }
    },
    [bookId, loadBookmarks, token]
  );

  const loadPageHighlights = React.useCallback(async () => {
    if (!window.api) {
      setPageHighlights([]);
      return;
    }
    try {
      const result = await window.api.highlights.list({ token, bookId, page });
      if (!result.ok) {
        setPageHighlights([]);
        return;
      }
      setPageHighlights(result.highlights);
    } catch {
      setPageHighlights([]);
    }
  }, [bookId, page, token]);

  const createHighlightFromSelection = React.useCallback(async () => {
    if (!window.api) {
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const stage = pageStageRef.current;
    const textLayer = textLayerRef.current;
    if (!stage || !textLayer) {
      return;
    }

    const range = selection.getRangeAt(0);
    const anchorNode = range.commonAncestorContainer;
    const ancestorElement = anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement;
    if (!ancestorElement || !textLayer.contains(ancestorElement)) {
      return;
    }

    const pageRect = stage.getBoundingClientRect();
    if (pageRect.width <= 0 || pageRect.height <= 0) {
      return;
    }

    const rects: HighlightRect[] = [];
    for (const clientRect of Array.from(range.getClientRects())) {
      const left = Math.max(clientRect.left, pageRect.left);
      const top = Math.max(clientRect.top, pageRect.top);
      const right = Math.min(clientRect.right, pageRect.right);
      const bottom = Math.min(clientRect.bottom, pageRect.bottom);
      const width = right - left;
      const height = bottom - top;
      if (width <= 0 || height <= 0) {
        continue;
      }
      const normalized = normalizeSelectionRect({
        x: (left - pageRect.left) / pageRect.width,
        y: (top - pageRect.top) / pageRect.height,
        w: width / pageRect.width,
        h: height / pageRect.height
      });
      if (!normalized) {
        continue;
      }
      if (normalized.w * normalized.h < 0.00001) {
        continue;
      }
      rects.push(normalized);
    }

    if (rects.length === 0) {
      selection.removeAllRanges();
      return;
    }

    try {
      const result = await window.api.highlights.createMerged({ token, bookId, page, rects });
      if (result.ok) {
        await loadPageHighlights();
      }
    } finally {
      selection.removeAllRanges();
    }
  }, [bookId, loadPageHighlights, page, token]);

  const finalizeHighlightDelete = React.useCallback(
    async (highlight: Highlight) => {
      if (!window.api) {
        return;
      }
      const safeId = highlight.id.trim();
      if (!safeId) {
        return;
      }
      try {
        const result = await window.api.highlights.delete({ token, highlightId: safeId });
        if (!result.ok && highlight.bookId === bookId && highlight.page === page) {
          await loadPageHighlights();
        }
      } catch {
        if (highlight.bookId === bookId && highlight.page === page) {
          await loadPageHighlights();
        }
      }
    },
    [bookId, loadPageHighlights, page, token]
  );

  const queueHighlightDeletion = React.useCallback(
    (highlight: Highlight) => {
      const safeId = highlight.id.trim();
      if (!safeId) {
        return;
      }

      const existingTimeout = pendingDeletionTimeoutsRef.current.get(safeId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      setPageHighlights((prev) => prev.filter((item) => item.id !== safeId));
      setPendingHighlightDeletions((prev) => {
        const filtered = prev.filter((item) => item.id !== safeId);
        return [...filtered, { id: safeId, highlight }];
      });
      setHighlightContextMenu(null);

      const timeoutId = setTimeout(() => {
        pendingDeletionTimeoutsRef.current.delete(safeId);
        setPendingHighlightDeletions((prev) => prev.filter((item) => item.id !== safeId));
        void finalizeHighlightDelete(highlight);
      }, 5000);

      pendingDeletionTimeoutsRef.current.set(safeId, timeoutId);
    },
    [finalizeHighlightDelete]
  );

  const undoHighlightDeletion = React.useCallback(
    async (pendingId: string) => {
      if (!window.api) {
        return;
      }
      const timeoutId = pendingDeletionTimeoutsRef.current.get(pendingId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        pendingDeletionTimeoutsRef.current.delete(pendingId);
      }

      const pending = pendingHighlightDeletions.find((item) => item.id === pendingId);
      if (!pending) {
        return;
      }

      setPendingHighlightDeletions((prev) => prev.filter((item) => item.id !== pendingId));

      try {
        const result = await window.api.highlights.insertRaw({
          token,
          bookId: pending.highlight.bookId,
          page: pending.highlight.page,
          rects: pending.highlight.rects
        });
        if (result.ok && pending.highlight.page === page && pending.highlight.bookId === bookId) {
          await loadPageHighlights();
        }
      } catch {
      }
    },
    [bookId, loadPageHighlights, page, pendingHighlightDeletions, token]
  );

  const openHighlightContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        return;
      }

      const stage = pageStageRef.current;
      if (!stage) {
        return;
      }
      const stageRect = stage.getBoundingClientRect();
      if (stageRect.width <= 0 || stageRect.height <= 0) {
        return;
      }

      const xNormalized = (event.clientX - stageRect.left) / stageRect.width;
      const yNormalized = (event.clientY - stageRect.top) / stageRect.height;

      const hit = pageHighlights.find((highlight) =>
        highlight.rects.some((rect) => pointInRect(xNormalized, yNormalized, rect))
      );
      if (!hit) {
        setHighlightContextMenu(null);
        return;
      }

      event.preventDefault();
      const x = Math.max(8, Math.min(stageRect.width - 8, event.clientX - stageRect.left));
      const y = Math.max(8, Math.min(stageRect.height - 8, event.clientY - stageRect.top));
      setHighlightContextMenu({ highlightId: hit.id, x, y });
    },
    [pageHighlights]
  );

  React.useEffect(() => {
    setBookNotes([]);
    setBookNotesError(null);
    setBookmarks([]);
    setBookmarksError(null);
    setBookmarksPanelOpen(false);
    setNotesPanelOpen(false);
    setHighlightContextMenu(null);
    setSearchPanelOpen(false);
    clearQuery();
  }, [bookId, clearQuery]);

  React.useEffect(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (lastSearchQueryRef.current !== normalizedQuery) {
      lastSearchQueryRef.current = normalizedQuery;
      setActiveSearchIndex(searchResults.length > 0 ? 0 : -1);
      return;
    }
    setActiveSearchIndex((prev) => {
      if (searchResults.length <= 0) {
        return -1;
      }
      if (prev < 0) {
        return 0;
      }
      return Math.min(prev, searchResults.length - 1);
    });
  }, [searchQuery, searchResults]);

  React.useEffect(() => {
    if (!searchPanelOpen) {
      return;
    }
    const timeoutId = setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [searchPanelOpen]);

  React.useEffect(() => {
    void loadBookmarks();
  }, [loadBookmarks]);

  React.useEffect(() => {
    void loadPageHighlights();
  }, [loadPageHighlights]);

  React.useEffect(() => {
    setHighlightContextMenu(null);
  }, [page, scale]);

  React.useEffect(() => {
    const closeMenuOnPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[data-highlight-menu="true"]')) {
        return;
      }
      setHighlightContextMenu(null);
    };
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHighlightContextMenu(null);
      }
    };
    const closeMenuOnScroll = () => {
      setHighlightContextMenu(null);
    };
    const viewportElement = readerViewportRef.current;
    document.addEventListener('pointerdown', closeMenuOnPointerDown);
    document.addEventListener('keydown', closeMenuOnEscape);
    viewportElement?.addEventListener('scroll', closeMenuOnScroll);
    return () => {
      document.removeEventListener('pointerdown', closeMenuOnPointerDown);
      document.removeEventListener('keydown', closeMenuOnEscape);
      viewportElement?.removeEventListener('scroll', closeMenuOnScroll);
    };
  }, []);

  React.useEffect(() => {
    pendingHighlightDeletionsRef.current = pendingHighlightDeletions;
  }, [pendingHighlightDeletions]);

  React.useEffect(() => {
    return () => {
      for (const timeoutId of pendingDeletionTimeoutsRef.current.values()) {
        clearTimeout(timeoutId);
      }
      const pending = [...pendingHighlightDeletionsRef.current];
      pendingDeletionTimeoutsRef.current.clear();
      for (const item of pending) {
        void finalizeHighlightDelete(item.highlight);
      }
    };
  }, [finalizeHighlightDelete]);

  React.useEffect(() => {
    if (!notesPanelOpen) {
      return;
    }

    void loadBookNotes();
  }, [loadBookNotes, notesPanelOpen]);

  React.useEffect(() => {
    latestPageRef.current = page;
  }, [page]);

  React.useEffect(() => {
    canSaveRef.current = Boolean(doc) && progressLoaded && restoreApplied;
  }, [doc, progressLoaded, restoreApplied]);

  React.useEffect(() => {
    let canceled = false;

    const loadLastPage = async () => {
      setProgressLoaded(false);
      setRestoreApplied(false);
      setPendingRestorePage(null);

      if (!window.api) {
        setProgressLoaded(true);
        return;
      }

      const safeUserId = userId.trim();
      const safeBookId = bookId.trim();
      if (!safeUserId || !safeBookId) {
        setProgressLoaded(true);
        return;
      }

      try {
        const savedLastPage = await window.api.getLastPage(safeUserId, safeBookId);
        if (!canceled) {
          setPendingRestorePage(savedLastPage);
        }
      } catch {
        if (!canceled) {
          setPendingRestorePage(null);
        }
      } finally {
        if (!canceled) {
          setProgressLoaded(true);
        }
      }
    };

    void loadLastPage();
    return () => {
      canceled = true;
    };
  }, [bookId, userId]);

  const tryJumpToPage = React.useCallback(
    (rawValue: string): boolean => {
      const trimmed = rawValue.trim();
      if (!/^\d+$/.test(trimmed)) {
        setPageInputError('Enter a whole page number.');
        return false;
      }

      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isInteger(parsed)) {
        setPageInputError('Enter a valid page number.');
        return false;
      }

      const clamped = Math.min(pageCount, Math.max(1, parsed));
      setPage(clamped);
      setPageInputError(null);
      setPageInputValue(String(clamped));
      return true;
    },
    [pageCount]
  );

  React.useEffect(() => {
    let canceled = false;

    const loadDocument = async () => {
      setError(null);
      setRendering(true);
      setRestoreApplied(false);
      setScaleMode('fitPage');
      setScale(1);
      setFitWidthReady(false);
      setCanvasWidth(0);
      setCanvasHeight(0);
      try {
        const data = base64ToUint8Array(base64);
        const loadedDoc = await getDocument({ data }).promise;
        if (canceled) {
          return;
        }
        setDoc(loadedDoc);
        setPage(1);
        setPageCount(loadedDoc.numPages);
      } catch {
        if (!canceled) {
          setError('Failed to load PDF.');
        }
      } finally {
        if (!canceled) {
          setRendering(false);
        }
      }
    };

    void loadDocument();
    return () => {
      canceled = true;
    };
  }, [base64]);

  React.useEffect(() => {
    if (!doc || !progressLoaded || restoreApplied) {
      return;
    }

    const preferredPage = initialPage && initialPage >= 1 ? initialPage : pendingRestorePage ?? 1;
    const nextPage = clampPage(preferredPage, doc.numPages);
    setPage(nextPage);
    setRestoreApplied(true);
    if (initialPage && initialPage >= 1) {
      onInitialPageApplied?.();
    }
  }, [doc, initialPage, onInitialPageApplied, pendingRestorePage, progressLoaded, restoreApplied]);

  React.useEffect(() => {
    const viewportElement = readerViewportRef.current;
    if (!viewportElement) {
      return;
    }

    const updateWidth = () => {
      setViewportWidth(viewportElement.clientWidth);
      setViewportHeight(viewportElement.clientHeight);
    };

    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }
        setViewportWidth(entry.contentRect.width);
        setViewportHeight(entry.contentRect.height);
      });
      observer.observe(viewportElement);
      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  React.useEffect(() => {
    let canceled = false;

    const applyFitWidthScale = async () => {
      if (!doc) {
        return;
      }

      if (scaleMode !== 'fitWidth' && scaleMode !== 'fitPage') {
        setFitWidthReady(true);
        return;
      }

      if (viewportWidth <= 0 || viewportHeight <= 0) {
        return;
      }

      try {
        const pdfPage = await doc.getPage(page);
        if (canceled) {
          return;
        }

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const availableWidth = Math.max(1, viewportWidth - 72);
        const availableHeight = Math.max(1, viewportHeight - 48);
        const fitWidthScale = computeFitWidthScale(baseViewport.width, availableWidth);
        const fitPageScale = clampScale(availableHeight / Math.max(1, baseViewport.height));
        const nextScale = scaleMode === 'fitPage' ? fitPageScale : fitWidthScale;
        setScale((prev) => (Math.abs(prev - nextScale) < 0.001 ? prev : nextScale));
        setFitWidthReady(true);
      } catch {
        setFitWidthReady(true);
      }
    };

    void applyFitWidthScale();

    return () => {
      canceled = true;
    };
  }, [doc, page, scaleMode, viewportHeight, viewportWidth]);

  React.useEffect(() => {
    let canceled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    let textLayerTask: TextLayer | null = null;

    const renderPage = async () => {
      if (!doc || !canvasRef.current) {
        return;
      }

      if ((scaleMode === 'fitWidth' || scaleMode === 'fitPage') && !fitWidthReady) {
        return;
      }

      setRendering(true);
      setError(null);
      try {
        const pdfPage = await doc.getPage(page);
        if (canceled || !canvasRef.current) {
          return;
        }

        const viewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) {
          setError('Canvas is not available.');
          return;
        }
        const outputScale = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
        canvas.width = Math.max(1, Math.round(viewport.width * outputScale));
        canvas.height = Math.max(1, Math.round(viewport.height * outputScale));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        setCanvasWidth(viewport.width);
        setCanvasHeight(viewport.height);
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);
        renderTask = pdfPage.render({ canvasContext: context, viewport });
        await renderTask.promise;

        if (canceled) {
          return;
        }

        const textLayerElement = textLayerRef.current;
        if (textLayerElement) {
          textLayerElement.replaceChildren();
          const textContent = await pdfPage.getTextContent();
          if (canceled) {
            return;
          }
          textLayerTask = new TextLayer({
            textContentSource: textContent,
            container: textLayerElement,
            viewport
          });
          await textLayerTask.render();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const normalized = message.toLowerCase();
        const isCanceled = normalized.includes('cancel') || normalized.includes('multiple render() operations');
        if (!canceled && !isCanceled) {
          setError('Failed to render PDF page.');
        }
      } finally {
        if (!canceled) {
          setRendering(false);
        }
      }
    };

    void renderPage();
    return () => {
      canceled = true;
      renderTask?.cancel();
      textLayerTask?.cancel();
    };
  }, [doc, fitWidthReady, page, scale, scaleMode]);

  React.useEffect(() => {
    scheduleSearchOverlayRecompute('state-change');
  }, [page, pageRootVersion, scale, scheduleSearchOverlayRecompute, searchQuery]);

  React.useEffect(() => {
    if (activeSearchIndex < 0) {
      return;
    }
    scheduleSearchOverlayRecompute('active-index-change');
  }, [activeSearchIndex, scheduleSearchOverlayRecompute]);

  React.useEffect(() => {
    const pageRoot = pageRootRef.current;
    if (!pageRoot) {
      return;
    }

    let canceled = false;
    let textLayerObserver: MutationObserver | null = null;
    let textLayerAttachRafId: number | null = null;
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            scheduleSearchOverlayRecompute('resize');
          })
        : null;

    const attachTextLayerObserver = () => {
      if (canceled) {
        return;
      }
      const textLayerCandidate = pageRoot.querySelector('.textLayer');
      const textLayer = textLayerCandidate instanceof HTMLDivElement ? textLayerCandidate : null;
      if (!textLayer) {
        textLayerAttachRafId = requestAnimationFrame(attachTextLayerObserver);
        return;
      }
      ensureSearchOverlayLayer(pageRoot);
      textLayerObserver?.disconnect();
      textLayerObserver = new MutationObserver(() => {
        scheduleSearchOverlayRecompute('mutation');
      });
      textLayerObserver.observe(textLayer, {
        childList: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
        characterData: true,
        subtree: true
      });
      resizeObserver?.observe(textLayer);
      if (textLayer.parentElement) {
        resizeObserver?.observe(textLayer.parentElement);
      }
    };

    attachTextLayerObserver();
    resizeObserver?.observe(pageRoot);

    return () => {
      canceled = true;
      if (textLayerAttachRafId !== null) {
        cancelAnimationFrame(textLayerAttachRafId);
      }
      textLayerObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [page, pageRootVersion, scheduleSearchOverlayRecompute]);

  React.useEffect(() => {
    return () => {
      searchOverlayRunIdRef.current += 1;
      clearScheduledSearchOverlayRecompute();
    };
  }, [clearScheduledSearchOverlayRecompute]);

  React.useEffect(() => {
    setPageInputValue(String(page));
  }, [page]);

  React.useEffect(() => {
    if (!canSaveRef.current || !window.api) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    const safeUserId = userId.trim();
    const safeBookId = bookId.trim();
    if (!safeUserId || !safeBookId) {
      return;
    }

    saveTimerRef.current = setTimeout(() => {
      void window.api?.setLastPage(safeUserId, safeBookId, Math.max(1, page));
      saveTimerRef.current = null;
    }, 400);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [bookId, page, restoreApplied, userId]);

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      flushLastPageSave();
    };
  }, [flushLastPageSave]);

  React.useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      flushLastPageSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flushLastPageSave]);

  React.useEffect(() => {
    let canceled = false;

    const loadOutline = async () => {
      if (!doc) {
        setOutlineItems([]);
        return;
      }

      setOutlineLoading(true);
      outlinePageCacheRef.current.clear();
      try {
        const outline = await doc.getOutline();
        if (!canceled) {
          setOutlineItems(normalizeOutlineItems(outline));
        }
      } catch {
        if (!canceled) {
          setOutlineItems([]);
        }
      } finally {
        if (!canceled) {
          setOutlineLoading(false);
        }
      }
    };

    void loadOutline();
    return () => {
      canceled = true;
    };
  }, [doc]);

  const resolveOutlineItemPage = React.useCallback(
    async (item: PdfOutlineItem, key: string): Promise<number | null> => {
      if (!doc) {
        return null;
      }

      const cached = outlinePageCacheRef.current.get(key);
      if (cached) {
        return cached;
      }

      let destArray: unknown[] | null = null;
      if (typeof item.dest === 'string') {
        destArray = (await doc.getDestination(item.dest)) as unknown[] | null;
      } else if (Array.isArray(item.dest)) {
        destArray = item.dest as unknown[];
      } else {
        return null;
      }

      if (!destArray || destArray.length === 0) {
        return null;
      }

      const pageRef = destArray[0];
      if (!pageRef) {
        return null;
      }

      try {
        const pageIndex = await doc.getPageIndex(pageRef as Parameters<PDFDocumentProxy['getPageIndex']>[0]);
        const pageNumber = pageIndex + 1;
        outlinePageCacheRef.current.set(key, pageNumber);
        return pageNumber;
      } catch {
        return null;
      }
    },
    [doc]
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const typing = isTypingTarget(event.target ?? activeElement);
      const ctrlOrMeta = event.ctrlKey || event.metaKey;

      if (event.key === 'Escape') {
        if (searchPanelOpen) {
          event.preventDefault();
          setSearchPanelOpen(false);
          focusReader();
          return;
        }
        if (bookmarksPanelOpen) {
          event.preventDefault();
          setBookmarksPanelOpen(false);
          focusReader();
          return;
        }
        if (notesPanelOpen) {
          event.preventDefault();
          setNotesPanelOpen(false);
          focusReader();
          return;
        }
        if (sidebarOpen) {
          event.preventDefault();
          setSidebarOpen(false);
          focusReader();
          return;
        }
        if (activeElement === pageInputRef.current) {
          event.preventDefault();
          pageInputRef.current?.blur();
          focusReader();
        }
        return;
      }

      if (typing) {
        return;
      }

      if (ctrlOrMeta && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        openSearchPanel();
        return;
      }

      if (ctrlOrMeta && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        pageInputRef.current?.focus();
        pageInputRef.current?.select();
        return;
      }

      if (event.key === 'F3') {
        event.preventDefault();
        if (event.shiftKey) {
          goToPrevSearchMatch();
        } else {
          goToNextSearchMatch();
        }
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        goPrev();
        focusReader();
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        goNext();
        focusReader();
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        setPage(1);
        focusReader();
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        setPage(pageCount);
        focusReader();
        return;
      }

      if (ctrlOrMeta && (event.key === '+' || event.key === '=')) {
        event.preventDefault();
        zoomIn();
        return;
      }

      if (ctrlOrMeta && event.key === '-') {
        event.preventDefault();
        zoomOut();
        return;
      }

      if (ctrlOrMeta && event.key === '0') {
        event.preventDefault();
        setFitMode();
        return;
      }

      if (event.key === 't' || event.key === 'T') {
        event.preventDefault();
        toggleContents();
        focusReader();
        return;
      }

      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        openAddNote();
        return;
      }

      if (event.key === 'b' || event.key === 'B') {
        event.preventDefault();
        void toggleBookmarkForPage(page);
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        pageInputRef.current?.focus();
        pageInputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    focusReader,
    bookmarksPanelOpen,
    goToNextSearchMatch,
    goToPrevSearchMatch,
    goNext,
    goPrev,
    notesPanelOpen,
    openAddNote,
    openSearchPanel,
    pageCount,
    page,
    searchPanelOpen,
    setFitMode,
    sidebarOpen,
    toggleContents,
    toggleBookmarkForPage,
    zoomIn,
    zoomOut
  ]);

  React.useEffect(() => {
    const viewportElement = readerViewportRef.current;
    if (!viewportElement) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      if (isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      if (event.deltaY < 0) {
        zoomIn();
      } else if (event.deltaY > 0) {
        zoomOut();
      }
    };

    viewportElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      viewportElement.removeEventListener('wheel', handleWheel);
    };
  }, [zoomIn, zoomOut]);

  return (
    <div ref={readerRootRef} tabIndex={-1} className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#f3f5f7]">
      <header className="shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3">
          <Button type="button" variant="outline" size="sm" onClick={handleBack} disabled={loading}>
            Back
          </Button>

          <div className="min-w-0 max-w-[320px] flex-1 px-2">
            <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
          </div>

          <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1">
            <Button type="button" variant="outline" size="sm" onClick={goPrev} disabled={loading || page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              ref={pageInputRef}
              value={pageInputValue}
              onChange={(event) => {
                setPageInputValue(event.target.value.replace(/\D+/g, ''));
                setPageInputError(null);
              }}
              onFocus={() => pageInputRef.current?.select()}
              onBlur={() => {
                const trimmed = pageInputValue.trim();
                if (trimmed.length === 0) {
                  setPageInputValue(String(page));
                  setPageInputError(null);
                  return;
                }
                const ok = tryJumpToPage(trimmed);
                if (!ok) {
                  setPageInputValue(String(page));
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const ok = tryJumpToPage(pageInputValue);
                  if (ok) {
                    pageInputRef.current?.blur();
                  }
                }
              }}
              className="h-8 w-14 border-slate-300 text-center text-sm"
              disabled={loading || rendering}
              aria-label="Page number"
              inputMode="numeric"
            />
            <span className="px-1 text-xs text-slate-600">/ {pageCount}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goNext}
              disabled={loading || page >= pageCount}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="ml-2 flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                zoomOut();
              }}
              disabled={loading || rendering}
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-16 text-center text-xs font-medium text-slate-700">
              {`${Math.round(scale * 100)}%`}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScaleMode('fitWidth')}
              disabled={loading || rendering}
            >
              Fit
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScaleMode('fitPage')}
              disabled={loading || rendering}
            >
              Page
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setScaleMode('manual');
                setScale(1);
              }}
              disabled={loading || rendering}
            >
              100%
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                zoomIn();
              }}
              disabled={loading || rendering}
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={openAddNote}
            disabled={loading || rendering}
          >
            Add note
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={toggleBookNotesPanel}
            disabled={loading}
          >
            Notes
          </Button>

          <Button
            type="button"
            variant={bookmarksPanelOpen ? 'default' : 'outline'}
            size="sm"
            className="ml-2"
            onClick={openBookmarksPanel}
            disabled={loading}
          >
            Bookmarks
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={() => {
              void toggleBookmarkForPage(page);
            }}
            disabled={loading}
            aria-label={isCurrentPageBookmarked ? 'Remove bookmark from current page' : 'Bookmark current page'}
            title={isCurrentPageBookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            <Star className={`h-4 w-4 ${isCurrentPageBookmarked ? 'fill-amber-400 text-amber-500' : ''}`} />
          </Button>

          <Button
            type="button"
            variant={searchPanelOpen ? 'default' : 'outline'}
            size="sm"
            className="ml-2"
            onClick={openSearchPanel}
            disabled={loading}
            aria-label="Search document"
          >
            <Search className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={toggleContents}
            aria-label={sidebarOpen ? 'Hide contents' : 'Show contents'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
        </div>
        {pageInputError ? <p className="px-4 pb-2 text-xs text-destructive">{pageInputError}</p> : null}
        {noteSuccess ? <p className="px-4 pb-2 text-xs text-emerald-700">{noteSuccess}</p> : null}
      </header>

      <main className="flex w-full flex-1 min-h-0 min-w-0">
        {sidebarOpen ? (
          <div className="h-full w-[300px] shrink-0 border-r border-slate-200 bg-white">
            <PdfSidebar
              outlineItems={outlineItems}
              outlineLoading={outlineLoading}
              onOutlineSelect={async (item, key) => {
                const resolvedPage = await resolveOutlineItemPage(item, key);
                if (!resolvedPage) {
                  return;
                }
                setPage(resolvedPage);
                setPageInputError(null);
              }}
            />
          </div>
        ) : null}

        <div className="relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col bg-[#eef1f5]">
          <div ref={readerViewportRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="w-full min-h-full flex justify-center px-8 py-6">
              <div
                ref={pageStageRef}
                className="group relative"
                style={{ width: canvasWidth > 0 ? `${canvasWidth}px` : 'auto', maxWidth: '100%' }}
              >
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                {!error ? (
                  <>
                    <button
                      type="button"
                      className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-slate-300 bg-white/95 p-2 text-slate-700 opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Previous page"
                      title="Previous page"
                      onClick={goPrev}
                      disabled={loading || rendering || page <= 1}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-slate-300 bg-white/95 p-2 text-slate-700 opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Next page"
                      title="Next page"
                      onClick={goNext}
                      disabled={loading || rendering || page >= pageCount}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    {rendering ? (
                      <div className="pointer-events-none absolute right-3 top-3 z-30 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-xs text-slate-600 shadow-sm">
                        <ListTree className="h-3.5 w-3.5" />
                        Rendering...
                      </div>
                    ) : null}

                    <div
                      className="relative overflow-hidden rounded-sm border border-slate-300 bg-white shadow-[0_18px_40px_-18px_rgba(15,23,42,0.5)]"
                      ref={setPageRootNode}
                      style={{
                        width: canvasWidth > 0 ? `${canvasWidth}px` : undefined,
                        height: canvasHeight > 0 ? `${canvasHeight}px` : undefined
                      }}
                      onContextMenu={(event) => {
                        openHighlightContextMenu(event);
                      }}
                    >
                      <canvas ref={canvasRef} className="block" />
                      <div
                        className="textLayer absolute inset-0 z-10 pdf-text-layer"
                        ref={textLayerRef}
                        onMouseUp={() => {
                          void createHighlightFromSelection();
                        }}
                      />
                      <div className="pointer-events-none absolute inset-0 z-[11]">
                        {pageHighlights.map((highlight) => {
                          const bounds = getHighlightBounds(highlight.rects);
                          if (!bounds) {
                            return null;
                          }
                          return (
                            <div
                              key={highlight.id}
                              className="absolute"
                              style={{
                                left: `${bounds.x * 100}%`,
                                top: `${bounds.y * 100}%`,
                                width: `${bounds.w * 100}%`,
                                height: `${bounds.h * 100}%`
                              }}
                            >
                              {highlight.rects.map((rect, index) => (
                                <div
                                  key={`${highlight.id}:${index}`}
                                  className="absolute bg-yellow-300/45"
                                  style={{
                                    left: `${((rect.x - bounds.x) / bounds.w) * 100}%`,
                                    top: `${((rect.y - bounds.y) / bounds.h) * 100}%`,
                                    width: `${(rect.w / bounds.w) * 100}%`,
                                    height: `${(rect.h / bounds.h) * 100}%`
                                  }}
                                />
                              ))}
                            </div>
                          );
                        })}
                        {highlightContextMenu ? (
                          <div
                            data-highlight-menu="true"
                            className="pointer-events-auto absolute z-20 min-w-[150px] rounded-md border border-slate-200 bg-white p-1 shadow-lg"
                            style={{
                              left: `${highlightContextMenu.x}px`,
                              top: `${highlightContextMenu.y}px`
                            }}
                          >
                            <button
                              type="button"
                              className="block w-full rounded px-2 py-1 text-left text-xs text-red-700 transition-colors hover:bg-red-50"
                              onClick={() => {
                                const targetHighlight = pageHighlights.find(
                                  (item) => item.id === highlightContextMenu.highlightId
                                );
                                if (!targetHighlight) {
                                  setHighlightContextMenu(null);
                                  return;
                                }
                                queueHighlightDeletion(targetHighlight);
                              }}
                            >
                              Delete highlight
                            </button>
                            <button
                              type="button"
                              className="mt-1 block w-full rounded px-2 py-1 text-left text-xs text-slate-600 transition-colors hover:bg-slate-100"
                              onClick={() => setHighlightContextMenu(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {notesPanelOpen ? (
            <aside className="absolute right-3 top-3 bottom-3 z-40 flex w-[320px] flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <p className="text-sm font-semibold">Book Notes</p>
                <Button type="button" size="sm" variant="outline" onClick={() => setNotesPanelOpen(false)}>
                  Close
                </Button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {bookNotesError ? <p className="text-xs text-destructive">{bookNotesError}</p> : null}
                {bookNotesLoading ? <p className="text-xs text-slate-600">Loading...</p> : null}
                {!bookNotesLoading && bookNotes.length === 0 ? (
                  <p className="text-xs text-slate-600">No notes for this book.</p>
                ) : null}
                {bookNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => {
                      setPage(clampPage(note.page, pageCount));
                      setPageInputError(null);
                      setNotesPanelOpen(false);
                      focusReader();
                    }}
                    className="w-full rounded-md border border-slate-200 p-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <p className="text-xs font-semibold text-slate-800">Page {note.page}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-700">{note.content}</p>
                  </button>
                ))}
              </div>
            </aside>
          ) : null}

          {bookmarksPanelOpen ? (
            <aside
              className={`absolute top-3 bottom-3 z-40 flex w-[320px] flex-col rounded-lg border border-slate-200 bg-white shadow-xl ${
                notesPanelOpen ? 'right-[336px]' : 'right-3'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-slate-700" />
                  <p className="text-sm font-semibold">Bookmarks</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setBookmarksPanelOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {bookmarksError ? <p className="text-xs text-destructive">{bookmarksError}</p> : null}
                {bookmarksLoading ? <p className="text-xs text-slate-600">Loading...</p> : null}
                {!bookmarksLoading && bookmarks.length === 0 ? (
                  <p className="text-xs text-slate-600">No bookmarks for this book.</p>
                ) : null}
                {bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className="flex items-start gap-2 rounded-md border border-slate-200 p-2 transition-colors hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPage(clampPage(bookmark.page, pageCount));
                        setPageInputError(null);
                        focusReader();
                      }}
                      className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className="text-xs font-semibold text-slate-800">Page {bookmark.page}</p>
                      <p className="mt-1 text-[11px] text-slate-600">{formatTimestamp(bookmark.createdAt)}</p>
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                      aria-label={`Remove bookmark from page ${bookmark.page}`}
                      onClick={() => {
                        void removeBookmarkByPage(bookmark.page);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          ) : null}

          {searchPanelOpen ? (
            <aside
              className={`absolute top-3 bottom-3 z-40 flex w-[360px] flex-col rounded-lg border border-slate-200 bg-white shadow-xl ${
                notesPanelOpen ? 'right-[336px]' : 'right-3'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <p className="text-sm font-semibold">Search</p>
                <Button type="button" size="sm" variant="outline" onClick={() => setSearchPanelOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2 border-b border-slate-200 p-3">
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') {
                      return;
                    }
                    event.preventDefault();
                    if (event.shiftKey) {
                      goToPrevSearchMatch();
                    } else {
                      goToNextSearchMatch();
                    }
                  }}
                  placeholder="Search in this PDF..."
                  aria-label="Search in document"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={goToPrevSearchMatch}
                    disabled={searchResults.length === 0}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={goToNextSearchMatch}
                    disabled={searchResults.length === 0}
                  >
                    Next
                  </Button>
                  <span className="text-xs text-slate-600">
                    {searchResults.length > 0 && activeSearchIndex >= 0
                      ? `${activeSearchIndex + 1} / ${searchResults.length}`
                      : `0 / ${searchResults.length}`}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{isSearching ? 'Searching...' : `${searchResults.length} results`}</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {!searchQuery.trim() ? <p className="text-xs text-slate-600">Type a query to search all pages.</p> : null}
                {searchQuery.trim() && !isSearching && searchResults.length === 0 ? (
                  <p className="text-xs text-slate-600">No matches found.</p>
                ) : null}
                <div className="space-y-2">
                  {searchResults.map((result, index) => {
                    const safeStart = Math.max(0, Math.min(result.start, result.snippet.length));
                    const safeEnd = Math.max(safeStart, Math.min(result.end, result.snippet.length));
                    const before = result.snippet.slice(0, safeStart);
                    const match = result.snippet.slice(safeStart, safeEnd);
                    const after = result.snippet.slice(safeEnd);
                    return (
                      <button
                        key={`${result.page}:${result.start}:${result.end}:${index}`}
                        type="button"
                        onClick={() => {
                          navigateToSearchIndex(index);
                        }}
                        className={`w-full rounded-md border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          index === activeSearchIndex
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                          Page {result.page}
                        </span>
                        <p className="mt-1 text-xs leading-relaxed text-slate-700">
                          {before}
                          <mark className="rounded bg-yellow-200 px-0.5">{match}</mark>
                          {after}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          ) : null}

          {pendingHighlightDeletions.length > 0 ? (
            <div className="pointer-events-none absolute bottom-3 right-3 z-50 flex flex-col gap-2">
              {pendingHighlightDeletions.map((pending) => (
                <div
                  key={pending.id}
                  className="pointer-events-auto flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-lg"
                >
                  <p className="text-xs text-slate-700">Highlight deleted</p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                    onClick={() => {
                      void undoHighlightDeletion(pending.id);
                    }}
                  >
                    Undo
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </main>

      <NoteEditorDialog
        open={noteOpen}
        title="Add note"
        subtitle={`${title} - page ${page}`}
        value={noteContent}
        onValueChange={(value) => {
          setNoteContent(value);
          setNoteError(null);
        }}
        error={noteError}
        saving={noteSaving}
        onCancel={() => {
          setNoteOpen(false);
          setNoteError(null);
        }}
        onSave={() => void saveNote()}
      />
    </div>
  );
}
