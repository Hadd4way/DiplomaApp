import * as React from 'react';
import { BookOpen, BookOpenText, Download, Globe, LoaderCircle, Search, Sparkles } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScreenEmptyState, ScreenErrorState, ScreenLoadingState } from '@/components/ScreenState';
import { SkeletonGrid } from '@/components/Skeletons';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { DISCOVER_PROVIDER_LABELS, FORMAT_BADGE_LABELS, LIST_BATCH_SIZE } from '@/lib/constants';
import { getReaderHeroCardStyles } from '@/lib/reader-theme';
import { SimpleCache } from '@/lib/simple-cache';
import { useIncrementalList } from '@/lib/useIncrementalList';
import { cn } from '@/lib/utils';
import type {
  Book,
  DiscoverBookResult,
  DiscoverDownloadProgressEvent,
  DiscoverSourceFilter
} from '../../shared/ipc';

type Props = {
  books: Book[];
  onBack: () => void;
  onLibraryChanged: () => Promise<void> | void;
  onOpenBook: (book: Book) => Promise<void> | void;
  initialQuery?: string | null;
  initialSearchToken?: number;
};

type DownloadCardState = {
  state: 'idle' | 'downloading' | 'importing' | 'completed' | 'failed';
  progressPercent: number | null;
  message: string | null;
  importedBook: Book | null;
  error: string | null;
};

type DuplicatePromptState = {
  result: DiscoverBookResult;
  existingBook: Book;
} | null;

const discoverSearchCache = new SimpleCache<string, DiscoverBookResult[]>(5 * 60 * 1000, 30);

function getRendererApi() {
  if (!window.api) {
    throw new Error('Renderer API is unavailable. Open this app via Electron.');
  }

  return window.api;
}

function normalizeDuplicateValue(value: string | null | undefined) {
  return (value ?? '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDuplicateKey(title: string, author: string | null) {
  return `${normalizeDuplicateValue(title)}::${normalizeDuplicateValue(author)}`;
}

function getFormatBadgeLabel(kind: DiscoverBookResult['formats'][number]['kind']) {
  return FORMAT_BADGE_LABELS[kind as keyof typeof FORMAT_BADGE_LABELS] ?? kind.toUpperCase();
}

function getSourceLabel(source: DiscoverBookResult['source']) {
  return DISCOVER_PROVIDER_LABELS[source];
}

function getEditionBadgeLabel(result: DiscoverBookResult, t: ReturnType<typeof useLanguage>['t']) {
  return result.source === 'standardebooks' ? t.discover.curatedEdition : null;
}

function getSourceDescription(sourceFilter: DiscoverSourceFilter, t: ReturnType<typeof useLanguage>['t']) {
  if (sourceFilter === 'standardebooks') {
    return t.discover.sourceStandardEbooks;
  }
  if (sourceFilter === 'gutenberg') {
    return t.discover.sourceGutenberg;
  }
  return t.discover.sourceAll;
}

function getSearchLoadingLabel(sourceFilter: DiscoverSourceFilter, t: ReturnType<typeof useLanguage>['t']) {
  if (sourceFilter === 'standardebooks') {
    return t.discover.searchLoadingStandardEbooks;
  }
  if (sourceFilter === 'gutenberg') {
    return t.discover.searchLoadingGutenberg;
  }
  return t.discover.searchLoadingAll;
}

function getEmptyStateTitle(sourceFilter: DiscoverSourceFilter, t: ReturnType<typeof useLanguage>['t']) {
  if (sourceFilter === 'standardebooks') {
    return t.discover.emptyStandardEbooks;
  }
  if (sourceFilter === 'gutenberg') {
    return t.discover.emptyGutenberg;
  }
  return t.discover.emptyAll;
}

function getFriendlyDiscoverError(error: string, t: ReturnType<typeof useLanguage>['t']) {
  const normalized = error.toLocaleLowerCase();
  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('failed to fetch')) {
    return t.discover.networkIssue;
  }
  if (normalized.includes('supported downloadable format') || normalized.includes('not supported')) {
    return t.discover.unsupportedFormat;
  }
  if (normalized.includes('failed to save imported book metadata') || normalized.includes('failed to copy') || normalized.includes('import')) {
    return t.discover.importFailed;
  }
  return error;
}

function getInitials(title: string) {
  return title
    .split(/\s+/)
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getPlaceholderPalette(seed: string) {
  const value = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0);
  const palettes = [
    ['from-amber-200 via-orange-100 to-rose-100', 'bg-amber-950/80', 'text-amber-950'],
    ['from-sky-200 via-cyan-100 to-blue-100', 'bg-sky-950/80', 'text-sky-950'],
    ['from-emerald-200 via-lime-100 to-teal-100', 'bg-emerald-950/80', 'text-emerald-950'],
    ['from-fuchsia-200 via-pink-100 to-rose-100', 'bg-fuchsia-950/80', 'text-fuchsia-950']
  ] as const;

  return palettes[value % palettes.length];
}

function PlaceholderCover({
  title,
  author,
  fallbackAuthor
}: {
  title: string;
  author: string | null;
  fallbackAuthor: string;
}) {
  const [gradient, badgeBackground, textColor] = getPlaceholderPalette(`${title}:${author ?? ''}`);
  const initials = getInitials(title);

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-gradient-to-br', gradient)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_45%)]" />
      <div className="relative flex h-full flex-col justify-between p-3">
        <div className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm', badgeBackground)}>
          {initials || 'BK'}
        </div>
        <div className="space-y-1">
          <p className={cn('line-clamp-3 text-xs font-semibold leading-4', textColor)}>{title}</p>
          <p className="line-clamp-2 text-[11px] text-black/60">{author || fallbackAuthor}</p>
        </div>
      </div>
    </div>
  );
}

function getProgressLabel(downloadState: DownloadCardState, t: ReturnType<typeof useLanguage>['t']) {
  if (downloadState.state === 'downloading') {
    return downloadState.progressPercent !== null
      ? `${t.discover.downloading} ${downloadState.progressPercent}%`
      : t.discover.downloading;
  }
  if (downloadState.state === 'importing') {
    return t.discover.importing;
  }
  if (downloadState.state === 'completed') {
    return t.discover.downloadedSuccessfully;
  }
  if (downloadState.state === 'failed') {
    return downloadState.error ?? t.discover.downloadFailed;
  }
  return t.discover.readyToDownload;
}

function createIdleState(): DownloadCardState {
  return {
    state: 'idle',
    progressPercent: null,
    message: null,
    importedBook: null,
    error: null
  };
}

type DiscoverResultCardProps = {
  result: DiscoverBookResult;
  downloadState: DownloadCardState;
  likelyDuplicate: boolean;
  t: ReturnType<typeof useLanguage>['t'];
  onRequestDownload: (result: DiscoverBookResult) => void;
  onOpenBook: (book: Book) => Promise<void> | void;
  onBack: () => void;
};

const DiscoverResultCard = React.memo(function DiscoverResultCard({
  result,
  downloadState,
  likelyDuplicate,
  t,
  onRequestDownload,
  onOpenBook,
  onBack
}: DiscoverResultCardProps) {
  const isBusy = downloadState.state === 'downloading' || downloadState.state === 'importing';
  const importedBook = downloadState.importedBook;

  return (
    <Card className="flex h-full flex-col overflow-hidden border-white/50 bg-card/95 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex gap-4">
          <div className="flex h-36 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted/30 shadow-sm">
            {result.coverUrl ? (
              <img src={result.coverUrl} alt={`${result.title} ${t.discover.coverAlt}`} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <PlaceholderCover title={result.title} author={result.author} fallbackAuthor={t.discover.unknownAuthor} />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {getSourceLabel(result.source)}
                </span>
                {getEditionBadgeLabel(result, t) ? (
                  <span className="inline-flex rounded-full border border-amber-300/80 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                    {getEditionBadgeLabel(result, t)}
                  </span>
                ) : null}
                {result.formats.map((format) => (
                  <span
                    key={`${result.id}:${format.mimeType}:${format.url}`}
                    className="inline-flex rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    {getFormatBadgeLabel(format.kind)}
                  </span>
                ))}
              </div>
              <h2 className="line-clamp-2 text-lg font-semibold tracking-tight">{result.title}</h2>
              {result.subtitle ? <p className="line-clamp-2 text-sm text-muted-foreground">{result.subtitle}</p> : null}
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {[result.author || t.discover.unknownAuthor, result.publishYear ? String(result.publishYear) : null]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            </div>

            {result.description ? <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{result.description}</p> : null}

            <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
              <p>{t.discover.language}: {result.languages.length > 0 ? result.languages.join(', ') : t.discover.unknown}</p>
              <p>{t.discover.source}: {getSourceLabel(result.source)}</p>
              <p>{t.discover.year}: {result.publishYear ?? t.discover.unknown}</p>
              <p>{t.discover.format}: {result.formats.map((format) => getFormatBadgeLabel(format.kind)).join(', ')}</p>
              <p>
                {result.source === 'standardebooks'
                  ? t.discover.editionLabel
                  : `${t.discover.downloads}: ${typeof result.downloadCount === 'number' ? result.downloadCount.toLocaleString() : t.discover.unknown}`}
              </p>
            </div>
          </div>
        </div>

        {likelyDuplicate ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t.discover.sameTitleAuthorExists}
          </div>
        ) : null}

        {downloadState.state === 'downloading' || downloadState.state === 'importing' ? (
          <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{getProgressLabel(downloadState, t)}</span>
              {downloadState.progressPercent !== null ? <span className="text-muted-foreground">{downloadState.progressPercent}%</span> : null}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-background/80">
              <div
                className={cn('h-full rounded-full transition-[width]', downloadState.state === 'importing' ? 'bg-emerald-500' : 'bg-primary')}
                style={{ width: `${Math.max(8, Math.min(100, downloadState.progressPercent ?? (downloadState.state === 'importing' ? 100 : 12)))}%` }}
              />
            </div>
          </div>
        ) : null}

        {downloadState.state === 'completed' && importedBook ? (
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
            <div>
              <p className="font-medium text-emerald-950">{t.discover.downloadedSuccessfully}</p>
              <p className="text-sm text-emerald-900/80">{t.discover.localLibraryDescription}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void onOpenBook(importedBook)}>
                <BookOpen className="h-4 w-4" />
                {t.discover.openNow}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onBack}>
                {t.discover.showInLibrary}
              </Button>
            </div>
          </div>
        ) : null}

        {downloadState.state === 'failed' ? (
          <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3">
            <div>
              <p className="font-medium text-rose-950">{t.discover.downloadFailed}</p>
              <p className="text-sm text-rose-900/80">{downloadState.error ?? t.discover.tryAgain}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => onRequestDownload(result)}>
                {t.discover.retry}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => onRequestDownload(result)} disabled={isBusy || downloadState.state === 'completed'}>
            {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloadState.state === 'completed'
              ? t.discover.downloaded
              : downloadState.state === 'importing'
                ? t.discover.importing
                : downloadState.state === 'downloading'
                  ? t.discover.downloading
                  : t.discover.download}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

export function DiscoverScreen({
  books,
  onBack,
  onLibraryChanged,
  onOpenBook,
  initialQuery = null,
  initialSearchToken
}: Props) {
  const { t } = useLanguage();
  const { settings } = useReaderSettings();
  const [query, setQuery] = React.useState('');
  const [language, setLanguage] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState<DiscoverSourceFilter>('all');
  const [results, setResults] = React.useState<DiscoverBookResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [downloadStates, setDownloadStates] = React.useState<Record<string, DownloadCardState>>({});
  const [duplicatePrompt, setDuplicatePrompt] = React.useState<DuplicatePromptState>(null);
  const lastInitialSearchKeyRef = React.useRef<string | null>(null);

  const sourceOptions = React.useMemo(
    () =>
      ([
        ['all', t.discover.allSources],
        ['gutenberg', t.discover.gutenberg],
        ['standardebooks', t.discover.standardEbooks]
      ] as Array<[DiscoverSourceFilter, string]>),
    [t]
  );

  const duplicateMap = React.useMemo(() => {
    const map = new Map<string, Book>();
    for (const book of books) {
      const key = getDuplicateKey(book.title, book.author ?? null);
      if (!map.has(key)) {
        map.set(key, book);
      }
    }
    return map;
  }, [books]);

  React.useEffect(() => {
    const api = getRendererApi();
    return api.discover.onDownloadProgress((event: DiscoverDownloadProgressEvent) => {
      setDownloadStates((current) => {
        const previous = current[event.resultId] ?? createIdleState();
        return {
          ...current,
          [event.resultId]: {
            ...previous,
            state: event.state,
            progressPercent: event.progressPercent,
            message: event.message,
            error: event.state === 'failed' ? getFriendlyDiscoverError(event.message ?? t.discover.downloadFailed, t) : null
          }
        };
      });
    });
  }, [t]);

  const runSearch = React.useCallback(
    async (override?: { query?: string; language?: string }) => {
      const searchQuery = override?.query ?? query;
      const searchLanguage = override?.language ?? language;
      const trimmedQuery = searchQuery.trim();
      const normalizedLanguage = searchLanguage.trim() || undefined;
      setHasSearched(true);
      setError(null);

      if (!trimmedQuery) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const cacheKey = JSON.stringify({
          query: trimmedQuery.toLocaleLowerCase(),
          source: sourceFilter,
          language: normalizedLanguage?.toLocaleLowerCase() ?? ''
        });
        const cachedResults = discoverSearchCache.get(cacheKey);
        const response = cachedResults
          ? { ok: true as const, results: cachedResults }
          : await getRendererApi().discover.search({
              query: trimmedQuery,
              source: sourceFilter,
              language: normalizedLanguage
            });

        if (!response.ok) {
          setError(getFriendlyDiscoverError(response.error, t));
          setResults([]);
          return;
        }

        discoverSearchCache.set(cacheKey, response.results);
        setResults(response.results);
        setDownloadStates({});
      } catch (err) {
        setResults([]);
        setError(getFriendlyDiscoverError(err instanceof Error ? err.message : String(err), t));
      } finally {
        setLoading(false);
      }
    },
    [language, query, sourceFilter, t]
  );

  React.useEffect(() => {
    const trimmedInitialQuery = initialQuery?.trim();
    if (!trimmedInitialQuery) {
      return;
    }

    const searchKey = `${initialSearchToken ?? 'default'}::${trimmedInitialQuery}`;
    if (lastInitialSearchKeyRef.current === searchKey) {
      return;
    }

    lastInitialSearchKeyRef.current = searchKey;
    setQuery(trimmedInitialQuery);
    void runSearch({ query: trimmedInitialQuery });
  }, [initialQuery, initialSearchToken, runSearch]);

  const performDownload = React.useCallback(
    async (result: DiscoverBookResult) => {
      setDownloadStates((current) => ({
        ...current,
        [result.id]: {
          ...createIdleState(),
          state: 'downloading',
          progressPercent: 0,
          message: t.discover.startingDownload
        }
      }));

      try {
        const response = await getRendererApi().discover.download({ result });
        if (!response.ok) {
          setDownloadStates((current) => ({
            ...current,
            [result.id]: {
              ...(current[result.id] ?? createIdleState()),
              state: 'failed',
              error: getFriendlyDiscoverError(response.error, t),
              message: getFriendlyDiscoverError(response.error, t)
            }
          }));
          return;
        }

        await Promise.resolve(onLibraryChanged());
        setDownloadStates((current) => ({
          ...current,
          [result.id]: {
            ...(current[result.id] ?? createIdleState()),
            state: 'completed',
            progressPercent: 100,
            importedBook: response.book,
            message: t.discover.downloadedSuccessfully,
            error: null
          }
        }));
      } catch (err) {
        const friendlyError = getFriendlyDiscoverError(err instanceof Error ? err.message : String(err), t);
        setDownloadStates((current) => ({
          ...current,
          [result.id]: {
            ...(current[result.id] ?? createIdleState()),
            state: 'failed',
            error: friendlyError,
            message: friendlyError
          }
        }));
      }
    },
    [onLibraryChanged, t]
  );

  const requestDownload = React.useCallback(
    async (result: DiscoverBookResult) => {
      const duplicate = duplicateMap.get(getDuplicateKey(result.title, result.author));
      if (duplicate) {
        setDuplicatePrompt({ result, existingBook: duplicate });
        return;
      }

      await performDownload(result);
    },
    [duplicateMap, performDownload]
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runSearch();
  };

  const { visibleItems: visibleResults, hasMore, showMore } = useIncrementalList(results, LIST_BATCH_SIZE.discover);

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden pr-1">
      <Card className="shrink-0 overflow-hidden shadow-sm" style={getReaderHeroCardStyles(settings)}>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-background/80 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight">{t.discover.title}</h1>
                <p className="max-w-2xl text-sm text-muted-foreground">{t.discover.subtitle}</p>
              </div>
            </div>

            <Button type="button" variant="outline" onClick={onBack}>
              {t.discover.backToLibrary}
            </Button>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-3 xl:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.discover.searchPlaceholder}
                  className="pl-9"
                  aria-label={t.discover.searchPlaceholder}
                />
              </div>

              <Input
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                placeholder={t.discover.languagePlaceholder}
                className="xl:max-w-60"
                aria-label={t.discover.languagePlaceholder}
              />

              <Button type="submit" disabled={loading}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {t.discover.search}
              </Button>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5" />
              {getSourceDescription(sourceFilter, t)}
            </div>

            <div className="flex flex-wrap gap-2">
              {sourceOptions.map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={sourceFilter === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSourceFilter(value)}
                  className={cn(sourceFilter === value ? '' : 'bg-background/70')}
                >
                  {label}
                </Button>
              ))}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <div className="space-y-6">
          {error ? <ScreenErrorState title={t.discover.discoverErrorTitle} description={error} onRetry={() => void runSearch()} /> : null}

          {!hasSearched ? (
            <ScreenEmptyState
              title={t.discover.introTitle}
              description={t.discover.introDescription}
              icon={<BookOpenText className="h-6 w-6 text-muted-foreground" />}
            />
          ) : loading ? (
            <div className="space-y-4">
              <ScreenLoadingState label={getSearchLoadingLabel(sourceFilter, t)} />
              <SkeletonGrid count={6} />
            </div>
          ) : results.length === 0 ? (
            <ScreenEmptyState
              title={getEmptyStateTitle(sourceFilter, t)}
              description={t.discover.emptyDescription}
              icon={<Search className="h-6 w-6 text-muted-foreground" />}
            />
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {visibleResults.map((result) => (
                  <li key={result.id} className="h-full">
                    <DiscoverResultCard
                      result={result}
                      downloadState={downloadStates[result.id] ?? createIdleState()}
                      likelyDuplicate={duplicateMap.has(getDuplicateKey(result.title, result.author))}
                      t={t}
                      onRequestDownload={(item) => {
                        void requestDownload(item);
                      }}
                      onOpenBook={onOpenBook}
                      onBack={onBack}
                    />
                  </li>
                ))}
              </ul>
              {hasMore ? (
                <div className="flex justify-center pt-2">
                  <Button type="button" variant="outline" onClick={showMore}>
                    Show more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(duplicatePrompt)} onOpenChange={(open) => !open && setDuplicatePrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.discover.duplicateTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.discover.duplicateDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.discover.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-background text-foreground hover:bg-muted"
              onClick={() => {
                if (!duplicatePrompt) {
                  return;
                }
                void onOpenBook(duplicatePrompt.existingBook);
                setDuplicatePrompt(null);
              }}
            >
              {t.discover.openExisting}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                if (!duplicatePrompt) {
                  return;
                }
                const result = duplicatePrompt.result;
                setDuplicatePrompt(null);
                void performDownload(result);
              }}
            >
              {t.discover.importAnyway}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
