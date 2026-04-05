import * as React from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Highlighter,
  ListTree,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Trash2,
  SlidersHorizontal
} from 'lucide-react';
import { ReaderShell } from '@/components/reader/ReaderShell';
import { ReaderSidePanel } from '@/components/reader/ReaderSidePanel';
import { Button } from '@/components/ui/button';
import { ReaderSettingsPanel } from '@/components/ReaderSettingsPanel';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import {
  getEpubThemeBodyStyles,
  getReaderButtonStyles,
  getReaderThemePalette
} from '@/lib/reader-theme';
import { useReadingSessionStats } from '@/lib/reading-stats';
import ePub from 'epubjs';
import type { EpubBookmark, Highlight } from '../../shared/ipc';

type TocItem = {
  id?: string;
  label?: string;
  href?: string;
  subitems?: TocItem[];
};

type Props = {
  title: string;
  bookId: string;
  loading: boolean;
  onBack: () => void;
};

type EpubHighlightPromptState = { highlightId: string; x: number; y: number } | null;
type EpubHighlightEditorState = {
  highlightId: string;
  x: number;
  y: number;
  draftNote: string;
  saving: boolean;
  error: string | null;
} | null;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function formatError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function normalizeToc(items: unknown): TocItem[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => {
    const entry = item as { id?: string; label?: string; href?: string; subitems?: unknown };
    return {
      id: entry.id,
      label: entry.label,
      href: entry.href,
      subitems: normalizeToc(entry.subitems)
    };
  });
}

function normalizeHighlightText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeHighlightNote(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable;
}

function normalizeHrefForMatch(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const withoutHash = trimmed.split('#')[0]?.trim() ?? '';
  return withoutHash || trimmed;
}

function findTocLabelByHref(items: TocItem[], href: string | null): string | null {
  const safeHref = normalizeHrefForMatch(href);
  if (!safeHref) {
    return null;
  }
  for (const item of items) {
    const itemHref = normalizeHrefForMatch(item.href);
    if (itemHref && (itemHref === safeHref || safeHref.startsWith(itemHref) || itemHref.startsWith(safeHref))) {
      const label = item.label?.trim();
      return label || 'Location';
    }
    const nested = findTocLabelByHref(item.subitems ?? [], safeHref);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function toComparableCfi(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isMatchingBookmarkCfi(currentCfi: string | null, savedCfi: string | null): boolean {
  const current = toComparableCfi(currentCfi);
  const saved = toComparableCfi(savedCfi);
  if (!current || !saved) {
    return false;
  }
  return current === saved || current.startsWith(saved) || saved.startsWith(current);
}

function formatTimestamp(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  return new Date(value).toLocaleString();
}

const EPUB_SETTINGS_STYLE_ID = 'reader-settings-style';

function getEpubSettingsCss(settings: ReturnType<typeof useReaderSettings>['settings']): string {
  const bodyStyles = getEpubThemeBodyStyles(settings);
  return `
    html {
      font-size: ${settings.epubFontSize}% !important;
      line-height: ${settings.epubLineHeight} !important;
      background: ${bodyStyles.background} !important;
      color: ${bodyStyles.color} !important;
    }

    body {
      font-size: 1em !important;
      line-height: ${settings.epubLineHeight} !important;
      background: ${bodyStyles.background} !important;
      color: ${bodyStyles.color} !important;
    }

    body, p, div, span, li, a, blockquote, section, article, td, th {
      line-height: ${settings.epubLineHeight} !important;
      color: ${bodyStyles.color} !important;
    }

    p, div, span, li, a, blockquote, section, article {
      font-size: 1em !important;
    }
  `;
}

function upsertEpubSettingsStyle(
  documentNode: Document,
  settings: ReturnType<typeof useReaderSettings>['settings']
): void {
  const root = documentNode.documentElement;
  const head = documentNode.head || documentNode.querySelector('head');
  const body = documentNode.body;
  if (!root || !head || !body) {
    return;
  }

  let styleElement = documentNode.getElementById(EPUB_SETTINGS_STYLE_ID) as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = documentNode.createElement('style');
    styleElement.id = EPUB_SETTINGS_STYLE_ID;
    head.appendChild(styleElement);
  }
  styleElement.textContent = getEpubSettingsCss(settings);
}

function applyInlineEpubStyles(documentNode: Document, settings: ReturnType<typeof useReaderSettings>['settings']): void {
  const bodyStyles = getEpubThemeBodyStyles(settings);
  const html = documentNode.documentElement;
  const body = documentNode.body;
  if (!html || !body) {
    return;
  }

  upsertEpubSettingsStyle(documentNode, settings);
  html.style.setProperty('font-size', `${settings.epubFontSize}%`, 'important');
  html.style.setProperty('line-height', `${settings.epubLineHeight}`, 'important');
  html.style.setProperty('background', bodyStyles.background, 'important');
  html.style.setProperty('color', bodyStyles.color, 'important');

  body.style.setProperty('font-size', `${settings.epubFontSize}%`, 'important');
  body.style.setProperty('line-height', `${settings.epubLineHeight}`, 'important');
  body.style.setProperty('background', bodyStyles.background, 'important');
  body.style.setProperty('color', bodyStyles.color, 'important');
}

function applyRenditionSettings(rendition: any, settings: ReturnType<typeof useReaderSettings>['settings']): void {
  const bodyStyles = getEpubThemeBodyStyles(settings);

  rendition.themes?.default?.({
    html: {
      'font-size': `${settings.epubFontSize}%`,
      'line-height': `${settings.epubLineHeight}`,
      background: bodyStyles.background,
      color: bodyStyles.color
    },
    body: bodyStyles,
    p: {
      'line-height': `${settings.epubLineHeight}`
    }
  });
  rendition.themes?.select?.('default');

  rendition.views?.forEach?.((view: { document?: Document }) => {
    if (view.document) {
      applyInlineEpubStyles(view.document, settings);
    }
  });
}

function TocTree({
  items,
  onSelect,
  palette,
  level = 0,
  path = 'root'
}: {
  items: TocItem[];
  onSelect: (item: TocItem) => void;
  palette: ReturnType<typeof getReaderThemePalette>;
  level?: number;
  path?: string;
}) {
  return (
    <ul className={level === 0 ? 'space-y-1' : 'mt-1 space-y-1'}>
      {items.map((item, index) => {
        const key = `${path}.${item.id ?? index}`;
        const title = (item.label ?? '').trim() || `Chapter ${index + 1}`;
        return (
          <li key={key}>
            <button
              type="button"
              className="w-full overflow-hidden text-wrap break-words rounded px-2 py-1 text-left text-sm whitespace-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ paddingLeft: `${0.5 + level * 0.75}rem`, color: palette.chromeText }}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = palette.panelHoverBg;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={() => onSelect(item)}
            >
              {title}
            </button>
            {item.subitems && item.subitems.length > 0 ? (
              <TocTree items={item.subitems} onSelect={onSelect} palette={palette} level={level + 1} path={key} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function EpubReaderScreen({ title, bookId, loading, onBack }: Props) {
  const readerStageRef = React.useRef<HTMLDivElement | null>(null);
  const readerContainerRef = React.useRef<HTMLDivElement | null>(null);
  const bookRef = React.useRef<any>(null);
  const renditionRef = React.useRef<any>(null);
  const iframeActivityCleanupRef = React.useRef(new Map<HTMLIFrameElement, () => void>());
  const iframeBookmarkCleanupRef = React.useRef(new Map<HTMLIFrameElement, () => void>());
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCfiRef = React.useRef<string | null>(null);
  const toggleCurrentBookmarkRef = React.useRef<() => Promise<void>>(async () => {});
  const epubHighlightsRef = React.useRef<Highlight[]>([]);
  const [tocItems, setTocItems] = React.useState<TocItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [bookmarksPanelOpen, setBookmarksPanelOpen] = React.useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [currentCfi, setCurrentCfi] = React.useState<string | null>(null);
  const [currentHref, setCurrentHref] = React.useState<string | null>(null);
  const [epubBookmarks, setEpubBookmarks] = React.useState<EpubBookmark[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = React.useState(false);
  const [bookmarksError, setBookmarksError] = React.useState<string | null>(null);
  const [epubHighlights, setEpubHighlights] = React.useState<Highlight[]>([]);
  const [highlightPrompt, setHighlightPrompt] = React.useState<EpubHighlightPromptState>(null);
  const [highlightEditor, setHighlightEditor] = React.useState<EpubHighlightEditorState>(null);
  const { settings, loading: settingsLoading, error: settingsError, updateSettings } = useReaderSettings();
  const palette = React.useMemo(() => getReaderThemePalette(settings.theme), [settings.theme]);
  const currentBookmarkLabel = React.useMemo(
    () => findTocLabelByHref(tocItems, currentHref) ?? 'Location',
    [currentHref, tocItems]
  );
  const activeBookmark = React.useMemo(
    () => epubBookmarks.find((bookmark) => isMatchingBookmarkCfi(currentCfi, bookmark.cfi)) ?? null,
    [currentCfi, epubBookmarks]
  );
  const isCurrentLocationBookmarked = activeBookmark !== null;
  const { registerActivity, bindActivityTarget, flush: flushReadingStats } = useReadingSessionStats({
    bookId,
    format: 'epub',
    rootRef: readerContainerRef
  });

  const findFrameForDocument = React.useCallback((documentNode: Document): HTMLIFrameElement | null => {
    const container = readerContainerRef.current;
    if (!container) {
      return null;
    }

    const frames = Array.from(container.querySelectorAll('iframe'));
    for (const frame of frames) {
      if (frame instanceof HTMLIFrameElement && frame.contentDocument === documentNode) {
        return frame;
      }
    }
    return null;
  }, []);

  const clampPopoverPosition = React.useCallback((x: number, y: number) => {
    const stage = readerStageRef.current;
    if (!stage) {
      return { x, y };
    }
    const stageRect = stage.getBoundingClientRect();
    return {
      x: Math.max(12, Math.min(stageRect.width - 12, x)),
      y: Math.max(12, Math.min(stageRect.height - 12, y))
    };
  }, []);

  const getPopoverPositionForRange = React.useCallback(
    (range: Range, documentNode: Document) => {
      const stage = readerStageRef.current;
      const frame = findFrameForDocument(documentNode);
      if (!stage || !frame) {
        return null;
      }
      const stageRect = stage.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const rangeRect = range.getBoundingClientRect();
      return clampPopoverPosition(
        frameRect.left - stageRect.left + rangeRect.right,
        frameRect.top - stageRect.top + rangeRect.bottom + 8
      );
    },
    [clampPopoverPosition, findFrameForDocument]
  );

  const openHighlightEditor = React.useCallback(
    (highlight: Highlight, x: number, y: number) => {
      const position = clampPopoverPosition(x, y);
      setHighlightPrompt(null);
      setHighlightEditor({
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

  const renderHighlights = React.useCallback(
    (highlights: Highlight[]) => {
      const rendition = renditionRef.current;
      if (!rendition?.annotations) {
        return;
      }

      const seen = new Set<string>();
      for (const highlight of highlights) {
        const cfiRange = highlight.cfiRange?.trim();
        if (!cfiRange || seen.has(cfiRange)) {
          continue;
        }
        seen.add(cfiRange);
        rendition.annotations.remove?.(cfiRange, 'highlight');
        rendition.annotations.add?.(
          'highlight',
          cfiRange,
          {},
          (event: Event) => {
            event.preventDefault();
            event.stopPropagation?.();
            registerActivity();
            const stage = readerStageRef.current;
            const target = event.target;
            if (!(stage instanceof HTMLDivElement) || !(target instanceof SVGElement)) {
              return;
            }
            const stageRect = stage.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            openHighlightEditor(
              highlight,
              targetRect.left - stageRect.left + targetRect.width / 2,
              targetRect.bottom - stageRect.top + 8
            );
          },
          highlight.note ? 'epub-highlight epub-highlight-with-note' : 'epub-highlight'
        );
      }
    },
    [openHighlightEditor, registerActivity]
  );

  const loadHighlights = React.useCallback(async () => {
    if (!window.api) {
      setEpubHighlights([]);
      return;
    }

    try {
      const result = await window.api.highlights.list({ bookId });
      if (!result.ok) {
        setEpubHighlights([]);
        return;
      }
      const nextHighlights = result.highlights.filter((highlight) => Boolean(highlight.cfiRange));
      setEpubHighlights(nextHighlights);
      renderHighlights(nextHighlights);
    } catch {
      setEpubHighlights([]);
    }
  }, [bookId, renderHighlights]);

  const loadBookmarks = React.useCallback(async () => {
    if (!window.api?.epubBookmarks) {
      setEpubBookmarks([]);
      setBookmarksError('Bookmarks API is unavailable. Restart the app to reload Electron preload.');
      return;
    }

    setBookmarksLoading(true);
    setBookmarksError(null);
    try {
      const result = await window.api.epubBookmarks.list({ bookId });
      if (!result.ok) {
        setBookmarksError(result.error);
        setEpubBookmarks([]);
        return;
      }
      setEpubBookmarks(result.bookmarks);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setBookmarksError(message);
      setEpubBookmarks([]);
    } finally {
      setBookmarksLoading(false);
    }
  }, [bookId]);

  const toggleCurrentBookmark = React.useCallback(async () => {
    if (!window.api?.epubBookmarks) {
      setBookmarksError('Bookmarks API is unavailable. Restart the app to reload Electron preload.');
      return;
    }

    const safeCfi = toComparableCfi(currentCfi);
    if (!safeCfi) {
      setBookmarksError('Current EPUB location is unavailable.');
      return;
    }

    setBookmarksError(null);
    try {
      const result = await window.api.epubBookmarks.toggle({
        bookId,
        cfi: safeCfi,
        label: currentBookmarkLabel
      });
      if (!result.ok) {
        setBookmarksError(result.error);
        return;
      }
      setEpubBookmarks((prev) => {
        const withoutMatches = prev.filter((bookmark) => !isMatchingBookmarkCfi(bookmark.cfi, safeCfi));
        if (!result.bookmarked || !result.bookmark) {
          return withoutMatches;
        }
        return [...withoutMatches, result.bookmark].sort((a, b) => a.createdAt - b.createdAt);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setBookmarksError(message);
    }
  }, [bookId, currentBookmarkLabel, currentCfi]);

  React.useEffect(() => {
    toggleCurrentBookmarkRef.current = toggleCurrentBookmark;
  }, [toggleCurrentBookmark]);

  const bindIframeBookmarkHotkeys = React.useCallback(() => {
    for (const cleanup of iframeBookmarkCleanupRef.current.values()) {
      cleanup();
    }
    iframeBookmarkCleanupRef.current.clear();

    const container = readerContainerRef.current;
    if (!container) {
      return;
    }

    const frames = Array.from(container.querySelectorAll('iframe'));
    for (const frame of frames) {
      if (!(frame instanceof HTMLIFrameElement) || !frame.contentDocument) {
        continue;
      }
      const documentNode = frame.contentDocument;
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'b' && event.key !== 'B') {
          return;
        }
        if (isTypingTarget(event.target)) {
          return;
        }
        event.preventDefault();
        registerActivity();
        void toggleCurrentBookmarkRef.current();
      };
      documentNode.addEventListener('keydown', handleKeyDown);
      iframeBookmarkCleanupRef.current.set(frame, () => {
        documentNode.removeEventListener('keydown', handleKeyDown);
      });
    }
  }, [registerActivity]);

  const bindIframeActivity = React.useCallback(() => {
    for (const cleanup of iframeActivityCleanupRef.current.values()) {
      cleanup();
    }
    iframeActivityCleanupRef.current.clear();

    const container = readerContainerRef.current;
    if (!container) {
      return;
    }

    const frames = Array.from(container.querySelectorAll('iframe'));
    for (const frame of frames) {
      if (!(frame instanceof HTMLIFrameElement)) {
        continue;
      }
      const documentNode = frame.contentDocument;
      if (!documentNode) {
        continue;
      }
      iframeActivityCleanupRef.current.set(frame, bindActivityTarget(documentNode));
    }
  }, [bindActivityTarget]);

  const persistCfi = React.useCallback(
    async (cfi: string) => {
      const safeCfi = cfi.trim();
      if (!safeCfi || !window.api) {
        return;
      }
      await window.api.epubProgress.set({ bookId, cfi: safeCfi });
    },
    [bookId]
  );

  const saveHighlightNote = React.useCallback(async () => {
    if (!window.api || !highlightEditor) {
      return;
    }
    if (!epubHighlights.some((item) => item.id === highlightEditor.highlightId)) {
      setHighlightEditor(null);
      return;
    }

    const normalizedNote = normalizeHighlightNote(highlightEditor.draftNote);
    setHighlightEditor((prev) => (prev ? { ...prev, saving: true, error: null } : prev));
    try {
      const result = await window.api.highlights.updateNote({
        highlightId: highlightEditor.highlightId,
        note: normalizedNote
      });
      if (!result.ok) {
        setHighlightEditor((prev) => (prev ? { ...prev, saving: false, error: result.error } : prev));
        return;
      }
      setEpubHighlights((prev) => {
        const next = prev.map((item) => (item.id === result.highlight.id ? result.highlight : item));
        renderHighlights(next);
        return next;
      });
      setHighlightPrompt(null);
      setHighlightEditor(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setHighlightEditor((prev) => (prev ? { ...prev, saving: false, error: message } : prev));
    }
  }, [epubHighlights, highlightEditor, renderHighlights]);

  const createHighlightFromSelection = React.useCallback(
    async (cfiRange: string, contents: { document: Document; window: Window }) => {
      if (!window.api) {
        return;
      }

      const safeCfiRange = cfiRange.trim();
      if (!safeCfiRange) {
        return;
      }

      const selectedText = normalizeHighlightText(contents.window.getSelection()?.toString() ?? null);
      const range = renditionRef.current?.getRange?.(safeCfiRange) ?? null;
      const popoverPosition = range ? getPopoverPositionForRange(range, contents.document) : null;

      try {
        const result = await window.api.highlights.insertRaw({
          bookId,
          cfiRange: safeCfiRange,
          text: selectedText,
          note: null
        });
        if (!result.ok) {
          return;
        }
        setEpubHighlights((prev) => {
          const next = [result.highlight, ...prev.filter((item) => item.id !== result.highlight.id)];
          renderHighlights(next);
          return next;
        });
        if (popoverPosition) {
          setHighlightEditor(null);
          setHighlightPrompt({
            highlightId: result.highlight.id,
            x: popoverPosition.x,
            y: popoverPosition.y
          });
        }
      } finally {
        contents.window.getSelection()?.removeAllRanges();
      }
    },
    [bookId, getPopoverPositionForRange, renderHighlights]
  );

  const goPrev = React.useCallback(() => {
    registerActivity();
    renditionRef.current?.prev?.();
  }, [registerActivity]);

  const goNext = React.useCallback(() => {
    registerActivity();
    renditionRef.current?.next?.();
  }, [registerActivity]);

  React.useEffect(() => {
    epubHighlightsRef.current = epubHighlights;
  }, [epubHighlights]);

  React.useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) {
      return;
    }
    applyRenditionSettings(rendition, settings);

    const container = readerContainerRef.current;
    if (!container) {
      return;
    }

    const frames = Array.from(container.querySelectorAll('iframe'));
    for (const frame of frames) {
      const documentNode = frame.contentDocument;
      if (documentNode) {
        applyInlineEpubStyles(documentNode, settings);
      }
    }
    renderHighlights(epubHighlights);
    bindIframeActivity();
    bindIframeBookmarkHotkeys();
  }, [bindIframeActivity, bindIframeBookmarkHotkeys, epubHighlights, renderHighlights, settings]);

  React.useEffect(() => {
    const container = readerContainerRef.current;
    if (!container) {
      return;
    }
    const prefix = `[epub:${bookId}]`;
    const t0 = performance.now();
    const log = (...args: unknown[]) => console.log(prefix, ...args);
    const warn = (...args: unknown[]) => console.warn(prefix, ...args);
    const elapsed = () => `${Math.round(performance.now() - t0)}ms`;

    let canceled = false;
    log('init:start', { at: new Date().toISOString() });
    setReady(false);
    setError(null);
    setTocItems([]);
    setEpubBookmarks([]);
    setBookmarksError(null);
    setCurrentCfi(null);
    setCurrentHref(null);
    setEpubHighlights([]);
    setHighlightPrompt(null);
    setHighlightEditor(null);
    latestCfiRef.current = null;
    container.replaceChildren();

    const init = async () => {
      try {
        if (!window.api) {
          throw new Error('Renderer API is unavailable. Open this app via Electron.');
        }
        log('ipc:getEpubData:start');
        const epubDataResult = await window.api.books.getEpubData({ bookId });
        if (canceled) {
          log('init:aborted:after-getEpubData', { elapsed: elapsed() });
          return;
        }
        if (!epubDataResult.ok) {
          throw new Error(epubDataResult.error);
        }
        log('ipc:getEpubData:ok', {
          title: epubDataResult.title,
          base64Length: epubDataResult.base64.length,
          elapsed: elapsed()
        });
        const epubBytes = Uint8Array.from(atob(epubDataResult.base64), (char) => char.charCodeAt(0));
        log('epub:bytes:decoded', { byteLength: epubBytes.byteLength, elapsed: elapsed() });

        let startCfi: string | null = null;
        log('ipc:epubProgress:get:start');
        const progressResult = await withTimeout(
          window.api.epubProgress.get({ bookId }),
          4000,
          'Timed out while loading reading progress.'
        ).catch(() => null);
        if (canceled) {
          log('init:aborted:after-getProgress', { elapsed: elapsed() });
          return;
        }
        if (progressResult && progressResult.ok) {
          startCfi = progressResult.cfi;
        }
        log('ipc:epubProgress:get:done', { hasStartCfi: Boolean(startCfi), elapsed: elapsed() });

        const openCandidates: Array<{
          label: string;
          createBook: () => any;
        }> = [
          { label: 'array-buffer-binary', createBook: () => ePub(epubBytes.buffer, { openAs: 'binary' }) },
          { label: 'base64', createBook: () => ePub(epubDataResult.base64, { encoding: 'base64' }) }
        ];

        let lastOpenError: unknown = null;
        for (const candidate of openCandidates) {
          if (canceled) {
            return;
          }
          const candidateStart = performance.now();
          try {
            log('candidate:start', { candidate: candidate.label, elapsed: elapsed() });
            const book = candidate.createBook();
            const rendition = book.renderTo(container, {
              width: '100%',
              height: '100%'
            });
            bookRef.current = book;
            renditionRef.current = rendition;
            log('candidate:renderTo:ok', {
              candidate: candidate.label,
              elapsed: elapsed()
            });

            const onRelocated = (location: { start?: { cfi?: string } } | null | undefined) => {
              const cfi = location?.start?.cfi?.trim();
              if (!cfi) {
                return;
              }
              registerActivity();
              log('event:relocated', {
                candidate: candidate.label,
                cfi,
                elapsed: elapsed()
              });
              latestCfiRef.current = cfi;
              setCurrentCfi(cfi);
              setCurrentHref(location?.start && 'href' in location.start ? String((location.start as { href?: string }).href ?? '') : null);
              if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
              }
              saveTimerRef.current = setTimeout(() => {
                saveTimerRef.current = null;
                void persistCfi(cfi);
              }, 400);
            };
            const onRendered = (_section: unknown, view: { document?: Document } | undefined) => {
              applyRenditionSettings(rendition, settings);
              if (view?.document) {
                applyInlineEpubStyles(view.document, settings);
              }

              const frames = Array.from(container.querySelectorAll('iframe'));
              for (const frame of frames) {
                const documentNode = frame.contentDocument;
                if (documentNode) {
                  applyInlineEpubStyles(documentNode, settings);
                }
              }
              renderHighlights(epubHighlightsRef.current);
              bindIframeActivity();
              bindIframeBookmarkHotkeys();
            };
            const onSelected = (selectedCfiRange: string, contents: { document: Document; window: Window }) => {
              registerActivity();
              void createHighlightFromSelection(selectedCfiRange, contents);
            };
            rendition.on?.('relocated', onRelocated);
            rendition.on?.('rendered', onRendered);
            rendition.on?.('selected', onSelected);
            const onDisplayError = (errorPayload: unknown) => {
              warn('event:displayError', { candidate: candidate.label, errorPayload, elapsed: elapsed() });
            };
            rendition.on?.('displayError', onDisplayError);
            const onBookError = (errorPayload: unknown) => {
              warn('event:bookError', { candidate: candidate.label, errorPayload, elapsed: elapsed() });
            };
            const onOpenFailed = (errorPayload: unknown) => {
              warn('event:openFailed', { candidate: candidate.label, errorPayload, elapsed: elapsed() });
            };
            book.on?.('error', onBookError);
            book.on?.('openFailed', onOpenFailed);

            log('navigation:load:start', { candidate: candidate.label, elapsed: elapsed() });
            void withTimeout(
              book.loaded.navigation,
              8000,
              `EPUB contents load timed out (${candidate.label}).`
            )
              .then((navigation) => {
                if (!canceled) {
                  log('navigation:load:ok', {
                    candidate: candidate.label,
                    tocCount: normalizeToc((navigation as { toc?: unknown } | undefined)?.toc).length,
                    elapsed: elapsed()
                  });
                  setTocItems(normalizeToc((navigation as { toc?: unknown } | undefined)?.toc));
                }
              })
              .catch((navError) => {
                warn('navigation:load:error', {
                  candidate: candidate.label,
                  ...formatError(navError),
                  elapsed: elapsed()
                });
                if (!canceled) {
                  setTocItems([]);
                }
              });

            if (startCfi) {
              try {
                log('display:start', { candidate: candidate.label, target: 'startCfi', elapsed: elapsed() });
                await withTimeout(
                  rendition.display(startCfi),
                  20000,
                  `EPUB start position timed out (${candidate.label}).`
                );
                log('display:ok', { candidate: candidate.label, target: 'startCfi', elapsed: elapsed() });
              } catch {
                warn('display:startCfi:failed:fallback', { candidate: candidate.label, elapsed: elapsed() });
                log('display:start', { candidate: candidate.label, target: 'default', elapsed: elapsed() });
                await withTimeout(rendition.display(), 20000, `EPUB first page timed out (${candidate.label}).`);
                log('display:ok', { candidate: candidate.label, target: 'default', elapsed: elapsed() });
              }
            } else {
              log('display:start', { candidate: candidate.label, target: 'default', elapsed: elapsed() });
              await withTimeout(rendition.display(), 20000, `EPUB first page timed out (${candidate.label}).`);
              log('display:ok', { candidate: candidate.label, target: 'default', elapsed: elapsed() });
            }

            await loadHighlights();
            await loadBookmarks();

            if (!canceled) {
              setReady(true);
            }
            log('candidate:success', {
              candidate: candidate.label,
              candidateElapsed: `${Math.round(performance.now() - candidateStart)}ms`,
              elapsed: elapsed()
            });

            return () => {
              rendition.off?.('relocated', onRelocated);
              rendition.off?.('rendered', onRendered);
              rendition.off?.('selected', onSelected);
              rendition.off?.('displayError', onDisplayError);
              book.off?.('error', onBookError);
              book.off?.('openFailed', onOpenFailed);
            };
          } catch (candidateError) {
            lastOpenError = candidateError;
            warn('candidate:error', {
              candidate: candidate.label,
              ...formatError(candidateError),
              candidateElapsed: `${Math.round(performance.now() - candidateStart)}ms`,
              elapsed: elapsed()
            });
            renditionRef.current?.destroy?.();
            bookRef.current?.destroy?.();
            renditionRef.current = null;
            bookRef.current = null;
            container.replaceChildren();
          }
        }

        throw lastOpenError instanceof Error ? lastOpenError : new Error('Failed to load EPUB.');
      } catch (err) {
        if (canceled) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        warn('init:error', { ...formatError(err), elapsed: elapsed() });
        setError(message || 'Failed to load EPUB.');
      }
    };
    let cleanupRelocated: (() => void) | undefined;
    void init().then((cleanupFn) => {
      cleanupRelocated = cleanupFn;
    });

    return () => {
      canceled = true;
      log('init:cleanup', { elapsed: elapsed() });
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (latestCfiRef.current) {
        void persistCfi(latestCfiRef.current);
      }
      cleanupRelocated?.();
      for (const cleanup of iframeActivityCleanupRef.current.values()) {
        cleanup();
      }
      iframeActivityCleanupRef.current.clear();
      for (const cleanup of iframeBookmarkCleanupRef.current.values()) {
        cleanup();
      }
      iframeBookmarkCleanupRef.current.clear();
      flushReadingStats();
      renditionRef.current?.destroy?.();
      bookRef.current?.destroy?.();
      renditionRef.current = null;
      bookRef.current = null;
    };
  }, [bindIframeActivity, bindIframeBookmarkHotkeys, bookId, createHighlightFromSelection, flushReadingStats, loadBookmarks, loadHighlights, persistCfi, registerActivity, renderHighlights, settings]);

  React.useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.closest('[data-epub-highlight-popover="true"]')) {
        return;
      }
      setHighlightPrompt(null);
      setHighlightEditor(null);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      setHighlightPrompt(null);
      setHighlightEditor(null);
    };

    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  React.useEffect(() => {
    setBookmarksPanelOpen(false);
  }, [bookId]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'b' && event.key !== 'B') {
        return;
      }
      if (isTypingTarget(event.target)) {
        return;
      }
      event.preventDefault();
      registerActivity();
      void toggleCurrentBookmarkRef.current();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [registerActivity]);

  return (
    <ReaderShell
      title={title}
      theme={settings.theme}
      leftPanel={
        sidebarOpen ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b px-4 py-3" style={{ borderColor: palette.chromeBorder }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: palette.mutedText }}>
                Contents
              </h3>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
              {tocItems.length > 0 ? (
                <TocTree
                  items={tocItems}
                  onSelect={(item) => {
                    if (!item.href) {
                      return;
                    }
                    registerActivity();
                    void renditionRef.current?.display?.(item.href);
                  }}
                  palette={palette}
                />
              ) : (
                <p className="px-2 py-1 text-sm" style={{ color: palette.mutedText }}>
                  No table of contents found.
                </p>
              )}
            </div>
          </div>
        ) : undefined
      }
      headerLeft={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              flushReadingStats();
              onBack();
            }}
            disabled={loading}
            style={getReaderButtonStyles(settings.theme)}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSidebarOpen((prev) => !prev)}
            style={getReaderButtonStyles(settings.theme, sidebarOpen)}
            aria-label={sidebarOpen ? 'Hide contents' : 'Show contents'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
        </>
      }
      headerRight={
        <>
          <Button type="button" variant="outline" size="sm" disabled style={getReaderButtonStyles(settings.theme)}>
            <Search className="h-4 w-4" />
            Search
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBookmarksPanelOpen(true)}
            style={getReaderButtonStyles(settings.theme, bookmarksPanelOpen)}
          >
            <Bookmark className="h-4 w-4" />
            Bookmarks
          </Button>
          <Button type="button" variant="outline" size="sm" disabled style={getReaderButtonStyles(settings.theme)}>
            Notes
          </Button>
          <Button type="button" variant="outline" size="sm" disabled style={getReaderButtonStyles(settings.theme)}>
            <Highlighter className="h-4 w-4" />
            Highlights
          </Button>
          <Button type="button" variant="outline" size="sm" disabled style={getReaderButtonStyles(settings.theme)}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              registerActivity();
              void toggleCurrentBookmark();
            }}
            disabled={!currentCfi}
            aria-label={isCurrentLocationBookmarked ? 'Remove bookmark from current location' : 'Bookmark current location'}
            title={isCurrentLocationBookmarked ? 'Remove bookmark' : 'Add bookmark'}
            style={getReaderButtonStyles(settings.theme, isCurrentLocationBookmarked)}
          >
            <Star className={`h-4 w-4 ${isCurrentLocationBookmarked ? 'fill-amber-400 text-amber-500' : ''}`} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSettingsPanelOpen((prev) => !prev)}
            style={getReaderButtonStyles(settings.theme, settingsPanelOpen)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Settings
          </Button>
        </>
      }
      headerStatus={
        settingsError ? (
          <p className="text-xs" style={{ color: '#dc2626' }}>
            {settingsError}
          </p>
        ) : null
      }
      rightPanel={
        <>
          <ReaderSidePanel
            open={bookmarksPanelOpen}
            title="Bookmarks"
            theme={settings.theme}
            onClose={() => setBookmarksPanelOpen(false)}
            icon={<Bookmark className="h-4 w-4" />}
            rightOffset={settingsPanelOpen ? 344 : 12}
          >
            <div className="space-y-2">
              {bookmarksError ? <p className="text-xs text-destructive">{bookmarksError}</p> : null}
              {bookmarksLoading ? <p className="text-xs" style={{ color: palette.mutedText }}>Loading...</p> : null}
              {!bookmarksLoading && epubBookmarks.length === 0 ? (
                <p className="text-xs" style={{ color: palette.mutedText }}>No bookmarks for this book.</p>
              ) : null}
              {epubBookmarks.map((bookmark) => {
                const active = isMatchingBookmarkCfi(currentCfi, bookmark.cfi);
                return (
                  <div
                    key={bookmark.id}
                    className="flex items-start gap-2 rounded-md border p-2 transition-colors"
                    style={{ borderColor: active ? palette.accentBorder : palette.chromeBorder, backgroundColor: active ? palette.accentBg : 'transparent' }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        registerActivity();
                        void renditionRef.current?.display?.(bookmark.cfi);
                        setBookmarksPanelOpen(false);
                      }}
                      className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className="text-xs font-semibold" style={{ color: palette.chromeText }}>
                        {bookmark.label ?? 'Location'}
                      </p>
                      <p className="mt-1 truncate text-[11px]" style={{ color: palette.mutedText }}>
                        {bookmark.cfi}
                      </p>
                      <p className="mt-1 text-[11px]" style={{ color: palette.mutedText }}>
                        {formatTimestamp(bookmark.createdAt)}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 transition-colors"
                      style={{ color: palette.mutedText }}
                      aria-label={`Remove bookmark ${bookmark.label ?? 'location'}`}
                      onClick={async () => {
                        try {
                          const result = await window.api?.epubBookmarks.toggle({
                            bookId,
                            cfi: bookmark.cfi,
                            label: bookmark.label
                          });
                          if (!result || !result.ok) {
                            setBookmarksError(result && !result.ok ? result.error : 'Failed to remove bookmark.');
                            return;
                          }
                          setEpubBookmarks((prev) => prev.filter((item) => item.id !== bookmark.id));
                        } catch (err) {
                          setBookmarksError(err instanceof Error ? err.message : String(err));
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </ReaderSidePanel>
          <ReaderSettingsPanel
            open={settingsPanelOpen}
            settings={settings}
            onClose={() => setSettingsPanelOpen(false)}
            onChange={updateSettings}
            palette={palette}
            showEpubControls
          />
        </>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" size="sm" onClick={goPrev} disabled={!ready} style={getReaderButtonStyles(settings.theme)}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Prev
          </Button>
          <div className="inline-flex items-center gap-2 text-xs" style={{ color: palette.mutedText }}>
            <ListTree className="h-3.5 w-3.5" />
            {settingsLoading ? 'Loading settings...' : ready ? 'Ready' : 'Loading EPUB...'}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={goNext} disabled={!ready} style={getReaderButtonStyles(settings.theme)}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div ref={readerStageRef} className="relative flex min-h-0 min-w-0 flex-1" style={{ backgroundColor: palette.viewportBg }}>
        <div className="flex h-full w-full items-center justify-center p-4">
          <div
            className="relative h-full w-full max-w-5xl overflow-hidden rounded-sm border"
            style={{
              backgroundColor: palette.epubBodyBackground,
              borderColor: palette.buttonBorder,
              boxShadow: palette.shadow
            }}
          >
            <div ref={readerContainerRef} className="h-full w-full" />
          </div>
        </div>
        {highlightPrompt ? (
            <div
              data-epub-highlight-popover="true"
              className="pointer-events-auto absolute z-20 w-[180px] rounded-md border p-2 shadow-lg"
              style={{
                left: `${highlightPrompt.x}px`,
                top: `${highlightPrompt.y}px`,
                backgroundColor: palette.panelBg,
                borderColor: palette.chromeBorder,
                color: palette.chromeText
              }}
            >
              <p className="text-xs" style={{ color: palette.mutedText }}>
                Highlight saved
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                style={getReaderButtonStyles(settings.theme)}
                onClick={() => {
                  const targetHighlight = epubHighlights.find((item) => item.id === highlightPrompt.highlightId);
                  if (!targetHighlight) {
                    setHighlightPrompt(null);
                    return;
                  }
                  openHighlightEditor(targetHighlight, highlightPrompt.x, highlightPrompt.y + 6);
                }}
              >
                Add note
              </Button>
              <button
                type="button"
                className="mt-2 block w-full rounded px-2 py-1 text-xs transition-colors hover:bg-slate-100"
                onClick={() => setHighlightPrompt(null)}
              >
                Dismiss
              </button>
            </div>
          ) : null}
          {highlightEditor ? (
            <div
              data-epub-highlight-popover="true"
              className="pointer-events-auto absolute z-20 w-[280px] rounded-md border p-3 shadow-lg"
              style={{
                left: `${highlightEditor.x}px`,
                top: `${highlightEditor.y}px`,
                backgroundColor: palette.panelBg,
                borderColor: palette.chromeBorder,
                color: palette.chromeText
              }}
            >
              {(() => {
                const activeHighlight = epubHighlights.find((item) => item.id === highlightEditor.highlightId) ?? null;
                if (!activeHighlight) {
                  return (
                    <p className="text-xs" style={{ color: palette.mutedText }}>
                      Highlight not found.
                    </p>
                  );
                }

                return (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: palette.mutedText }}>
                      Highlight
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs" style={{ color: palette.chromeText }}>
                      {activeHighlight.text ?? '(highlight without text)'}
                    </p>
                    <textarea
                      value={highlightEditor.draftNote}
                      onChange={(event) => {
                        const value = event.target.value;
                        setHighlightEditor((prev) => (prev ? { ...prev, draftNote: value, error: null } : prev));
                      }}
                      rows={5}
                      placeholder="Add a note to this highlight..."
                      className="mt-3 w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        backgroundColor: palette.inputBg,
                        borderColor: palette.buttonBorder,
                        color: palette.inputText
                      }}
                    />
                    {highlightEditor.error ? <p className="mt-2 text-xs text-destructive">{highlightEditor.error}</p> : null}
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        style={getReaderButtonStyles(settings.theme)}
                        disabled={highlightEditor.saving}
                        onClick={() => {
                          void saveHighlightNote();
                        }}
                      >
                        Save
                      </Button>
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-xs transition-colors hover:bg-slate-100"
                        onClick={() => setHighlightEditor(null)}
                      >
                        Close
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
        ) : null}
        {error ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p
              className="rounded-md border px-3 py-2 text-sm"
              style={{
                borderColor: '#fca5a5',
                backgroundColor: palette.panelBg,
                color: '#b91c1c'
              }}
            >
              {error}
            </p>
          </div>
        ) : null}
      </div>
    </ReaderShell>
  );
}
