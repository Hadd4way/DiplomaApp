import * as React from 'react';
import { ChevronLeft, ListTree, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReaderSettingsPanel } from '@/components/ReaderSettingsPanel';
import { SearchPanel, type ReaderSearchResultItem } from '@/components/reader/SearchPanel';
import { ReaderShell } from '@/components/reader/ReaderShell';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { parseFb2Document, type Fb2Document } from '@/lib/fb2';
import {
  getEffectiveEpubFontFamily,
  getEpubThemeBodyStyles,
  getReaderButtonStyles,
  getReaderTextScaleMultiplier,
  getReaderThemePalette
} from '@/lib/reader-theme';
import { useReadingSessionStats } from '@/lib/reading-stats';
import { useFlowSearch } from '@/lib/useFlowSearch';

type Props = {
  title: string;
  bookId: string;
  loading: boolean;
  onBack: () => void;
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

export function Fb2ReaderScreen({ title, bookId, loading, onBack }: Props) {
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const chapterRefs = React.useRef<Array<HTMLElement | null>>([]);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreDoneRef = React.useRef(false);
  const searchFlashTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [documentData, setDocumentData] = React.useState<Fb2Document | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [searchPanelOpen, setSearchPanelOpen] = React.useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = React.useState(false);
  const [activeChapterIndex, setActiveChapterIndex] = React.useState(0);
  const [savedProgress, setSavedProgress] = React.useState<{ chapterIndex: number | null; scrollRatio: number | null }>({
    chapterIndex: null,
    scrollRatio: null
  });
  const [activeSearchIndex, setActiveSearchIndex] = React.useState(-1);
  const { settings, updateSettings } = useReaderSettings();
  const palette = React.useMemo(() => getReaderThemePalette(settings), [settings]);
  const bodyStyles = React.useMemo(() => getEpubThemeBodyStyles(settings), [settings]);
  const fontStack = React.useMemo(() => getEffectiveEpubFontFamily(settings), [settings]);
  const effectiveFontSize = React.useMemo(
    () => `${Math.round(settings.epubFontSize * getReaderTextScaleMultiplier(settings.textSizePreset))}%`,
    [settings.epubFontSize, settings.textSizePreset]
  );
  const { registerActivity } = useReadingSessionStats({
    bookId,
    format: 'fb2',
    rootRef: scrollContainerRef
  });

  const searchBlocks = documentData?.searchBlocks ?? [];
  const {
    query: searchQuery,
    results: searchResults,
    isSearching,
    setQuery: setSearchQuery
  } = useFlowSearch(searchBlocks, bookId);

  const searchPanelResults = React.useMemo<ReaderSearchResultItem[]>(
    () =>
      searchResults.map((result) => ({
        id: result.id,
        excerpt: result.excerpt,
        start: result.start,
        end: result.end,
        locationLabel: `Chapter ${result.chapterIndex + 1}`,
        chapterLabel: result.chapterLabel
      })),
    [searchResults]
  );

  const displayTitle = documentData?.title || title;
  const currentChapter = documentData?.chapters[activeChapterIndex] ?? null;

  const persistProgress = React.useCallback(
    (chapterIndex: number, scrollRatio: number) => {
      if (!window.api?.flowProgress) {
        return;
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        void window.api.flowProgress
          .set({
            bookId,
            chapterIndex: Math.max(0, chapterIndex),
            scrollRatio: clampRatio(scrollRatio)
          })
          .catch(() => undefined);
      }, 250);
    },
    [bookId]
  );

  const scrollToChapter = React.useCallback((chapterIndex: number) => {
    const container = scrollContainerRef.current;
    const target = chapterRefs.current[chapterIndex];
    if (!container || !target) {
      return;
    }
    container.scrollTo({
      top: Math.max(0, target.offsetTop - 20),
      behavior: 'smooth'
    });
    setActiveChapterIndex(chapterIndex);
  }, []);

  const flashSearchTarget = React.useCallback((element: HTMLElement) => {
    element.dataset.searchActive = 'true';
    if (searchFlashTimerRef.current) {
      clearTimeout(searchFlashTimerRef.current);
    }
    searchFlashTimerRef.current = setTimeout(() => {
      delete element.dataset.searchActive;
    }, 1400);
  }, []);

  const navigateToSearchIndex = React.useCallback(
    (index: number) => {
      const result = searchResults[index];
      const container = scrollContainerRef.current;
      if (!result || !container) {
        return;
      }
      setActiveSearchIndex(index);
      const target = container.querySelector(`[data-fb2-block-id="${result.blockId}"]`);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        flashSearchTarget(target);
      } else {
        scrollToChapter(result.chapterIndex);
      }
    },
    [flashSearchTarget, scrollToChapter, searchResults]
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

  React.useEffect(() => {
    let canceled = false;

    const load = async () => {
      if (!window.api) {
        setError('Renderer API is unavailable. Open this app via Electron.');
        return;
      }

      setReady(false);
      setError(null);
      restoreDoneRef.current = false;
      setActiveSearchIndex(-1);

      try {
        const [fb2Result, progressResult] = await Promise.all([
          window.api.books.getFb2Data({ bookId }),
          window.api.flowProgress.get({ bookId })
        ]);

        if (canceled) {
          return;
        }
        if (!fb2Result.ok) {
          setError(fb2Result.error);
          return;
        }
        if (!progressResult.ok) {
          setSavedProgress({ chapterIndex: null, scrollRatio: null });
        } else {
          setSavedProgress(progressResult.progress);
        }

        const parsed = parseFb2Document(fb2Result.content);
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
  }, [bookId]);

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
    const container = scrollContainerRef.current;
    if (!container || !documentData) {
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

      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const ratio = maxScroll > 0 ? container.scrollTop / maxScroll : 0;
      setActiveChapterIndex(nextChapterIndex);
      persistProgress(nextChapterIndex, ratio);
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [documentData, persistProgress, registerActivity]);

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (searchFlashTimerRef.current) {
        clearTimeout(searchFlashTimerRef.current);
      }
    };
  }, []);

  const headerStatus = (
    <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: palette.mutedText }}>
      <span>{documentData?.author || 'Author unavailable'}</span>
      <span>•</span>
      <span>{documentData ? `${activeChapterIndex + 1} / ${documentData.chapters.length} chapters` : 'Loading FB2...'}</span>
      {currentChapter ? (
        <>
          <span>•</span>
          <span className="truncate">{currentChapter.title}</span>
        </>
      ) : null}
    </div>
  );

  const leftPanel = sidebarOpen && documentData ? (
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
              onClick={() => scrollToChapter(index)}
            >
              {chapter.title}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <ReaderShell
      title={displayTitle}
      settings={settings}
      leftPanel={leftPanel}
      leftPanelWidthClassName="w-[280px]"
      headerLeft={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onBack} style={getReaderButtonStyles(settings)}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSidebarOpen((current) => !current)}
            style={getReaderButtonStyles(settings, sidebarOpen)}
          >
            <ListTree className="h-4 w-4" />
          </Button>
        </>
      }
      headerRight={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSearchPanelOpen(true)}
            style={getReaderButtonStyles(settings, searchPanelOpen)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSettingsPanelOpen(true)}
            style={getReaderButtonStyles(settings, settingsPanelOpen)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </>
      }
      headerStatus={headerStatus}
    >
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <div
          ref={scrollContainerRef}
          className="fb2-reader-scroll h-full w-full overflow-y-auto px-5 py-6 md:px-8"
          style={{
            backgroundColor: palette.readerSurface,
            color: bodyStyles.color
          }}
        >
          {error ? (
            <div className="mx-auto max-w-3xl rounded-2xl border px-5 py-4" style={{ borderColor: palette.chromeBorder }}>
              <p className="text-sm font-semibold">Unable to open FB2</p>
              <p className="mt-2 text-sm" style={{ color: palette.mutedText }}>{error}</p>
            </div>
          ) : null}

          {!error && !ready ? (
            <div className="mx-auto max-w-3xl rounded-2xl border px-5 py-4" style={{ borderColor: palette.chromeBorder }}>
              <p className="text-sm">{loading ? 'Loading FB2…' : 'Preparing FB2 document…'}</p>
            </div>
          ) : null}

          {!error && ready && documentData ? (
            <article
              className="fb2-reader-article mx-auto max-w-3xl rounded-[28px] border px-6 py-8 shadow-sm md:px-10"
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
            >
              {documentData.coverImage ? (
                <div className="mb-8 flex justify-center">
                  <img
                    src={documentData.coverImage}
                    alt=""
                    className="max-h-80 rounded-2xl border object-contain shadow-sm"
                    style={{ borderColor: palette.chromeBorder }}
                  />
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
                >
                  <h1 className="fb2-chapter-title">{chapter.title}</h1>
                  <div dangerouslySetInnerHTML={{ __html: chapter.html }} />
                </section>
              ))}
            </article>
          ) : null}
        </div>

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
          placeholder="Search in FB2 book"
          emptyQueryMessage="Type a word or phrase to search this FB2 book."
        />

        <ReaderSettingsPanel
          open={settingsPanelOpen}
          format="fb2"
          settings={settings}
          onClose={() => setSettingsPanelOpen(false)}
          onChange={updateSettings}
          palette={palette}
        />
      </div>
    </ReaderShell>
  );
}
