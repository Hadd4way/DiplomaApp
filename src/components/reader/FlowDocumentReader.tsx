import * as React from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Highlighter,
  ListTree,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SlidersHorizontal,
  Star,
  Trash2
} from 'lucide-react';
import type { BookFormat, EpubBookmark, Highlight } from '../../../shared/ipc';
import { ReaderSettingsPanel } from '@/components/ReaderSettingsPanel';
import { ExportDialog } from '@/components/ExportDialog';
import { HighlightsPanel, type ReaderHighlightItem } from '@/components/reader/HighlightsPanel';
import { ReaderShell } from '@/components/reader/ReaderShell';
import { ReaderSidePanel } from '@/components/reader/ReaderSidePanel';
import { SearchPanel, type ReaderSearchResultItem } from '@/components/reader/SearchPanel';
import { Button } from '@/components/ui/button';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import {
  isSameFlowPointLocation,
  parseFlowLocation,
  serializeFlowPointLocation,
  serializeFlowRangeLocation,
  type FlowLocationNamespace
} from '@/lib/flow-location';
import {
  getEffectiveEpubFontFamily,
  getEpubThemeBodyStyles,
  getReaderButtonStyles,
  getReaderTextScaleMultiplier,
  getReaderThemePalette
} from '@/lib/reader-theme';
import { useFlowBookmarks } from '@/lib/useFlowBookmarks';
import { useFlowExport } from '@/lib/useFlowExport';
import { useFlowHighlights } from '@/lib/useFlowHighlights';
import { useFlowSearch } from '@/lib/useFlowSearch';
import { useReadingSessionStats } from '@/lib/reading-stats';

type SavedFlowProgress = {
  chapterIndex: number | null;
  scrollRatio: number | null;
};

type HighlightMenuState = {
  highlightId: string;
  x: number;
  y: number;
} | null;

type HighlightEditorState = {
  highlightId: string;
  x: number;
  y: number;
  draftNote: string;
  saving: boolean;
  error: string | null;
} | null;

type OverlayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ResolvedHighlightOverlay = {
  highlightId: string;
  rects: OverlayRect[];
  bounds: OverlayRect;
};

export type FlowReaderChapter = {
  id: string;
  title: string;
  html: string;
  text: string;
};

export type FlowReaderSearchBlock = {
  id: string;
  chapterIndex: number;
  chapterTitle: string;
  text: string;
};

export type FlowReaderDocument = {
  title: string;
  author: string | null;
  coverImage: string | null;
  chapters: FlowReaderChapter[];
  searchBlocks: FlowReaderSearchBlock[];
};

type FlowDocumentReaderProps = {
  title: string;
  bookId: string;
  format: Extract<BookFormat, 'fb2' | 'txt'>;
  namespace: FlowLocationNamespace;
  initialCfi?: string | null;
  onInitialCfiApplied?: () => void;
  loading: boolean;
  onBack: () => void;
  loadDocument: (bookId: string) => Promise<FlowReaderDocument>;
  searchPlaceholder: string;
  loadingLabel: string;
  preparingLabel: string;
  openErrorLabel: string;
  navLabelSingular: string;
  navLabelPlural: string;
};

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

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable;
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

function formatTimestamp(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  return new Date(value).toLocaleString();
}

function getOverlayBounds(rects: OverlayRect[]): OverlayRect | null {
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
  return {
    left,
    top,
    width: right - left,
    height: bottom - top
  };
}

function getBlockElement(container: ParentNode | null, blockId: string | null | undefined): HTMLElement | null {
  if (!container || !blockId) {
    return null;
  }
  const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(blockId) : blockId;
  const node = container.querySelector(`[data-flow-block-id="${escaped}"]`);
  return node instanceof HTMLElement ? node : null;
}

function getChapterElement(container: ParentNode | null, chapterId: string | null | undefined): HTMLElement | null {
  if (!container || !chapterId) {
    return null;
  }
  const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(chapterId) : chapterId;
  const node = container.querySelector(`[data-chapter-id="${escaped}"]`);
  return node instanceof HTMLElement ? node : null;
}

function getClosestBlockElement(node: Node | null): HTMLElement | null {
  if (!node) {
    return null;
  }
  if (node instanceof HTMLElement) {
    return node.closest('[data-flow-block-id]') as HTMLElement | null;
  }
  return node.parentElement?.closest('[data-flow-block-id]') as HTMLElement | null;
}

function getClosestChapterElement(node: Node | null): HTMLElement | null {
  if (!node) {
    return null;
  }
  if (node instanceof HTMLElement) {
    return node.closest('[data-chapter-id]') as HTMLElement | null;
  }
  return node.parentElement?.closest('[data-chapter-id]') as HTMLElement | null;
}

function getTextOffsetWithinBlock(block: HTMLElement, container: Node, offset: number): number {
  const range = document.createRange();
  try {
    range.setStart(block, 0);
    range.setEnd(container, offset);
    return Math.max(0, range.toString().length);
  } catch {
    return 0;
  }
}

function locateTextNodePosition(block: HTMLElement, targetOffset: number): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let lastTextNode: Text | null = null;

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const textLength = textNode.textContent?.length ?? 0;
    const nextConsumed = consumed + textLength;
    lastTextNode = textNode;
    if (targetOffset <= nextConsumed) {
      return {
        node: textNode,
        offset: Math.max(0, Math.min(textLength, targetOffset - consumed))
      };
    }
    consumed = nextConsumed;
  }

  if (lastTextNode) {
    return {
      node: lastTextNode,
      offset: lastTextNode.textContent?.length ?? 0
    };
  }

  return { node: block, offset: 0 };
}

function serializeSelectionRange(
  article: HTMLElement,
  selection: Selection,
  namespace: FlowLocationNamespace
): { location: string; text: string | null } | null {
  if (selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (range.collapsed || !article.contains(range.commonAncestorContainer)) {
    return null;
  }

  const startBlock = getClosestBlockElement(range.startContainer);
  const endBlock = getClosestBlockElement(range.endContainer);
  const chapterElement = getClosestChapterElement(range.startContainer);
  const chapterId = chapterElement?.dataset.chapterId ?? null;
  const startBlockId = startBlock?.dataset.flowBlockId ?? null;
  const endBlockId = endBlock?.dataset.flowBlockId ?? null;
  if (!chapterId || !startBlock || !endBlock || !startBlockId || !endBlockId) {
    return null;
  }

  return {
    location: serializeFlowRangeLocation(namespace, {
      chapterId,
      startBlockId,
      startOffset: getTextOffsetWithinBlock(startBlock, range.startContainer, range.startOffset),
      endBlockId,
      endOffset: getTextOffsetWithinBlock(endBlock, range.endContainer, range.endOffset)
    }),
    text: normalizeHighlightText(selection.toString())
  };
}

function buildRangeFromLocation(article: HTMLElement, location: string): Range | null {
  const parsed = parseFlowLocation(location);
  if (!parsed || parsed.kind !== 'range') {
    return null;
  }

  const startBlock = getBlockElement(article, parsed.startBlockId);
  const endBlock = getBlockElement(article, parsed.endBlockId);
  if (!startBlock || !endBlock) {
    return null;
  }

  const startPosition = locateTextNodePosition(startBlock, parsed.startOffset);
  const endPosition = locateTextNodePosition(endBlock, parsed.endOffset);
  if (!startPosition || !endPosition) {
    return null;
  }

  try {
    const range = document.createRange();
    range.setStart(startPosition.node, startPosition.offset);
    range.setEnd(endPosition.node, endPosition.offset);
    return range;
  } catch {
    return null;
  }
}

function createHighlightOverlay(article: HTMLElement, highlight: Highlight): ResolvedHighlightOverlay | null {
  const location = normalizeHighlightNote(highlight.cfiRange);
  if (!location) {
    return null;
  }
  const range = buildRangeFromLocation(article, location);
  if (!range) {
    return null;
  }

  const articleRect = article.getBoundingClientRect();
  const rects = Array.from(range.getClientRects())
    .map((rect) => ({
      left: rect.left - articleRect.left,
      top: rect.top - articleRect.top,
      width: rect.width,
      height: rect.height
    }))
    .filter((rect) => rect.width > 1 && rect.height > 1);

  const bounds = getOverlayBounds(rects);
  if (!bounds) {
    return null;
  }

  return {
    highlightId: highlight.id,
    rects,
    bounds
  };
}

export function FlowDocumentReader({
  title,
  bookId,
  format,
  namespace,
  initialCfi = null,
  onInitialCfiApplied,
  loading,
  onBack,
  loadDocument,
  searchPlaceholder,
  loadingLabel,
  preparingLabel,
  openErrorLabel,
  navLabelSingular,
  navLabelPlural
}: FlowDocumentReaderProps) {
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const articleRef = React.useRef<HTMLElement | null>(null);
  const chapterRefs = React.useRef<Array<HTMLElement | null>>([]);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchFlashTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestChapterIndexRef = React.useRef(0);
  const latestScrollRatioRef = React.useRef(0);
  const restoreDoneRef = React.useRef(false);
  const initialLocationAppliedRef = React.useRef(false);
  const [documentData, setDocumentData] = React.useState<FlowReaderDocument | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [searchPanelOpen, setSearchPanelOpen] = React.useState(false);
  const [bookmarksPanelOpen, setBookmarksPanelOpen] = React.useState(false);
  const [highlightsPanelOpen, setHighlightsPanelOpen] = React.useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = React.useState(false);
  const [activeChapterIndex, setActiveChapterIndex] = React.useState(0);
  const [savedProgress, setSavedProgress] = React.useState<SavedFlowProgress>({ chapterIndex: null, scrollRatio: null });
  const [activeSearchIndex, setActiveSearchIndex] = React.useState(-1);
  const [currentLocation, setCurrentLocation] = React.useState<string | null>(null);
  const [highlightMenu, setHighlightMenu] = React.useState<HighlightMenuState>(null);
  const [highlightEditor, setHighlightEditor] = React.useState<HighlightEditorState>(null);
  const [resolvedHighlightOverlays, setResolvedHighlightOverlays] = React.useState<ResolvedHighlightOverlay[]>([]);
  const { settings, loading: settingsLoading, error: settingsError, updateSettings } = useReaderSettings();
  const palette = React.useMemo(() => getReaderThemePalette(settings), [settings]);
  const bodyStyles = React.useMemo(() => getEpubThemeBodyStyles(settings), [settings]);
  const fontStack = React.useMemo(() => getEffectiveEpubFontFamily(settings), [settings]);
  const effectiveFontSize = React.useMemo(
    () => `${Math.round(settings.epubFontSize * getReaderTextScaleMultiplier(settings.textSizePreset))}%`,
    [settings.epubFontSize, settings.textSizePreset]
  );
  const { registerActivity, flush: flushReadingStats } = useReadingSessionStats({
    bookId,
    format,
    rootRef: scrollContainerRef
  });
  const exportState = useFlowExport({ bookId, title });
  const { highlights, error: highlightsError, createHighlight, deleteHighlight, updateHighlightNote } = useFlowHighlights(bookId);
  const currentChapter = documentData?.chapters[activeChapterIndex] ?? null;
  const currentBookmarkLabel = currentChapter?.title ?? 'Location';
  const bookmarksState = useFlowBookmarks({
    bookId,
    currentLocation,
    currentLabel: currentBookmarkLabel,
    matchLocation: isSameFlowPointLocation
  });
  const searchBlocks = documentData?.searchBlocks ?? [];
  const { query: searchQuery, results: searchResults, isSearching, setQuery: setSearchQuery } = useFlowSearch(searchBlocks, bookId);

  const searchPanelResults = React.useMemo<ReaderSearchResultItem[]>(
    () =>
      searchResults.map((result) => ({
        id: result.id,
        excerpt: result.excerpt,
        start: result.start,
        end: result.end,
        locationLabel: `${navLabelSingular} ${result.chapterIndex + 1}`,
        chapterLabel: result.chapterLabel
      })),
    [navLabelSingular, searchResults]
  );
  const highlightItems = React.useMemo<ReaderHighlightItem[]>(
    () =>
      highlights.map((highlight) => ({
        id: highlight.id,
        text: highlight.text,
        note: highlight.note,
        cfiRange: highlight.cfiRange,
        createdAt: highlight.createdAt
      })),
    [highlights]
  );
  const displayTitle = documentData?.title || title;
  const highlightById = React.useMemo(() => {
    const map = new Map<string, Highlight>();
    for (const highlight of highlights) {
      map.set(highlight.id, highlight);
    }
    return map;
  }, [highlights]);

  const persistProgress = React.useCallback(
    (chapterIndex: number, scrollRatio: number) => {
      if (!window.api?.flowProgress) {
        return;
      }
      latestChapterIndexRef.current = Math.max(0, chapterIndex);
      latestScrollRatioRef.current = clampRatio(scrollRatio);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void window.api.flowProgress
          .set({
            bookId,
            chapterIndex: latestChapterIndexRef.current,
            scrollRatio: latestScrollRatioRef.current
          })
          .catch(() => undefined);
      }, 250);
    },
    [bookId]
  );

  const flushProgressSave = React.useCallback(() => {
    if (!window.api?.flowProgress) {
      return;
    }

    const container = scrollContainerRef.current;
    if (container) {
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      latestScrollRatioRef.current = maxScroll > 0 ? clampRatio(container.scrollTop / maxScroll) : 0;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    void window.api.flowProgress
      .set({
        bookId,
        chapterIndex: latestChapterIndexRef.current,
        scrollRatio: latestScrollRatioRef.current
      })
      .catch(() => undefined);
  }, [bookId]);

  const openSearchPanel = React.useCallback(() => {
    setBookmarksPanelOpen(false);
    setHighlightsPanelOpen(false);
    setSettingsPanelOpen(false);
    setSearchPanelOpen(true);
  }, []);

  const openBookmarksPanel = React.useCallback(() => {
    setSearchPanelOpen(false);
    setHighlightsPanelOpen(false);
    setSettingsPanelOpen(false);
    setBookmarksPanelOpen(true);
  }, []);

  const openHighlightsPanel = React.useCallback(() => {
    setSearchPanelOpen(false);
    setBookmarksPanelOpen(false);
    setSettingsPanelOpen(false);
    setHighlightsPanelOpen(true);
  }, []);

  const scrollToLocation = React.useCallback(
    (location: string | null | undefined, behavior: ScrollBehavior = settings.reduceMotion ? 'auto' : 'smooth') => {
      const container = scrollContainerRef.current;
      const article = articleRef.current;
      if (!container || !article || !location) {
        return false;
      }
      const parsed = parseFlowLocation(location);
      if (!parsed || parsed.namespace !== namespace) {
        return false;
      }
      const target =
        parsed.kind === 'range'
          ? getBlockElement(article, parsed.startBlockId)
          : getBlockElement(article, parsed.blockId) ?? getChapterElement(article, parsed.chapterId);
      if (!target) {
        return false;
      }
      container.scrollTo({ top: Math.max(0, target.offsetTop - 32), behavior });
      return true;
    },
    [namespace, settings.reduceMotion]
  );

  const flashSearchTarget = React.useCallback((element: HTMLElement) => {
    const previousBoxShadow = element.style.boxShadow;
    const previousBackground = element.style.backgroundColor;
    element.style.boxShadow = '0 0 0 2px rgba(245, 158, 11, 0.65) inset';
    element.style.backgroundColor = 'rgba(253, 230, 138, 0.18)';
    if (searchFlashTimerRef.current) {
      clearTimeout(searchFlashTimerRef.current);
    }
    searchFlashTimerRef.current = setTimeout(() => {
      element.style.boxShadow = previousBoxShadow;
      element.style.backgroundColor = previousBackground;
    }, 1400);
  }, []);

  const navigateToSearchIndex = React.useCallback(
    (index: number) => {
      const result = searchResults[index];
      const article = articleRef.current;
      if (!result || !article) {
        return;
      }
      setActiveSearchIndex(index);
      const target = getBlockElement(article, result.blockId);
      if (target) {
        const chapterId = documentData?.chapters[result.chapterIndex]?.id ?? `${namespace}-chapter-${result.chapterIndex}`;
        scrollToLocation(serializeFlowPointLocation(namespace, { chapterId, blockId: result.blockId }));
        flashSearchTarget(target);
      }
    },
    [documentData?.chapters, flashSearchTarget, namespace, scrollToLocation, searchResults]
  );

  const goToNextSearchResult = React.useCallback(() => {
    const nextActiveIndex = nextIndex(activeSearchIndex, searchResults.length);
    if (nextActiveIndex >= 0) {
      navigateToSearchIndex(nextActiveIndex);
    }
  }, [activeSearchIndex, navigateToSearchIndex, searchResults.length]);

  const goToPrevSearchResult = React.useCallback(() => {
    const nextActiveIndex = prevIndex(activeSearchIndex, searchResults.length);
    if (nextActiveIndex >= 0) {
      navigateToSearchIndex(nextActiveIndex);
    }
  }, [activeSearchIndex, navigateToSearchIndex, searchResults.length]);

  const openHighlightEditor = React.useCallback((highlight: Highlight) => {
    const menuPosition = highlightMenu;
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const x = menuPosition?.x ?? Math.max(12, stageRect.width - 304);
    const y = menuPosition?.y ? menuPosition.y + 6 : 20;
    setHighlightMenu(null);
    setHighlightEditor({
      highlightId: highlight.id,
      x,
      y,
      draftNote: highlight.note ?? '',
      saving: false,
      error: null
    });
  }, [highlightMenu]);

  const saveHighlightNote = React.useCallback(async () => {
    if (!highlightEditor) {
      return;
    }
    setHighlightEditor((prev) => (prev ? { ...prev, saving: true, error: null } : prev));
    try {
      const updated = await updateHighlightNote(highlightEditor.highlightId, normalizeHighlightNote(highlightEditor.draftNote));
      if (!updated) {
        setHighlightEditor((prev) => (prev ? { ...prev, saving: false, error: 'Failed to save note.' } : prev));
        return;
      }
      setHighlightEditor(null);
    } catch (saveError) {
      setHighlightEditor((prev) =>
        prev ? { ...prev, saving: false, error: saveError instanceof Error ? saveError.message : String(saveError) } : prev
      );
    }
  }, [highlightEditor, updateHighlightNote]);

  const openHighlightMenu = React.useCallback((highlightId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    setHighlightMenu({
      highlightId,
      x: Math.max(12, event.clientX - stageRect.left + 8),
      y: Math.max(12, event.clientY - stageRect.top + 8)
    });
  }, []);

  const createHighlightFromSelection = React.useCallback(async () => {
    const article = articleRef.current;
    const selection = window.getSelection();
    if (!article || !selection || selection.isCollapsed) {
      return;
    }
    const stage = stageRef.current;
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const stageRect = stage?.getBoundingClientRect() ?? null;
    const selectionRect = range?.getBoundingClientRect() ?? null;
    const payload = serializeSelectionRange(article, selection, namespace);
    if (!payload) {
      return;
    }
    registerActivity();
    const created = await createHighlight(payload);
    if (created) {
      selection.removeAllRanges();
      if (stageRect && selectionRect) {
        setHighlightsPanelOpen(false);
        setHighlightMenu({
          highlightId: created.id,
          x: Math.max(12, selectionRect.left - stageRect.left + selectionRect.width / 2),
          y: Math.max(12, selectionRect.bottom - stageRect.top + 8)
        });
      }
    }
  }, [createHighlight, namespace, registerActivity]);

  React.useEffect(() => {
    let canceled = false;

    const load = async () => {
      if (!window.api) {
        setError('Renderer API is unavailable. Open this app via Electron.');
        return;
      }

      setReady(false);
      setError(null);
      setCurrentLocation(null);
      restoreDoneRef.current = false;
      initialLocationAppliedRef.current = false;
      setActiveSearchIndex(-1);

      try {
        const [progressResult, parsed] = await Promise.all([
          window.api.flowProgress.get({ bookId }),
          loadDocument(bookId)
        ]);

        if (canceled) {
          return;
        }

        setSavedProgress(progressResult.ok ? progressResult.progress : { chapterIndex: null, scrollRatio: null });
        setDocumentData(parsed);
        setActiveChapterIndex(Math.max(0, progressResult.ok ? progressResult.progress.chapterIndex ?? 0 : 0));
        setReady(true);
      } catch (loadError) {
        if (!canceled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    };

    void load();
    return () => {
      canceled = true;
    };
  }, [bookId, loadDocument]);

  React.useEffect(() => {
    if (!ready || !documentData || restoreDoneRef.current) {
      return;
    }
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const chapterIndex = Math.max(0, Math.min(documentData.chapters.length - 1, savedProgress.chapterIndex ?? 0));
      if (savedProgress.scrollRatio !== null && maxScroll > 0) {
        container.scrollTop = maxScroll * clampRatio(savedProgress.scrollRatio);
      } else {
        const target = chapterRefs.current[chapterIndex];
        if (target) {
          container.scrollTop = Math.max(0, target.offsetTop - 20);
        }
      }
      setActiveChapterIndex(chapterIndex);
      restoreDoneRef.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, [documentData, ready, savedProgress]);

  React.useEffect(() => {
    if (!ready || !initialCfi || initialLocationAppliedRef.current) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const applied = scrollToLocation(initialCfi, settings.reduceMotion ? 'auto' : 'smooth');
      if (applied) {
        initialLocationAppliedRef.current = true;
        onInitialCfiApplied?.();
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [initialCfi, onInitialCfiApplied, ready, scrollToLocation, settings.reduceMotion]);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    const article = articleRef.current;
    if (!container || !article || !documentData) {
      return;
    }

    const handleScroll = () => {
      registerActivity();
      const chapterElements = chapterRefs.current;
      let nextChapterIndex = 0;
      const scrollMarker = container.scrollTop + 96;
      for (let index = 0; index < chapterElements.length; index += 1) {
        const element = chapterElements[index];
        if (!element) {
          continue;
        }
        if (element.offsetTop <= scrollMarker) {
          nextChapterIndex = index;
        } else {
          break;
        }
      }

      const blockElements = Array.from(article.querySelectorAll('[data-flow-block-id]')).filter(
        (node): node is HTMLElement => node instanceof HTMLElement
      );
      let activeBlockId: string | null = null;
      for (const block of blockElements) {
        if (block.offsetTop <= scrollMarker) {
          activeBlockId = block.dataset.flowBlockId ?? null;
        } else {
          break;
        }
      }

      const chapterId = documentData.chapters[nextChapterIndex]?.id ?? `${namespace}-chapter-${nextChapterIndex}`;
      setCurrentLocation(serializeFlowPointLocation(namespace, { chapterId, blockId: activeBlockId }));
      setActiveChapterIndex(nextChapterIndex);
      latestChapterIndexRef.current = nextChapterIndex;

      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const ratio = maxScroll > 0 ? container.scrollTop / maxScroll : 0;
      persistProgress(nextChapterIndex, ratio);
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [documentData, namespace, persistProgress, registerActivity]);

  React.useEffect(() => {
    if (!ready || !articleRef.current) {
      setResolvedHighlightOverlays([]);
      return;
    }

    const article = articleRef.current;
    const updateOverlays = () => {
      setResolvedHighlightOverlays(
        highlights
          .map((highlight) => createHighlightOverlay(article, highlight))
          .filter((item): item is ResolvedHighlightOverlay => Boolean(item))
      );
    };

    updateOverlays();
    const frame = requestAnimationFrame(updateOverlays);
    const observer = new ResizeObserver(updateOverlays);
    observer.observe(article);
    window.addEventListener('resize', updateOverlays);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updateOverlays);
    };
  }, [highlights, ready, settings]);

  React.useEffect(() => {
    return () => {
      flushProgressSave();
      if (searchFlashTimerRef.current) {
        clearTimeout(searchFlashTimerRef.current);
      }
    };
  }, [flushProgressSave]);

  React.useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.closest('[data-flow-highlight-popover="true"]')) {
        return;
      }
      setHighlightMenu(null);
      setHighlightEditor(null);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      setHighlightMenu(null);
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
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const typing = isTypingTarget(event.target ?? activeElement);
      const ctrlOrMeta = event.ctrlKey || event.metaKey;

      if (event.key === 'Escape') {
        if (highlightEditor) {
          event.preventDefault();
          setHighlightEditor(null);
          return;
        }
        if (highlightMenu) {
          event.preventDefault();
          setHighlightMenu(null);
          return;
        }
        if (settingsPanelOpen) {
          event.preventDefault();
          setSettingsPanelOpen(false);
          return;
        }
        if (searchPanelOpen) {
          event.preventDefault();
          setSearchPanelOpen(false);
          return;
        }
        if (bookmarksPanelOpen) {
          event.preventDefault();
          setBookmarksPanelOpen(false);
          return;
        }
        if (highlightsPanelOpen) {
          event.preventDefault();
          setHighlightsPanelOpen(false);
          return;
        }
        if (sidebarOpen) {
          event.preventDefault();
          setSidebarOpen(false);
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

      if (event.key === 'F3') {
        event.preventDefault();
        if (event.shiftKey) {
          goToPrevSearchResult();
        } else {
          goToNextSearchResult();
        }
        return;
      }

      if (event.key === 'b' || event.key === 'B') {
        event.preventDefault();
        registerActivity();
        void bookmarksState.toggleCurrentBookmark();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    bookmarksPanelOpen,
    bookmarksState,
    goToNextSearchResult,
    goToPrevSearchResult,
    highlightEditor,
    highlightMenu,
    highlightsPanelOpen,
    openSearchPanel,
    registerActivity,
    searchPanelOpen,
    settingsPanelOpen,
    sidebarOpen
  ]);

  const headerStatus = (
    <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: palette.mutedText }}>
      <span>{documentData?.author || 'Author unavailable'}</span>
      <span>/</span>
      <span>{documentData ? `${activeChapterIndex + 1} / ${documentData.chapters.length} ${navLabelPlural}` : loadingLabel}</span>
      {currentChapter ? (
        <>
          <span>/</span>
          <span className="truncate">{currentChapter.title}</span>
        </>
      ) : null}
      {settingsError ? <span className="text-destructive">{settingsError}</span> : null}
      {highlightsError ? <span className="text-destructive">{highlightsError}</span> : null}
    </div>
  );

  const goPrevChapter = () => {
    const nextChapter = Math.max(0, activeChapterIndex - 1);
    const chapterId = documentData?.chapters[nextChapter]?.id ?? `${namespace}-chapter-${nextChapter}`;
    scrollToLocation(serializeFlowPointLocation(namespace, { chapterId }));
  };

  const goNextChapter = () => {
    const nextChapter = Math.min((documentData?.chapters.length ?? 1) - 1, activeChapterIndex + 1);
    const chapterId = documentData?.chapters[nextChapter]?.id ?? `${namespace}-chapter-${nextChapter}`;
    scrollToLocation(serializeFlowPointLocation(namespace, { chapterId }));
  };

  return (
    <>
      <ReaderShell
        title={displayTitle}
        settings={settings}
        leftPanel={
          sidebarOpen && documentData ? (
            <div className="h-full overflow-y-auto p-3">
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: palette.mutedText }}>
                  Contents
                </p>
              </div>
              <div className="space-y-1">
                {documentData.chapters.map((chapter, index) => {
                  const active = index === activeChapterIndex;
                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
                      style={{
                        backgroundColor: active ? palette.accentBg : 'transparent',
                        color: active ? palette.accentText : palette.chromeText,
                        boxShadow: active ? `inset 0 0 0 1px ${palette.accentBorder}` : 'none'
                      }}
                      onClick={() => {
                        registerActivity();
                        scrollToLocation(serializeFlowPointLocation(namespace, { chapterId: chapter.id }));
                      }}
                    >
                      {chapter.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : undefined
        }
        leftPanelWidthClassName="w-[280px]"
        headerLeft={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                flushProgressSave();
                flushReadingStats();
                onBack();
              }}
              disabled={loading}
              style={getReaderButtonStyles(settings)}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen((current) => !current)}
              style={getReaderButtonStyles(settings, sidebarOpen)}
              aria-label={sidebarOpen ? 'Hide contents' : 'Show contents'}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
          </>
        }
        headerRight={
          <>
            <Button type="button" variant="outline" size="sm" onClick={openSearchPanel} style={getReaderButtonStyles(settings, searchPanelOpen)}>
              <Search className="h-4 w-4" />
              Search
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={openBookmarksPanel} style={getReaderButtonStyles(settings, bookmarksPanelOpen)}>
              <Bookmark className="h-4 w-4" />
              Bookmarks
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={openHighlightsPanel} style={getReaderButtonStyles(settings, highlightsPanelOpen)}>
              <Highlighter className="h-4 w-4" />
              Highlights
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void exportState.openExportDialog();
              }}
              style={getReaderButtonStyles(settings)}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                registerActivity();
                void bookmarksState.toggleCurrentBookmark();
              }}
              disabled={!currentLocation}
              aria-label={bookmarksState.isCurrentLocationBookmarked ? 'Remove bookmark from current location' : 'Bookmark current location'}
              title={bookmarksState.isCurrentLocationBookmarked ? 'Remove bookmark' : 'Add bookmark'}
              style={getReaderButtonStyles(settings, bookmarksState.isCurrentLocationBookmarked)}
            >
              <Star className={`h-4 w-4 ${bookmarksState.isCurrentLocationBookmarked ? 'fill-amber-400 text-amber-500' : ''}`} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchPanelOpen(false);
                setBookmarksPanelOpen(false);
                setHighlightsPanelOpen(false);
                setSettingsPanelOpen((current) => !current);
              }}
              disabled={settingsLoading}
              style={getReaderButtonStyles(settings, settingsPanelOpen)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Settings
            </Button>
          </>
        }
        headerStatus={headerStatus}
        rightPanel={
          <>
            <SearchPanel
              open={searchPanelOpen}
              settings={settings}
              query={searchQuery}
              results={searchPanelResults}
              isSearching={isSearching}
              activeIndex={activeSearchIndex}
              onClose={() => setSearchPanelOpen(false)}
              onQueryChange={setSearchQuery}
              onPrev={goToPrevSearchResult}
              onNext={goToNextSearchResult}
              onSelectResult={navigateToSearchIndex}
              onRegisterActivity={registerActivity}
              placeholder={searchPlaceholder}
              rightOffset={settingsPanelOpen ? 344 : 12}
              emptyQueryMessage="Type a query to search the whole book."
              noResultsMessage="No matches found."
            />
            <ReaderSidePanel
              open={bookmarksPanelOpen}
              title="Bookmarks"
              settings={settings}
              onClose={() => setBookmarksPanelOpen(false)}
              icon={<Bookmark className="h-4 w-4" />}
              rightOffset={settingsPanelOpen ? 344 : 12}
            >
              <div className="space-y-2">
                {bookmarksState.error ? <p className="text-xs text-destructive">{bookmarksState.error}</p> : null}
                {bookmarksState.loading ? <p className="text-xs" style={{ color: palette.mutedText }}>Loading...</p> : null}
                {!bookmarksState.loading && bookmarksState.bookmarks.length === 0 ? (
                  <p className="text-xs" style={{ color: palette.mutedText }}>No bookmarks for this book.</p>
                ) : null}
                {bookmarksState.bookmarks.map((bookmark: EpubBookmark) => {
                  const active = isSameFlowPointLocation(currentLocation, bookmark.cfi);
                  return (
                    <div
                      key={bookmark.id}
                      className="flex items-start gap-2 rounded-md border p-2 transition-colors"
                      style={{
                        borderColor: active ? palette.accentBorder : palette.chromeBorder,
                        backgroundColor: active ? palette.accentBg : 'transparent'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          registerActivity();
                          scrollToLocation(bookmark.cfi);
                          setBookmarksPanelOpen(false);
                        }}
                        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <p className="text-xs font-semibold" style={{ color: palette.chromeText }}>{bookmark.label ?? 'Location'}</p>
                        <p className="mt-1 truncate text-[11px]" style={{ color: palette.mutedText }}>{bookmark.cfi}</p>
                        <p className="mt-1 text-[11px]" style={{ color: palette.mutedText }}>{formatTimestamp(bookmark.createdAt)}</p>
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 transition-colors"
                        style={{ color: palette.mutedText }}
                        aria-label={`Remove bookmark ${bookmark.label ?? 'location'}`}
                        onClick={() => {
                          void bookmarksState.removeBookmark(bookmark);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </ReaderSidePanel>
            <HighlightsPanel
              items={highlightItems}
              isOpen={highlightsPanelOpen}
              onClose={() => setHighlightsPanelOpen(false)}
              onJumpToItem={(item) => {
                registerActivity();
                scrollToLocation(item.cfiRange);
                setHighlightsPanelOpen(false);
              }}
              onDeleteItem={(item) => {
                void deleteHighlight(item.id);
              }}
              onEditNote={(item) => {
                const highlight = highlightById.get(item.id);
                if (highlight) {
                  openHighlightEditor(highlight);
                }
              }}
              settings={settings}
              rightOffset={settingsPanelOpen ? 344 : 12}
            />
            <ReaderSettingsPanel
              open={settingsPanelOpen}
              format={format}
              settings={settings}
              onClose={() => setSettingsPanelOpen(false)}
              onChange={updateSettings}
              palette={palette}
            />
          </>
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" size="sm" onClick={goPrevChapter} disabled={!ready || activeChapterIndex <= 0} style={getReaderButtonStyles(settings)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Prev
            </Button>
            <div className="inline-flex items-center gap-2 text-xs" style={{ color: palette.mutedText }}>
              <ListTree className="h-3.5 w-3.5" />
              {settingsLoading ? 'Loading settings...' : ready ? 'Ready' : loadingLabel}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goNextChapter}
              disabled={!ready || activeChapterIndex >= (documentData?.chapters.length ?? 1) - 1}
              style={getReaderButtonStyles(settings)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        }
      >
        <div ref={stageRef} className="relative flex min-h-0 min-w-0 flex-1" style={{ backgroundColor: palette.viewportBg }}>
          <div
            ref={scrollContainerRef}
            className="fb2-reader-scroll h-full w-full overflow-y-auto px-5 py-6 md:px-8"
            style={{ backgroundColor: palette.readerSurface, color: bodyStyles.color }}
          >
            {error ? (
              <div className="mx-auto max-w-3xl rounded-2xl border px-5 py-4" style={{ borderColor: palette.chromeBorder }}>
                <p className="text-sm font-semibold">{openErrorLabel}</p>
                <p className="mt-2 text-sm" style={{ color: palette.mutedText }}>{error}</p>
              </div>
            ) : null}
            {!error && !ready ? (
              <div className="mx-auto max-w-3xl rounded-2xl border px-5 py-4" style={{ borderColor: palette.chromeBorder }}>
                <p className="text-sm">{loading ? loadingLabel : preparingLabel}</p>
              </div>
            ) : null}
            {!error && ready && documentData ? (
              <article
                ref={articleRef}
                className="fb2-reader-article relative mx-auto max-w-3xl rounded-[28px] border px-6 py-8 shadow-sm md:px-10"
                style={{
                  borderColor: palette.chromeBorder,
                  backgroundColor: palette.epubBodyBackground,
                  color: bodyStyles.color,
                  fontFamily: fontStack,
                  fontSize: effectiveFontSize,
                  lineHeight: bodyStyles['line-height'],
                  letterSpacing: bodyStyles['letter-spacing'],
                  wordSpacing: bodyStyles['word-spacing']
                }}
                onMouseUp={() => {
                  void createHighlightFromSelection();
                }}
              >
                <div className="pointer-events-none absolute inset-0 z-10">
                  {resolvedHighlightOverlays.map((overlay) => {
                    const highlight = highlightById.get(overlay.highlightId);
                    if (!highlight) {
                      return null;
                    }
                    return (
                      <div key={overlay.highlightId}>
                        {overlay.rects.map((rect, index) => (
                          <button
                            key={`${overlay.highlightId}:${index}`}
                            type="button"
                            className="pointer-events-auto absolute rounded-sm"
                            style={{
                              left: `${rect.left}px`,
                              top: `${rect.top}px`,
                              width: `${rect.width}px`,
                              height: `${rect.height}px`,
                              backgroundColor: highlight.note ? 'rgba(250, 204, 21, 0.4)' : 'rgba(253, 224, 71, 0.34)',
                              boxShadow: highlight.note ? '0 0 0 1px rgba(180, 83, 9, 0.55) inset' : 'none'
                            }}
                            aria-label="Open highlight actions"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              openHighlightMenu(overlay.highlightId, event);
                            }}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
                {documentData.coverImage ? (
                  <div className="mb-8 flex justify-center">
                    <img src={documentData.coverImage} alt="" className="max-h-80 rounded-2xl border object-contain shadow-sm" style={{ borderColor: palette.chromeBorder }} />
                  </div>
                ) : null}
                {documentData.chapters.map((chapter, index) => (
                  <section
                    key={chapter.id}
                    ref={(node) => {
                      chapterRefs.current[index] = node;
                    }}
                    className="fb2-chapter scroll-mt-6"
                    data-chapter-index={index}
                    data-chapter-id={chapter.id}
                  >
                    <h1 className="fb2-chapter-title">{chapter.title}</h1>
                    <div dangerouslySetInnerHTML={{ __html: chapter.html }} />
                  </section>
                ))}
              </article>
            ) : null}
          </div>
          {highlightMenu ? (
            <div
              data-flow-highlight-popover="true"
              className="absolute z-20 w-[280px] rounded-md border p-3 shadow-lg"
              style={{
                left: `${highlightMenu.x}px`,
                top: `${highlightMenu.y}px`,
                backgroundColor: palette.panelBg,
                borderColor: palette.chromeBorder,
                color: palette.chromeText
              }}
            >
              {(() => {
                const activeHighlight = highlightById.get(highlightMenu.highlightId) ?? null;
                if (!activeHighlight) {
                  return <p className="text-xs" style={{ color: palette.mutedText }}>Highlight not found.</p>;
                }
                return (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: palette.mutedText }}>Highlight</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs" style={{ color: palette.chromeText }}>{activeHighlight.text ?? '(highlight without text)'}</p>
                    {activeHighlight.note ? (
                      <>
                        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: palette.mutedText }}>Note</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs" style={{ color: palette.chromeText }}>{activeHighlight.note}</p>
                      </>
                    ) : null}
                    <div className="mt-3 flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" style={getReaderButtonStyles(settings)} onClick={() => openHighlightEditor(activeHighlight)}>
                        {activeHighlight.note ? 'Edit note' : 'Add note'}
                      </Button>
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                        onClick={() => {
                          void deleteHighlight(activeHighlight.id);
                          setHighlightMenu(null);
                        }}
                      >
                        Delete highlight
                      </button>
                      <button type="button" className="rounded px-2 py-1 text-xs transition-colors hover:bg-slate-100" onClick={() => setHighlightMenu(null)}>
                        Close
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null}
          {highlightEditor ? (
            <div
              data-flow-highlight-popover="true"
              className="absolute z-20 w-[280px] rounded-md border p-3 shadow-lg"
              style={{
                left: `${highlightEditor.x}px`,
                top: `${highlightEditor.y}px`,
                backgroundColor: palette.panelBg,
                borderColor: palette.chromeBorder,
                color: palette.chromeText
              }}
            >
              {(() => {
                const activeHighlight = highlightById.get(highlightEditor.highlightId) ?? null;
                if (!activeHighlight) {
                  return <p className="text-xs" style={{ color: palette.mutedText }}>Highlight not found.</p>;
                }
                return (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: palette.mutedText }}>Highlight</p>
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
                        style={getReaderButtonStyles(settings)}
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
        </div>
      </ReaderShell>
      <ExportDialog
        open={exportState.exportDialogOpen}
        loading={exportState.exportLoading}
        format={exportState.exportFormat}
        preview={exportState.exportPreview}
        error={exportState.exportError}
        message={exportState.exportMessage}
        onFormatChange={exportState.setExportFormat}
        onCopy={() => {
          void exportState.copyExportContent();
        }}
        onSave={() => {
          void exportState.saveExportContent();
        }}
        onClose={exportState.closeExportDialog}
      />
    </>
  );
}
