import * as React from 'react';
import { BookOpen, BookOpenText, Compass, Download, Globe, LoaderCircle, Search, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Input } from '@/components/ui/input';
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
  return kind === 'txt' ? 'TXT' : kind === 'html' ? 'HTML' : kind.toUpperCase();
}

function getSourceLabel(source: DiscoverBookResult['source']) {
  return source === 'standardebooks' ? 'Standard Ebooks' : 'Project Gutenberg';
}

function getPremiumBadgeLabel(result: DiscoverBookResult) {
  return result.source === 'standardebooks' ? 'Curated Edition' : null;
}

function getSourceDescription(sourceFilter: DiscoverSourceFilter) {
  if (sourceFilter === 'standardebooks') {
    return 'Source: Standard Ebooks';
  }
  if (sourceFilter === 'gutenberg') {
    return 'Source: Project Gutenberg';
  }
  return 'Source: All Sources';
}

function getSearchLoadingLabel(sourceFilter: DiscoverSourceFilter) {
  if (sourceFilter === 'standardebooks') {
    return 'Searching Standard Ebooks...';
  }
  if (sourceFilter === 'gutenberg') {
    return 'Searching Project Gutenberg...';
  }
  return 'Searching all sources...';
}

function getEmptyStateTitle(sourceFilter: DiscoverSourceFilter) {
  if (sourceFilter === 'standardebooks') {
    return 'No Standard Ebooks titles matched that search.';
  }
  if (sourceFilter === 'gutenberg') {
    return 'No Project Gutenberg books matched that search.';
  }
  return 'No books matched that search across Standard Ebooks or Project Gutenberg.';
}

function getFriendlyDiscoverError(error: string) {
  const normalized = error.toLocaleLowerCase();
  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('failed to fetch')) {
    return 'Network issue. Check your connection and try again.';
  }
  if (normalized.includes('supported downloadable format') || normalized.includes('not supported')) {
    return 'This edition does not have a format we can import yet.';
  }
  if (normalized.includes('failed to save imported book metadata') || normalized.includes('failed to copy') || normalized.includes('import')) {
    return 'Import failed while adding the book to your local library. Please retry.';
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

function PlaceholderCover({ title, author }: { title: string; author: string | null }) {
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
          <p className="line-clamp-2 text-[11px] text-black/60">{author || 'Unknown author'}</p>
        </div>
      </div>
    </div>
  );
}

function getProgressLabel(downloadState: DownloadCardState) {
  if (downloadState.state === 'downloading') {
    return downloadState.progressPercent !== null
      ? `Downloading... ${downloadState.progressPercent}%`
      : 'Downloading...';
  }

  if (downloadState.state === 'importing') {
    return 'Importing into your local library...';
  }

  if (downloadState.state === 'completed') {
    return 'Downloaded successfully';
  }

  if (downloadState.state === 'failed') {
    return downloadState.error ?? 'Download failed';
  }

  return 'Ready to download';
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

export function DiscoverScreen({ books, onBack, onLibraryChanged, onOpenBook }: Props) {
  const [query, setQuery] = React.useState('');
  const [language, setLanguage] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState<DiscoverSourceFilter>('all');
  const [results, setResults] = React.useState<DiscoverBookResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [downloadStates, setDownloadStates] = React.useState<Record<string, DownloadCardState>>({});
  const [duplicatePrompt, setDuplicatePrompt] = React.useState<DuplicatePromptState>(null);

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
            error: event.state === 'failed' ? getFriendlyDiscoverError(event.message ?? 'Download failed.') : null
          }
        };
      });
    });
  }, []);

  const runSearch = React.useCallback(async () => {
    const trimmedQuery = query.trim();
    setHasSearched(true);
    setError(null);

    if (!trimmedQuery) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const api = getRendererApi();
      const response = await api.discover.search({
        query: trimmedQuery,
        source: sourceFilter,
        language: language.trim() || undefined
      });
      if (!response.ok) {
        setError(getFriendlyDiscoverError(response.error));
        setResults([]);
        return;
      }

      setResults(response.results);
      setDownloadStates({});
    } catch (err) {
      setResults([]);
      setError(getFriendlyDiscoverError(err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [language, query, sourceFilter]);

  const performDownload = React.useCallback(
    async (result: DiscoverBookResult) => {
      setDownloadStates((current) => ({
        ...current,
        [result.id]: {
          ...createIdleState(),
          state: 'downloading',
          progressPercent: 0,
          message: 'Starting download...'
        }
      }));

      try {
        const api = getRendererApi();
        const response = await api.discover.download({ result });
        if (!response.ok) {
          setDownloadStates((current) => ({
            ...current,
            [result.id]: {
              ...(current[result.id] ?? createIdleState()),
              state: 'failed',
              error: getFriendlyDiscoverError(response.error),
              message: getFriendlyDiscoverError(response.error)
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
            message: 'Downloaded successfully',
            error: null
          }
        }));
      } catch (err) {
        const friendlyError = getFriendlyDiscoverError(err instanceof Error ? err.message : String(err));
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
    [onLibraryChanged]
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden pr-1">
      <Card className="shrink-0 overflow-hidden border-white/70 bg-[linear-gradient(135deg,rgba(255,247,237,0.98)_0%,rgba(255,255,255,0.99)_45%,rgba(240,249,255,0.98)_100%)] shadow-sm">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-background/80 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight">Discover Books</h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Search Project Gutenberg for breadth, Standard Ebooks for curated EPUBs, and bring great books into your local library.
                </p>
              </div>
            </div>

            <Button type="button" variant="outline" onClick={onBack}>
              Back to Library
            </Button>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-3 xl:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by title or author..."
                  className="pl-9"
                />
              </div>

              <Input
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                placeholder="Language code (optional, e.g. en)"
                className="xl:max-w-60"
              />

              <Button type="submit" disabled={loading}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5" />
              {getSourceDescription(sourceFilter)}
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                ['all', 'All Sources'],
                ['gutenberg', 'Gutenberg'],
                ['standardebooks', 'Standard Ebooks']
              ] as Array<[DiscoverSourceFilter, string]>).map(([value, label]) => (
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
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Discover error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {!hasSearched ? (
            <Card className="border-dashed bg-card/80">
              <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background/90 shadow-sm">
                  <BookOpenText className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold tracking-tight">Search free books from two public-domain sources</h2>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Explore Gutenberg for quantity and Standard Ebooks for polished curated editions, then download straight into your local collection.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : loading ? (
            <Card className="border-dashed bg-card/80">
              <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
                <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{getSearchLoadingLabel(sourceFilter)}</p>
              </CardContent>
            </Card>
          ) : results.length === 0 ? (
            <Card className="border-dashed bg-card/80">
              <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="text-sm font-medium">{getEmptyStateTitle(sourceFilter)}</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Try a broader title, another author spelling, or a different language code.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {results.map((result) => {
                const downloadState = downloadStates[result.id] ?? createIdleState();
                const likelyDuplicate = duplicateMap.get(getDuplicateKey(result.title, result.author));
                const isBusy = downloadState.state === 'downloading' || downloadState.state === 'importing';

                return (
                  <li key={result.id} className="h-full">
                    <Card className="flex h-full flex-col overflow-hidden border-white/50 bg-card/95 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                      <CardContent className="flex h-full flex-col gap-4 p-5">
                        <div className="flex gap-4">
                          <div className="flex h-36 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted/30 shadow-sm">
                            {result.coverUrl ? (
                              <img
                                src={result.coverUrl}
                                alt={`${result.title} cover`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <PlaceholderCover title={result.title} author={result.author} />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                  {getSourceLabel(result.source)}
                                </span>
                                {getPremiumBadgeLabel(result) ? (
                                  <span className="inline-flex rounded-full border border-amber-300/80 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                                    {getPremiumBadgeLabel(result)}
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
                              <p className="line-clamp-2 text-sm text-muted-foreground">{result.author || 'Unknown author'}</p>
                            </div>

                            {result.description ? (
                              <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">{result.description}</p>
                            ) : null}

                            <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                              <p>Language: {result.languages.length > 0 ? result.languages.join(', ') : 'Unknown'}</p>
                              <p>Source: {getSourceLabel(result.source)}</p>
                              <p>Format: {result.formats.map((format) => getFormatBadgeLabel(format.kind)).join(', ')}</p>
                              <p>
                                {result.source === 'standardebooks'
                                  ? 'Edition: Premium EPUB'
                                  : `Downloads: ${typeof result.downloadCount === 'number' ? result.downloadCount.toLocaleString() : 'Unknown'}`}
                              </p>
                            </div>
                          </div>
                        </div>

                        {likelyDuplicate ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            A local book with the same title and author already exists.
                          </div>
                        ) : null}

                        {(downloadState.state === 'downloading' || downloadState.state === 'importing') ? (
                          <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-medium">{getProgressLabel(downloadState)}</span>
                              {downloadState.progressPercent !== null ? (
                                <span className="text-muted-foreground">{downloadState.progressPercent}%</span>
                              ) : null}
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-background/80">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-[width]',
                                  downloadState.state === 'importing' ? 'bg-emerald-500' : 'bg-primary'
                                )}
                                style={{ width: `${Math.max(8, Math.min(100, downloadState.progressPercent ?? (downloadState.state === 'importing' ? 100 : 12)))}%` }}
                              />
                            </div>
                          </div>
                        ) : null}

                        {downloadState.state === 'completed' && downloadState.importedBook ? (
                          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                            <div>
                              <p className="font-medium text-emerald-950">Downloaded successfully</p>
                              <p className="text-sm text-emerald-900/80">Your book is now part of the local library.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" size="sm" onClick={() => void onOpenBook(downloadState.importedBook!)}>
                                <BookOpen className="h-4 w-4" />
                                Open Now
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={onBack}>
                                Show in Library
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {downloadState.state === 'failed' ? (
                          <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3">
                            <div>
                              <p className="font-medium text-rose-950">Download failed</p>
                              <p className="text-sm text-rose-900/80">{downloadState.error ?? 'Please try again.'}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" size="sm" onClick={() => void requestDownload(result)}>
                                Retry
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-auto flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            onClick={() => void requestDownload(result)}
                            disabled={isBusy || downloadState.state === 'completed'}
                          >
                            {isBusy ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            {downloadState.state === 'completed'
                              ? 'Downloaded'
                              : downloadState.state === 'importing'
                                ? 'Importing...'
                                : downloadState.state === 'downloading'
                                  ? 'Downloading...'
                                  : 'Download'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(duplicatePrompt)} onOpenChange={(open) => !open && setDuplicatePrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This book already exists.</AlertDialogTitle>
            <AlertDialogDescription>
              A local copy with the same title and author is already in your library. You can open the existing book, import this one anyway, or cancel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
              Open Existing
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
              Import Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
