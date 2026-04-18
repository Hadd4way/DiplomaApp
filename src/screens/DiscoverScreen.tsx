import * as React from 'react';
import { BookOpenText, Compass, Download, Globe, LoaderCircle, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Book, DiscoverBookResult } from '../../shared/ipc';

type Props = {
  books: Book[];
  onBack: () => void;
  onLibraryChanged: () => Promise<void> | void;
};

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

function getDuplicateKey(title: string, author: string | null, format: Book['format'] | null) {
  return `${normalizeDuplicateValue(title)}::${normalizeDuplicateValue(author)}::${format ?? 'unknown'}`;
}

function getPreferredImportFormat(result: DiscoverBookResult): Book['format'] | null {
  if (result.formats.some((format) => format.kind === 'epub')) {
    return 'epub';
  }
  if (result.formats.some((format) => format.kind === 'txt' || format.kind === 'html')) {
    return 'txt';
  }
  return null;
}

function getFormatBadgeLabel(kind: DiscoverBookResult['formats'][number]['kind']) {
  return kind === 'txt' ? 'TXT' : kind === 'html' ? 'HTML' : kind.toUpperCase();
}

export function DiscoverScreen({ books, onBack, onLibraryChanged }: Props) {
  const [query, setQuery] = React.useState('');
  const [language, setLanguage] = React.useState('');
  const [results, setResults] = React.useState<DiscoverBookResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [downloadId, setDownloadId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);

  const duplicateKeys = React.useMemo(
    () =>
      new Set(
        books.map((book) => getDuplicateKey(book.title, book.author ?? null, book.format))
      ),
    [books]
  );

  const runSearch = React.useCallback(async () => {
    const trimmedQuery = query.trim();
    setHasSearched(true);
    setError(null);
    setWarning(null);
    setSuccess(null);

    if (!trimmedQuery) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const api = getRendererApi();
      const response = await api.discover.search({
        query: trimmedQuery,
        language: language.trim() || undefined
      });
      if (!response.ok) {
        setError(response.error);
        setResults([]);
        return;
      }

      setResults(response.results);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [language, query]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runSearch();
  };

  const onDownload = async (result: DiscoverBookResult) => {
    setDownloadId(result.id);
    setError(null);
    setWarning(null);
    setSuccess(null);

    try {
      const api = getRendererApi();
      const response = await api.discover.download({ result });
      if (!response.ok) {
        setError(response.error);
        return;
      }

      await Promise.resolve(onLibraryChanged());
      if (response.duplicateWarning) {
        setWarning(response.duplicateWarning);
      }
      setSuccess(`Added "${response.book.title}" to your library.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloadId(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      <Card className="overflow-hidden border-white/50 bg-[linear-gradient(135deg,rgba(255,247,237,0.95)_0%,rgba(255,255,255,0.98)_45%,rgba(240,249,255,0.95)_100%)] shadow-sm">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-background/80 shadow-sm">
                <Compass className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight">Discover Books</h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Search free books from Project Gutenberg and import them into your local library.
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
              Source: Project Gutenberg
            </div>
          </form>
        </CardContent>
      </Card>

      {success ? (
        <Alert>
          <AlertTitle>Book imported</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}

      {warning ? (
        <Alert>
          <AlertTitle>Possible duplicate</AlertTitle>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ) : null}

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
              <h2 className="text-xl font-semibold tracking-tight">Search free books from Project Gutenberg</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Find public-domain EPUB, TXT, and HTML downloads, then add them to your local library.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card className="border-dashed bg-card/80">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Searching Project Gutenberg...</p>
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card className="border-dashed bg-card/80">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm font-medium">No Project Gutenberg books matched that search.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Try a broader title, another author spelling, or a different language code.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {results.map((result) => {
            const preferredImportFormat = getPreferredImportFormat(result);
            const isDuplicate = duplicateKeys.has(
              getDuplicateKey(result.title, result.author, preferredImportFormat)
            );
            const isDownloading = downloadId === result.id;

            return (
              <li key={result.id} className="h-full">
                <Card className="flex h-full flex-col overflow-hidden border-white/50 bg-card/95 shadow-sm">
                  <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex gap-4">
                      <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted/30">
                        {result.coverUrl ? (
                          <img
                            src={result.coverUrl}
                            alt={`${result.title} cover`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Compass className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Project Gutenberg
                            </span>
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
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {result.author || 'Unknown author'}
                          </p>
                        </div>

                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>Languages: {result.languages.length > 0 ? result.languages.join(', ') : 'Unknown'}</p>
                          <p>
                            Downloads: {typeof result.downloadCount === 'number' ? result.downloadCount.toLocaleString() : 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {isDuplicate ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        A book with the same title, author, and preferred format is already in your library. You can still import it.
                      </div>
                    ) : null}

                    <div className="mt-auto flex flex-wrap items-center gap-2">
                      <Button type="button" onClick={() => void onDownload(result)} disabled={isDownloading}>
                        {isDownloading ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        {isDownloading ? 'Downloading...' : 'Download'}
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
  );
}
