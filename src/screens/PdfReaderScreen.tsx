import * as React from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Highlighter,
  ListTree,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Trash2
} from 'lucide-react';
import { ReaderSettingsPanel } from '@/components/ReaderSettingsPanel';
import { ReaderShell } from '@/components/reader/ReaderShell';
import { HighlightsPanel, type ReaderHighlightItem } from '@/components/reader/HighlightsPanel';
import { SearchPanel, type ReaderSearchResultItem } from '@/components/reader/SearchPanel';
import { ReaderSidePanel } from '@/components/reader/ReaderSidePanel';
import { type PdfOutlineItem } from '@/components/outline-tree';
import { ExportDialog, type ExportFormat } from '@/components/ExportDialog';
import { PdfSidebar } from '@/components/pdf-sidebar';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { getPdfViewportBackground, getReaderButtonStyles, getReaderThemePalette } from '@/lib/reader-theme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlobalWorkerOptions, TextLayer, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker?url';
import type { Book, Bookmark as BookmarkItem, Highlight, HighlightRect, Note, PdfZoomPreset } from '../../shared/ipc';
import { READER_SETTINGS_DEFAULTS } from '../../shared/ipc';
import { toJSON, toMarkdown } from '@/lib/book-export';
import { useReadingSessionStats } from '@/lib/reading-stats';
import { usePdfSearch } from '@/lib/usePdfSearch';

GlobalWorkerOptions.workerSrc = workerSrc;

type Props = {
  title: string;
  base64: string;
  bookId: string;
  initialPage?: number | null;
  onInitialPageApplied?: () => void;
  loading: boolean;
  onBack: () => void;
};

type ScaleMode = 'fitWidth' | 'fitPage' | 'manual';
type HighlightContextMenuState = { highlightId: string; x: number; y: number } | null;
type HighlightNoteEditorState = {
  highlightId: string;
  x: number;
  y: number;
  draftNote: string;
  saving: boolean;
  error: string | null;
} | null;
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

function normalizeHighlightNote(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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
    list: (payload: { bookId: string }) => Promise<unknown>;
    toggle: (payload: { bookId: string; page: number }) => Promise<unknown>;
    remove: (payload: { bookId: string; page: number }) => Promise<unknown>;
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

function normalizeHighlightSelectionText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
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
  activeGroup: SearchMatchRectGroup,
  reduceMotion: boolean
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
    behavior: reduceMotion ? 'auto' : 'smooth'
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
  bookId,
  initialPage = null,
  onInitialPageApplied,
  loading,
  onBack
}: Props) {
  const { settings, loading: settingsLoading, error: settingsError, updateSettings } = useReaderSettings();
  const safePdfBackground = settings.pdfBackground ?? READER_SETTINGS_DEFAULTS.pdfBackground;
  const safePdfZoomPreset = settings.pdfZoomPreset ?? READER_SETTINGS_DEFAULTS.pdfZoomPreset;
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
  const [scaleMode, setScaleMode] = React.useState<ScaleMode>(presetToScaleMode(safePdfZoomPreset));
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
  const [highlightsPanelOpen, setHighlightsPanelOpen] = React.useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = React.useState(false);
  const [bookNotes, setBookNotes] = React.useState<Note[]>([]);
  const [bookNotesLoading, setBookNotesLoading] = React.useState(false);
  const [bookNotesError, setBookNotesError] = React.useState<string | null>(null);
  const [bookmarks, setBookmarks] = React.useState<BookmarkItem[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = React.useState(false);
  const [bookmarksError, setBookmarksError] = React.useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>('markdown');
  const [exportLoading, setExportLoading] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [exportMessage, setExportMessage] = React.useState<string | null>(null);
  const [exportData, setExportData] = React.useState<{ book: Book; notes: Note[]; highlights: Highlight[] } | null>(
    null
  );
  const [pageHighlights, setPageHighlights] = React.useState<Highlight[]>([]);
  const [bookHighlights, setBookHighlights] = React.useState<Highlight[]>([]);
  const [highlightContextMenu, setHighlightContextMenu] = React.useState<HighlightContextMenuState>(null);
  const [highlightNoteEditor, setHighlightNoteEditor] = React.useState<HighlightNoteEditorState>(null);
  const [pendingHighlightDeletions, setPendingHighlightDeletions] = React.useState<PendingHighlightDeletion[]>([]);
  const outlinePageCacheRef = React.useRef<Map<string, number>>(new Map());
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeletionTimeoutsRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingHighlightDeletionsRef = React.useRef<PendingHighlightDeletion[]>([]);
  const latestPageRef = React.useRef(1);
  const canSaveRef = React.useRef(false);
  const lastSearchQueryRef = React.useRef('');
  const [activeSearchIndex, setActiveSearchIndex] = React.useState(-1);
  const readerPalette = React.useMemo(() => getReaderThemePalette(settings), [settings]);
  const pdfViewportBackground = React.useMemo(
    () => getPdfViewportBackground(settings.highContrastMode ? settings : safePdfBackground),
    [safePdfBackground, settings]
  );
  const { registerActivity, flush: flushReadingStats } = useReadingSessionStats({
    bookId,
    format: 'pdf',
    rootRef: readerRootRef
  });
  const { query: searchQuery, results: searchResults, isSearching, setQuery: setSearchQuery, clearQuery } = usePdfSearch(doc, bookId);
  const bookmarkedPages = React.useMemo(() => new Set(bookmarks.map((bookmark) => bookmark.page)), [bookmarks]);
  const isCurrentPageBookmarked = bookmarkedPages.has(page);

  React.useEffect(() => {
    const nextMode = presetToScaleMode(safePdfZoomPreset);
    setScaleMode((prev) => (prev === nextMode ? prev : nextMode));
    if (safePdfZoomPreset === 'actualSize') {
      setScale((prev) => (Math.abs(prev - 1) < 0.001 ? prev : 1));
    }
  }, [safePdfZoomPreset]);

  const exportContent = React.useMemo(() => {
    if (!exportData) {
      return '';
    }
    if (exportFormat === 'json') {
      return toJSON(exportData.book, exportData.notes, exportData.highlights);
    }
    return toMarkdown(exportData.book.title, exportData.notes, exportData.highlights);
  }, [exportData, exportFormat]);
  const exportPreview = React.useMemo(() => toPreview(exportContent, 40), [exportContent]);
  const unifiedHighlightItems = React.useMemo<ReaderHighlightItem[]>(
    () =>
      bookHighlights.map((highlight) => ({
        id: highlight.id,
        text: highlight.text,
        note: highlight.note,
        page: highlight.page,
        cfiRange: highlight.cfiRange,
        createdAt: highlight.createdAt
      })),
    [bookHighlights]
  );
  const searchPanelResults = React.useMemo<ReaderSearchResultItem[]>(
    () =>
      searchResults.map((result, index) => ({
        id: `${result.page}:${result.start}:${result.end}:${index}`,
        excerpt: result.snippet,
        start: result.start,
        end: result.end,
        locationLabel: `Page ${result.page}`
      })),
    [searchResults]
  );

  const goPrev = React.useCallback(() => {
    registerActivity();
    setPage((prev) => Math.max(1, prev - 1));
  }, [registerActivity]);

  const goNext = React.useCallback(() => {
    registerActivity();
    setPage((prev) => Math.min(pageCount, prev + 1));
  }, [pageCount, registerActivity]);

  const zoomIn = React.useCallback(() => {
    setScaleMode('manual');
    setScale((prev) => clampScale(Number((prev + 0.1).toFixed(1))));
  }, []);

  const zoomOut = React.useCallback(() => {
    setScaleMode('manual');
    setScale((prev) => clampScale(Number((prev - 0.1).toFixed(1))));
  }, []);

  const applyZoomPreset = React.useCallback(
    (preset: PdfZoomPreset) => {
      updateSettings({ pdfZoomPreset: preset });
      const nextMode = presetToScaleMode(preset);
      setScaleMode(nextMode);
      if (preset === 'actualSize') {
        setScale(1);
      }
    },
    [updateSettings]
  );

  const toggleContents = React.useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const toggleBookNotesPanel = React.useCallback(() => {
    setSettingsPanelOpen(false);
    setHighlightsPanelOpen(false);
    setNotesPanelOpen((prev) => !prev);
  }, []);

  const openSearchPanel = React.useCallback(() => {
    registerActivity();
    setBookmarksPanelOpen(false);
    setNotesPanelOpen(false);
    setHighlightsPanelOpen(false);
    setSettingsPanelOpen(false);
    setSearchPanelOpen(true);
  }, [registerActivity]);

  const openBookmarksPanel = React.useCallback(() => {
    setSearchPanelOpen(false);
    setNotesPanelOpen(false);
    setHighlightsPanelOpen(false);
    setSettingsPanelOpen(false);
    setBookmarksPanelOpen(true);
  }, []);

  const openHighlightsPanel = React.useCallback(() => {
    registerActivity();
    setSearchPanelOpen(false);
    setNotesPanelOpen(false);
    setBookmarksPanelOpen(false);
    setSettingsPanelOpen(false);
    setHighlightContextMenu(null);
    setHighlightNoteEditor(null);
    setHighlightsPanelOpen(true);
  }, [registerActivity]);

  const openSettingsPanel = React.useCallback(() => {
    setNotesPanelOpen(false);
    setBookmarksPanelOpen(false);
    setSearchPanelOpen(false);
    setHighlightsPanelOpen(false);
    setSettingsPanelOpen((prev) => !prev);
  }, []);

  const openExportDialog = React.useCallback(async () => {
    if (!hasExportApi(window.api)) {
      setExportError('Export API is unavailable. Restart the app to reload Electron preload.');
      setExportDialogOpen(true);
      return;
    }
    setExportDialogOpen(true);
    setExportError(null);
    setExportMessage(null);
    setExportLoading(true);
    try {
      const result = await window.api.export.getBookData({ bookId });
      if (!result.ok) {
        setExportError(result.error);
        setExportData(null);
        return;
      }
      setExportData(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setExportError(message);
      setExportData(null);
    } finally {
      setExportLoading(false);
    }
  }, [bookId]);

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
          scrollToActiveMatch(viewport, overlayLayer, activeGroup, settings.reduceMotion);
        }
      }
    },
    [activeSearchIndex, page, searchQuery, searchResults, settings.reduceMotion]
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
    const safeBookId = bookId.trim();
    if (!safeBookId) {
      return;
    }
    void window.api.setLastPage({ bookId: safeBookId, lastPage: Math.max(1, latestPageRef.current) });
  }, [bookId]);

  const handleBack = React.useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    flushLastPageSave();
    flushReadingStats();
    onBack();
  }, [flushLastPageSave, flushReadingStats, onBack]);

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
  }, [bookId, noteContent, page]);

  const loadBookNotes = React.useCallback(async () => {
    if (!window.api) {
      setBookNotesError('Renderer API is unavailable. Open this app via Electron.');
      return;
    }

    setBookNotesLoading(true);
    setBookNotesError(null);
    try {
      const result = await window.api.notes.list({ bookId, q: null });
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
  }, [bookId]);

  const loadBookmarks = React.useCallback(async () => {
    if (!hasBookmarksApi(window.api)) {
      setBookmarks([]);
      setBookmarksError('Bookmarks API is unavailable. Restart the app to reload Electron preload.');
      return;
    }

    setBookmarksLoading(true);
    setBookmarksError(null);
    try {
      const result = await window.api.bookmarks.list({ bookId });
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
  }, [bookId]);

  const toggleBookmarkForPage = React.useCallback(
    async (targetPage: number) => {
      if (!hasBookmarksApi(window.api)) {
        setBookmarksError('Bookmarks API is unavailable. Restart the app to reload Electron preload.');
        return;
      }
      try {
        const result = await window.api.bookmarks.toggle({ bookId, page: targetPage });
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
    [bookId, loadBookmarks]
  );

  const removeBookmarkByPage = React.useCallback(
    async (targetPage: number) => {
      if (!hasBookmarksApi(window.api)) {
        setBookmarksError('Bookmarks API is unavailable. Restart the app to reload Electron preload.');
        return;
      }
      try {
        const result = await window.api.bookmarks.remove({ bookId, page: targetPage });
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
    [bookId, loadBookmarks]
  );

  const copyExportContent = React.useCallback(async () => {
    if (!exportContent) {
      setExportError('Nothing to export.');
      return;
    }
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      setExportError('Clipboard is unavailable in this environment.');
      return;
    }
    setExportError(null);
    setExportMessage(null);
    try {
      await navigator.clipboard.writeText(exportContent);
      setExportMessage('Copied to clipboard.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setExportError(message);
    }
  }, [exportContent]);

  const saveExportContent = React.useCallback(async () => {
    if (!exportContent) {
      setExportError('Nothing to export.');
      return;
    }
    if (!hasExportApi(window.api)) {
      setExportError('Export API is unavailable. Restart the app to reload Electron preload.');
      return;
    }
    const ext: 'md' | 'json' = exportFormat === 'json' ? 'json' : 'md';
    const baseTitle = sanitizeExportName(exportData?.book.title ?? title);
    setExportLoading(true);
    setExportError(null);
    setExportMessage(null);
    try {
      const result = await window.api.export.saveFile({
        suggestedName: `${baseTitle}-export.${ext}`,
        ext,
        content: exportContent
      });
      if (!result.ok) {
        if ('cancelled' in result && result.cancelled) {
          return;
        }
        setExportError('error' in result ? result.error : 'Failed to save export file.');
        return;
      }
      setExportMessage(`Saved: ${result.path}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setExportError(message);
    } finally {
      setExportLoading(false);
    }
  }, [exportContent, exportData?.book.title, exportFormat, title]);

  const loadPageHighlights = React.useCallback(async () => {
    if (!window.api) {
      setPageHighlights([]);
      return;
    }
    try {
      const result = await window.api.highlights.list({ bookId, page });
      if (!result.ok) {
        setPageHighlights([]);
        return;
      }
      setPageHighlights(result.highlights);
    } catch {
      setPageHighlights([]);
    }
  }, [bookId, page]);

  const loadBookHighlights = React.useCallback(async () => {
    if (!window.api) {
      setBookHighlights([]);
      return;
    }
    try {
      const result = await window.api.highlights.list({ bookId });
      if (!result.ok) {
        setBookHighlights([]);
        return;
      }
      setBookHighlights(result.highlights);
    } catch {
      setBookHighlights([]);
    }
  }, [bookId]);

  const clampPopoverPosition = React.useCallback((x: number, y: number, width = 280, height = 180) => {
    const stage = pageStageRef.current;
    if (!stage) {
      return { x, y };
    }
    const stageRect = stage.getBoundingClientRect();
    const maxX = Math.max(12, stageRect.width - width - 12);
    const maxY = Math.max(12, stageRect.height - height - 12);
    const nextX = Math.max(12, Math.min(maxX, x));
    const fitsBelow = y + height <= stageRect.height - 12;
    const nextY = fitsBelow ? Math.max(12, y) : Math.max(12, Math.min(maxY, y - height - 16));
    return {
      x: nextX,
      y: nextY
    };
  }, []);

  const findHighlightAtPoint = React.useCallback(
    (clientX: number, clientY: number) => {
      const stage = pageStageRef.current;
      if (!stage) {
        return null;
      }
      const stageRect = stage.getBoundingClientRect();
      if (stageRect.width <= 0 || stageRect.height <= 0) {
        return null;
      }
      const xNormalized = (clientX - stageRect.left) / stageRect.width;
      const yNormalized = (clientY - stageRect.top) / stageRect.height;
      return (
        pageHighlights.find((highlight) => highlight.rects.some((rect) => pointInRect(xNormalized, yNormalized, rect))) ?? null
      );
    },
    [pageHighlights]
  );

  const openHighlightNoteEditor = React.useCallback(
    (highlight: Highlight, x: number, y: number) => {
      const position = clampPopoverPosition(x, y, 280, 260);
      setHighlightContextMenu(null);
      setHighlightNoteEditor({
        highlightId: highlight.id,
        x: position.x,
        y: position.y,
        draftNote: highlight.note ?? '',
        saving: false,
        error: null
      });
    },
    [clampPopoverPosition]
  );

  const openHighlightNoteEditorFromPanel = React.useCallback(
    (item: ReaderHighlightItem) => {
      const targetHighlight = bookHighlights.find((highlight) => highlight.id === item.id) ?? null;
      const stage = pageStageRef.current;
      if (!targetHighlight || !stage) {
        return;
      }

      const stageRect = stage.getBoundingClientRect();
      const position = clampPopoverPosition(stageRect.width - 304, 20, 280, 260);
      if (typeof targetHighlight.page === 'number' && targetHighlight.page !== page) {
        setPage(clampPage(targetHighlight.page, pageCount));
        setPageInputError(null);
      }
      setHighlightsPanelOpen(false);
      openHighlightNoteEditor(targetHighlight, position.x, position.y);
      focusReader();
    },
    [bookHighlights, clampPopoverPosition, focusReader, openHighlightNoteEditor, page, pageCount]
  );

  const createHighlightFromSelection = React.useCallback(async () => {
    if (!window.api) {
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }
    const selectedText = normalizeHighlightSelectionText(selection.toString());

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

    const selectionBounds = range.getBoundingClientRect();
    try {
      const result = await window.api.highlights.createMerged({ bookId, page, rects, text: selectedText });
      if (result.ok) {
        setPageHighlights((prev) => [result.highlight, ...prev.filter((item) => item.id !== result.highlight.id)]);
        await loadBookHighlights();
        if (selectionBounds.width > 0 || selectionBounds.height > 0) {
            const position = clampPopoverPosition(
              selectionBounds.right - pageRect.left,
              selectionBounds.bottom - pageRect.top + 8,
              280,
              140
            );
            setHighlightNoteEditor(null);
            setHighlightContextMenu({
              highlightId: result.highlight.id,
              x: position.x,
              y: position.y
          });
        }
        await loadPageHighlights();
      }
    } finally {
      selection.removeAllRanges();
    }
  }, [bookId, clampPopoverPosition, loadBookHighlights, loadPageHighlights, page]);

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
        const result = await window.api.highlights.delete({ highlightId: safeId });
        if (!result.ok && highlight.bookId === bookId && highlight.page === page) {
          await loadPageHighlights();
        }
        if (!result.ok) {
          await loadBookHighlights();
        }
      } catch {
        await loadBookHighlights();
        if (highlight.bookId === bookId && highlight.page === page) {
          await loadPageHighlights();
        }
      }
    },
    [bookId, loadBookHighlights, loadPageHighlights, page]
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
      setBookHighlights((prev) => prev.filter((item) => item.id !== safeId));
      setPendingHighlightDeletions((prev) => {
        const filtered = prev.filter((item) => item.id !== safeId);
        return [...filtered, { id: safeId, highlight }];
      });
      setHighlightContextMenu(null);
      setHighlightNoteEditor((prev) => (prev?.highlightId === safeId ? null : prev));

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
          bookId: pending.highlight.bookId,
          page: pending.highlight.page,
          rects: pending.highlight.rects,
          text: pending.highlight.text,
          note: pending.highlight.note
        });
        if (result.ok) {
          await loadBookHighlights();
          if (pending.highlight.page === page && pending.highlight.bookId === bookId) {
            await loadPageHighlights();
          }
        }
      } catch {
      }
    },
    [bookId, loadBookHighlights, loadPageHighlights, page, pendingHighlightDeletions]
  );

  const openHighlightContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        return;
      }

      const stage = pageStageRef.current;
      const hit = findHighlightAtPoint(event.clientX, event.clientY);
      if (!hit) {
        setHighlightContextMenu(null);
        return;
      }
      if (!stage) {
        return;
      }
      const stageRect = stage.getBoundingClientRect();

      event.preventDefault();
      const targetHighlight = pageHighlights.find((item) => item.id === hit.id) ?? null;
      const menuHeight = targetHighlight?.note ? 210 : 140;
      const { x, y } = clampPopoverPosition(event.clientX - stageRect.left, event.clientY - stageRect.top, 280, menuHeight);
      setHighlightNoteEditor(null);
      setHighlightContextMenu({ highlightId: hit.id, x, y });
    },
    [clampPopoverPosition, findHighlightAtPoint]
  );

  const openHighlightNoteFromClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest('[data-highlight-menu="true"]') || target.closest('[data-highlight-note-editor="true"]'))
      ) {
        return;
      }
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        return;
      }

      const stage = pageStageRef.current;
      const hit = findHighlightAtPoint(event.clientX, event.clientY);
      if (!hit || !stage) {
        return;
      }

      const stageRect = stage.getBoundingClientRect();
      openHighlightNoteEditor(hit, event.clientX - stageRect.left, event.clientY - stageRect.top + 8);
    },
    [findHighlightAtPoint, openHighlightNoteEditor]
  );

  const saveHighlightNote = React.useCallback(async () => {
    if (!window.api || !highlightNoteEditor) {
      return;
    }
    if (!pageHighlights.some((item) => item.id === highlightNoteEditor.highlightId)) {
      setHighlightNoteEditor(null);
      return;
    }

    const normalizedNote = normalizeHighlightNote(highlightNoteEditor.draftNote);
    setHighlightNoteEditor((prev) => (prev ? { ...prev, saving: true, error: null } : prev));
    try {
      const result = await window.api.highlights.updateNote({
        highlightId: highlightNoteEditor.highlightId,
        note: normalizedNote
      });
      if (!result.ok) {
        setHighlightNoteEditor((prev) => (prev ? { ...prev, saving: false, error: result.error } : prev));
        return;
      }
      setPageHighlights((prev) => prev.map((item) => (item.id === result.highlight.id ? result.highlight : item)));
      setBookHighlights((prev) => prev.map((item) => (item.id === result.highlight.id ? result.highlight : item)));
      setHighlightContextMenu(null);
      setHighlightNoteEditor(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setHighlightNoteEditor((prev) => (prev ? { ...prev, saving: false, error: message } : prev));
    }
  }, [highlightNoteEditor, pageHighlights]);

  React.useEffect(() => {
    setBookNotes([]);
    setBookNotesError(null);
    setBookmarks([]);
    setBookmarksError(null);
    setBookHighlights([]);
    setPageHighlights([]);
    setBookmarksPanelOpen(false);
    setHighlightsPanelOpen(false);
    setExportDialogOpen(false);
    setExportError(null);
    setExportMessage(null);
    setExportData(null);
    setNotesPanelOpen(false);
    setHighlightContextMenu(null);
    setHighlightNoteEditor(null);
    setSettingsPanelOpen(false);
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
    void loadBookHighlights();
  }, [loadBookHighlights]);

  React.useEffect(() => {
    setHighlightContextMenu(null);
    setHighlightNoteEditor(null);
  }, [page, scale]);

  React.useEffect(() => {
    const closeMenuOnPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest('[data-highlight-menu="true"]') || target.closest('[data-highlight-note-editor="true"]'))
      ) {
        return;
      }
      setHighlightContextMenu(null);
      setHighlightNoteEditor(null);
    };
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHighlightContextMenu(null);
        setHighlightNoteEditor(null);
      }
    };
    const closeMenuOnScroll = () => {
      setHighlightContextMenu(null);
      setHighlightNoteEditor(null);
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

      const safeBookId = bookId.trim();
      if (!safeBookId) {
        setProgressLoaded(true);
        return;
      }

      try {
        const savedLastPage = await window.api.getLastPage({ bookId: safeBookId });
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
  }, [bookId]);

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
      setScaleMode(presetToScaleMode(settings.pdfZoomPreset));
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

    const safeBookId = bookId.trim();
    if (!safeBookId) {
      return;
    }

    saveTimerRef.current = setTimeout(() => {
      void window.api?.setLastPage({ bookId: safeBookId, lastPage: Math.max(1, page) });
      saveTimerRef.current = null;
    }, 400);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [bookId, page, restoreApplied]);

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
        if (settingsPanelOpen) {
          event.preventDefault();
          setSettingsPanelOpen(false);
          focusReader();
          return;
        }
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
        if (highlightsPanelOpen) {
          event.preventDefault();
          setHighlightsPanelOpen(false);
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
        applyZoomPreset('fitWidth');
        return;
      }

      if (event.key === 't' || event.key === 'T') {
        event.preventDefault();
        toggleContents();
        focusReader();
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
    highlightsPanelOpen,
    goToNextSearchMatch,
    goToPrevSearchMatch,
    goNext,
    goPrev,
    openSearchPanel,
    settingsPanelOpen,
    pageCount,
    page,
    searchPanelOpen,
    applyZoomPreset,
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

  const headerStatus =
    pageInputError || noteSuccess || settingsError ? (
      <>
        {pageInputError ? <p className="text-xs text-destructive">{pageInputError}</p> : null}
        {noteSuccess ? <p className="text-xs text-emerald-700">{noteSuccess}</p> : null}
        {settingsError ? (
          <p className="text-xs" style={{ color: '#dc2626' }}>
            {settingsError}
          </p>
        ) : null}
      </>
    ) : null;

  const leftPanel = sidebarOpen ? (
    <PdfSidebar
      outlineItems={outlineItems}
      outlineLoading={outlineLoading}
      palette={readerPalette}
      onOutlineSelect={async (item, key) => {
        const resolvedPage = await resolveOutlineItemPage(item, key);
        if (!resolvedPage) {
          return;
        }
        setPage(resolvedPage);
        setPageInputError(null);
      }}
    />
  ) : undefined;

  const footer = (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={goPrev}
        disabled={loading || page <= 1}
        style={getReaderButtonStyles(settings)}
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Prev
      </Button>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
        <div
          className="flex items-center gap-1 rounded-lg border px-1 py-1"
          style={{ borderColor: readerPalette.chromeBorder, backgroundColor: readerPalette.accentBg }}
        >
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
            className="h-8 w-14 text-center text-sm"
            style={{
              backgroundColor: readerPalette.inputBg,
              borderColor: readerPalette.buttonBorder,
              color: readerPalette.inputText
            }}
            disabled={loading || rendering}
            aria-label="Page number"
            inputMode="numeric"
          />
          <span className="px-1 text-xs" style={{ color: readerPalette.mutedText }}>
            / {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void toggleBookmarkForPage(page);
            }}
            disabled={loading}
            aria-label={isCurrentPageBookmarked ? 'Remove bookmark from current page' : 'Bookmark current page'}
            title={isCurrentPageBookmarked ? 'Remove bookmark' : 'Add bookmark'}
            style={getReaderButtonStyles(settings, isCurrentPageBookmarked)}
          >
            <Star className={`h-4 w-4 ${isCurrentPageBookmarked ? 'fill-amber-400 text-amber-500' : ''}`} />
          </Button>
        </div>

        <div
          className="flex items-center gap-1 rounded-lg border px-1 py-1"
          style={{ borderColor: readerPalette.chromeBorder, backgroundColor: readerPalette.accentBg }}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              zoomOut();
            }}
            disabled={loading || rendering}
            aria-label="Zoom out"
            style={getReaderButtonStyles(settings)}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-16 text-center text-xs font-medium" style={{ color: readerPalette.chromeText }}>
            {`${Math.round(scale * 100)}%`}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyZoomPreset('fitWidth')}
            disabled={loading || rendering}
            style={getReaderButtonStyles(settings, settings.pdfZoomPreset === 'fitWidth' && scaleMode !== 'manual')}
          >
            Fit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyZoomPreset('fitPage')}
            disabled={loading || rendering}
            style={getReaderButtonStyles(settings, settings.pdfZoomPreset === 'fitPage' && scaleMode !== 'manual')}
          >
            Page
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyZoomPreset('actualSize')}
            disabled={loading || rendering}
            style={getReaderButtonStyles(settings, settings.pdfZoomPreset === 'actualSize' && Math.round(scale * 100) === 100)}
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
            style={getReaderButtonStyles(settings)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="inline-flex items-center gap-2 text-xs" style={{ color: readerPalette.mutedText }}>
          <ListTree className="h-3.5 w-3.5" />
          {rendering ? 'Rendering...' : `Page ${page} of ${pageCount}`}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={goNext}
        disabled={loading || page >= pageCount}
        style={getReaderButtonStyles(settings)}
      >
        Next
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );

  const bookmarksPanel = (
    <ReaderSidePanel
      open={bookmarksPanelOpen}
      title="Bookmarks"
      settings={settings}
      onClose={() => setBookmarksPanelOpen(false)}
      icon={<Bookmark className="h-4 w-4" />}
      rightOffset={12}
    >
      <div className="space-y-2">
        {bookmarksError ? <p className="text-xs text-destructive">{bookmarksError}</p> : null}
        {bookmarksLoading ? <p className="text-xs" style={{ color: readerPalette.mutedText }}>Loading...</p> : null}
        {!bookmarksLoading && bookmarks.length === 0 ? (
          <p className="text-xs" style={{ color: readerPalette.mutedText }}>No bookmarks for this book.</p>
        ) : null}
        {bookmarks.map((bookmark) => (
          <div
            key={bookmark.id}
            className="flex items-start gap-2 rounded-md border p-2 transition-colors"
            style={{ borderColor: readerPalette.chromeBorder }}
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
              <p className="text-xs font-semibold" style={{ color: readerPalette.chromeText }}>Page {bookmark.page}</p>
              <p className="mt-1 text-[11px]" style={{ color: readerPalette.mutedText }}>
                {formatTimestamp(bookmark.createdAt)}
              </p>
            </button>
            <button
              type="button"
              className="rounded p-1 transition-colors"
              style={{ color: readerPalette.mutedText }}
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
    </ReaderSidePanel>
  );

  const searchPanel = (
    <SearchPanel
      open={searchPanelOpen}
      settings={settings}
      query={searchQuery}
      results={searchPanelResults}
      isSearching={isSearching}
      activeIndex={activeSearchIndex}
      onClose={() => setSearchPanelOpen(false)}
      onQueryChange={setSearchQuery}
      onPrev={goToPrevSearchMatch}
      onNext={goToNextSearchMatch}
      onSelectResult={navigateToSearchIndex}
      onRegisterActivity={registerActivity}
      inputRef={searchInputRef}
      placeholder="Search in this PDF..."
      rightOffset={12}
      emptyQueryMessage="Type a query to search all pages."
      noResultsMessage="No matches found."
    />
  );

  const highlightsPanel = (
    <HighlightsPanel
      items={unifiedHighlightItems}
      isOpen={highlightsPanelOpen}
      onClose={() => setHighlightsPanelOpen(false)}
      onJumpToItem={(item) => {
        if (typeof item.page !== 'number') {
          return;
        }
        setPage(clampPage(item.page, pageCount));
        setPageInputError(null);
        setHighlightsPanelOpen(false);
        focusReader();
      }}
      onDeleteItem={(item) => {
        const targetHighlight = bookHighlights.find((highlight) => highlight.id === item.id) ?? null;
        if (!targetHighlight) {
          return;
        }
        queueHighlightDeletion(targetHighlight);
      }}
      onEditNote={openHighlightNoteEditorFromPanel}
      settings={settings}
      rightOffset={12}
    />
  );

  const rightPanel = (
    <>
      <ReaderSettingsPanel
        open={settingsPanelOpen}
        format="pdf"
        settings={settings}
        onClose={() => setSettingsPanelOpen(false)}
        onChange={updateSettings}
        palette={readerPalette}
      />
      {bookmarksPanel}
      {searchPanel}
      {highlightsPanel}
    </>
  );

  return (
    <ReaderShell
      title={title}
      settings={settings}
      rootRef={readerRootRef}
      rootTabIndex={-1}
      leftPanel={leftPanel}
      headerLeft={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBack}
            disabled={loading}
            style={getReaderButtonStyles(settings)}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleContents}
            aria-label={sidebarOpen ? 'Hide contents' : 'Show contents'}
            style={getReaderButtonStyles(settings, sidebarOpen)}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
        </>
      }
      headerRight={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openSearchPanel}
            disabled={loading}
            style={getReaderButtonStyles(settings, searchPanelOpen)}
          >
            <Search className="h-4 w-4" />
            Search
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openBookmarksPanel}
            disabled={loading}
            style={getReaderButtonStyles(settings, bookmarksPanelOpen)}
          >
            <Bookmark className="h-4 w-4" />
            Bookmarks
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openHighlightsPanel}
            disabled={loading}
            style={getReaderButtonStyles(settings, highlightsPanelOpen)}
          >
            <Highlighter className="h-4 w-4" />
            Highlights
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void openExportDialog();
            }}
            disabled={loading}
            style={getReaderButtonStyles(settings)}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openSettingsPanel}
            disabled={loading || settingsLoading}
            style={getReaderButtonStyles(settings, settingsPanelOpen)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Settings
          </Button>
        </>
      }
      headerStatus={headerStatus}
      rightPanel={rightPanel}
      footer={footer}
      viewportClassName="flex-col"
    >
      <div
        className="reader-elevated-surface relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col"
        style={{ backgroundColor: pdfViewportBackground }}
      >
          <div ref={readerViewportRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="reader-elevated-surface w-full min-h-full flex justify-center px-8 py-6">
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
                      className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border p-2 opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        backgroundColor: readerPalette.buttonBg,
                        borderColor: readerPalette.buttonBorder,
                        color: readerPalette.buttonText
                      }}
                      aria-label="Previous page"
                      title="Previous page"
                      onClick={goPrev}
                      disabled={loading || rendering || page <= 1}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border p-2 opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        backgroundColor: readerPalette.buttonBg,
                        borderColor: readerPalette.buttonBorder,
                        color: readerPalette.buttonText
                      }}
                      aria-label="Next page"
                      title="Next page"
                      onClick={goNext}
                      disabled={loading || rendering || page >= pageCount}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    {rendering ? (
                      <div
                        className="pointer-events-none absolute right-3 top-3 z-30 inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs shadow-sm"
                        style={{
                          backgroundColor: readerPalette.panelBg,
                          borderColor: readerPalette.chromeBorder,
                          color: readerPalette.mutedText
                        }}
                      >
                        <ListTree className="h-3.5 w-3.5" />
                        Rendering...
                      </div>
                    ) : null}

                    <div
                      className="reader-elevated-surface relative overflow-hidden rounded-sm border bg-white"
                      ref={setPageRootNode}
                      style={{
                        width: canvasWidth > 0 ? `${canvasWidth}px` : undefined,
                        height: canvasHeight > 0 ? `${canvasHeight}px` : undefined,
                        borderColor: readerPalette.buttonBorder,
                        boxShadow: readerPalette.shadow
                      }}
                      onContextMenu={(event) => {
                        openHighlightContextMenu(event);
                      }}
                      onClick={(event) => {
                        openHighlightNoteFromClick(event);
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
                              className={`absolute ${highlight.note ? 'ring-1 ring-amber-700/75 ring-inset' : ''}`}
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
                                  className={`absolute ${highlight.note ? 'bg-yellow-300/45' : 'bg-yellow-300/40'}`}
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
                            className="pointer-events-auto absolute z-20 w-[280px] rounded-md border p-3 shadow-lg"
                            style={{
                              left: `${highlightContextMenu.x}px`,
                              top: `${highlightContextMenu.y}px`,
                              backgroundColor: readerPalette.panelBg,
                              borderColor: readerPalette.chromeBorder,
                              color: readerPalette.chromeText
                            }}
                          >
                            {(() => {
                              const activeHighlight = pageHighlights.find((item) => item.id === highlightContextMenu.highlightId) ?? null;
                              if (!activeHighlight) {
                                return (
                                  <p className="text-xs" style={{ color: readerPalette.mutedText }}>
                                    Highlight not found.
                                  </p>
                                );
                              }

                              return (
                                <>
                                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: readerPalette.mutedText }}>
                                    Highlight
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-xs" style={{ color: readerPalette.chromeText }}>
                                    {activeHighlight.text ?? '(highlight without text)'}
                                  </p>
                                  {activeHighlight.note ? (
                                    <>
                                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: readerPalette.mutedText }}>
                                        Note
                                      </p>
                                      <p className="mt-1 whitespace-pre-wrap text-xs" style={{ color: readerPalette.chromeText }}>
                                        {activeHighlight.note}
                                      </p>
                                    </>
                                  ) : null}
                                  <div className="mt-3 flex items-center gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      style={getReaderButtonStyles(settings)}
                                      onClick={() => {
                                        openHighlightNoteEditor(activeHighlight, highlightContextMenu.x, highlightContextMenu.y + 6);
                                      }}
                                    >
                                      {activeHighlight.note ? 'Edit note' : 'Add note'}
                                    </Button>
                                    <button
                                      type="button"
                                      className="rounded px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                                      onClick={() => {
                                        queueHighlightDeletion(activeHighlight);
                                      }}
                                    >
                                      Delete highlight
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded px-2 py-1 text-xs transition-colors hover:bg-slate-100"
                                      onClick={() => setHighlightContextMenu(null)}
                                    >
                                      Close
                                    </button>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        ) : null}
                        {highlightNoteEditor ? (
                          <div
                            data-highlight-note-editor="true"
                            className="pointer-events-auto absolute z-20 w-[280px] rounded-md border p-3 shadow-lg"
                            style={{
                              left: `${highlightNoteEditor.x}px`,
                              top: `${highlightNoteEditor.y}px`,
                              backgroundColor: readerPalette.panelBg,
                              borderColor: readerPalette.chromeBorder,
                              color: readerPalette.chromeText
                            }}
                          >
                            {(() => {
                              const activeHighlight =
                                pageHighlights.find((item) => item.id === highlightNoteEditor.highlightId) ?? null;
                              if (!activeHighlight) {
                                return (
                                  <p className="text-xs" style={{ color: readerPalette.mutedText }}>
                                    Highlight not found.
                                  </p>
                                );
                              }

                              return (
                                <>
                                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: readerPalette.mutedText }}>
                                    Highlight
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-xs" style={{ color: readerPalette.chromeText }}>
                                    {activeHighlight.text ?? '(highlight without text)'}
                                  </p>
                                  <textarea
                                    value={highlightNoteEditor.draftNote}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      setHighlightNoteEditor((prev) =>
                                        prev ? { ...prev, draftNote: value, error: null } : prev
                                      );
                                    }}
                                    rows={5}
                                    placeholder="Add a note to this highlight..."
                                    className="mt-3 w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    style={{
                                      backgroundColor: readerPalette.inputBg,
                                      borderColor: readerPalette.buttonBorder,
                                      color: readerPalette.inputText
                                    }}
                                  />
                                  {highlightNoteEditor.error ? (
                                    <p className="mt-2 text-xs text-destructive">{highlightNoteEditor.error}</p>
                                  ) : null}
                                  <div className="mt-3 flex items-center gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      style={getReaderButtonStyles(settings)}
                                      disabled={highlightNoteEditor.saving}
                                      onClick={() => {
                                        void saveHighlightNote();
                                      }}
                                    >
                                      Save
                                    </Button>
                                    <button
                                      type="button"
                                      className="rounded px-2 py-1 text-xs transition-colors hover:bg-slate-100"
                                      onClick={() => setHighlightNoteEditor(null)}
                                    >
                                      Close
                                    </button>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {pendingHighlightDeletions.length > 0 ? (
            <div className="pointer-events-none absolute bottom-3 right-3 z-50 flex flex-col gap-2">
              {pendingHighlightDeletions.map((pending) => (
                <div
                  key={pending.id}
                  className="pointer-events-auto flex items-center gap-3 rounded-md border px-3 py-2 shadow-lg"
                  style={{
                    backgroundColor: readerPalette.panelBg,
                    borderColor: readerPalette.chromeBorder,
                    color: readerPalette.chromeText
                  }}
                >
                  <p className="text-xs">Highlight deleted</p>
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
      <ExportDialog
        open={exportDialogOpen}
        loading={exportLoading}
        format={exportFormat}
        preview={exportPreview}
        error={exportError}
        message={exportMessage}
        onFormatChange={(nextFormat) => {
          setExportFormat(nextFormat);
          setExportError(null);
          setExportMessage(null);
        }}
        onCopy={() => {
          void copyExportContent();
        }}
        onSave={() => {
          void saveExportContent();
        }}
        onClose={() => {
          setExportDialogOpen(false);
        }}
      />
    </ReaderShell>
  );
}

function presetToScaleMode(preset: PdfZoomPreset): ScaleMode {
  if (preset === 'fitPage') {
    return 'fitPage';
  }
  if (preset === 'actualSize') {
    return 'manual';
  }
  return 'fitWidth';
}
