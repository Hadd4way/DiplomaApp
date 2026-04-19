import * as React from 'react';
import { ArrowUpDown, BookMarked, Clock3, Compass, Plus, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BookCard } from '@/components/book-card';
import { cn } from '@/lib/utils';
import { useLibraryBookActivity, useLibraryBookMetrics, useRecentBooks } from '@/lib/library-metrics';
import type { Book } from '../../shared/ipc';

type Props = {
  books: Book[];
  refreshKey?: number;
  loading: boolean;
  error: string | null;
  notice?: string | null;
  onOpen: (book: Book) => void;
  onReveal: (bookId: string) => void;
  onDelete: (bookId: string) => void;
  onImport: () => void;
  onDiscover: () => void;
  onAddSample: () => void;
  onReload: () => void;
};

type SortKey = 'recent-opened' | 'recent-added' | 'title' | 'format';
type FormatFilter = 'all' | 'pdf' | 'epub' | 'fb2' | 'txt';

const headerDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const controlButtonClassName = 'h-9 rounded-full px-4 text-xs font-semibold';

function getFilterButtonClassName(active: boolean) {
  return cn(controlButtonClassName, active ? 'border-primary/30 bg-primary/10 text-foreground' : 'text-muted-foreground');
}

export function LibraryCard({
  books,
  refreshKey = 0,
  loading,
  error,
  notice,
  onOpen,
  onReveal,
  onDelete,
  onImport,
  onDiscover,
  onAddSample,
  onReload
}: Props) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState<SortKey>('recent-opened');
  const [formatFilter, setFormatFilter] = React.useState<FormatFilter>('all');
  const refreshToken = React.useMemo(
    () => `${refreshKey}|${books.map((book) => `${book.id}:${book.createdAt}`).join('|')}`,
    [books, refreshKey]
  );
  const metrics = useLibraryBookMetrics(books, refreshToken);
  const activity = useLibraryBookActivity(books, refreshToken);
  const { recentBooks } = useRecentBooks(refreshToken);
  const recentOrder = new Map(recentBooks.map((entry, index) => [entry.bookId, index]));
  const lastOpenedAtByBookId = new Map(recentBooks.map((entry) => [entry.bookId, entry.lastOpenedAt]));
  const trimmedQuery = searchQuery.trim().toLocaleLowerCase();

  const continueReadingBooks = recentBooks
    .map((entry) => books.find((book) => book.id === entry.bookId) ?? null)
    .filter((book): book is Book => Boolean(book))
    .slice(0, 6);

  const filteredBooks = books
    .filter((book) => formatFilter === 'all' || book.format === formatFilter)
    .filter((book) => {
      if (trimmedQuery.length === 0) {
        return true;
      }

      return [book.title, book.subtitle ?? '', book.author ?? '']
        .some((value) => value.toLocaleLowerCase().includes(trimmedQuery));
    })
    .sort((left, right) => {
      if (sortBy === 'recent-added') {
        return right.createdAt - left.createdAt;
      }

      if (sortBy === 'title') {
        return left.title.localeCompare(right.title, 'ru-RU', { sensitivity: 'base' });
      }

      if (sortBy === 'format') {
        const byFormat = left.format.localeCompare(right.format, 'en', { sensitivity: 'base' });
        return byFormat !== 0 ? byFormat : left.title.localeCompare(right.title, 'ru-RU', { sensitivity: 'base' });
      }

      const leftRecentIndex = recentOrder.get(left.id);
      const rightRecentIndex = recentOrder.get(right.id);

      if (leftRecentIndex !== undefined && rightRecentIndex !== undefined) {
        return leftRecentIndex - rightRecentIndex;
      }
      if (leftRecentIndex !== undefined) {
        return -1;
      }
      if (rightRecentIndex !== undefined) {
        return 1;
      }

      return right.createdAt - left.createdAt;
    });

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <Card className="overflow-hidden border-white/50 bg-[linear-gradient(135deg,rgba(219,234,254,0.9)_0%,rgba(239,246,255,0.92)_38%,rgba(255,255,255,0.98)_100%)] shadow-sm">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
            <div className="space-y-2">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
                <p className="text-sm text-muted-foreground">Continue where you left off and keep your collection within reach.</p>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
                  {headerDateFormatter.format(new Date())}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onImport} disabled={loading}>
              <Plus className="h-4 w-4" />
              Import book
            </Button>
            <Button type="button" variant="outline" onClick={onDiscover} disabled={loading}>
              <Compass className="h-4 w-4" />
              Discover Books
            </Button>
            <Button type="button" variant="outline" onClick={onAddSample} disabled={loading}>
              {loading ? 'Please wait...' : 'Add sample book'}
            </Button>
            <Button type="button" variant="outline" onClick={onReload} disabled={loading}>
              Reload
            </Button>
          </div>
        </CardContent>
      </Card>

      {books.length === 0 ? (
        <Card className="overflow-hidden border-white/50 bg-card/95 shadow-sm">
          <CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_36%)] p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-background/80 shadow-sm">
              <BookMarked className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Build your reading hub</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Import your first PDF, EPUB, FB2, or TXT to unlock continue reading, progress tracking, and your full desktop library.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" onClick={onImport} disabled={loading}>
                Import your first book
              </Button>
              <Button type="button" variant="outline" onClick={onDiscover} disabled={loading}>
                Discover Books
              </Button>
              <Button type="button" variant="outline" onClick={onAddSample} disabled={loading}>
                {loading ? 'Please wait...' : 'Add sample book'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Continue Reading</h2>
                <p className="text-sm text-muted-foreground">
                  Your most recently opened books, ready to jump back in.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Ordered by last opened
              </div>
            </div>

            {continueReadingBooks.length === 0 ? (
              <Card className="border-dashed bg-card/80">
                <CardContent className="flex min-h-36 flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-sm font-medium">Open a book to start your continue reading shelf.</p>
                  <p className="text-sm text-muted-foreground">
                    Recent reading sessions will appear here automatically.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {continueReadingBooks.map((book) => (
                  <li key={book.id} className="h-full">
                    <BookCard
                      book={book}
                      onOpen={onOpen}
                      onReveal={onReveal}
                      onDelete={onDelete}
                      loading={loading}
                      metric={metrics[book.id]}
                      activity={activity[book.id]}
                      lastOpenedAt={lastOpenedAtByBookId.get(book.id) ?? null}
                      variant="continue"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-4 rounded-3xl border border-white/40 bg-card/95 p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Library</h2>
                  <p className="text-sm text-muted-foreground">
                    Browse every book, refine by format, and open anything in one click.
                  </p>
                </div>
                <div className="relative w-full lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by title, subtitle, or author..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    Sort by
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(sortBy === 'recent-opened')}
                    onClick={() => setSortBy('recent-opened')}
                  >
                    Recently opened
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(sortBy === 'recent-added')}
                    onClick={() => setSortBy('recent-added')}
                  >
                    Recently added
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(sortBy === 'title')}
                    onClick={() => setSortBy('title')}
                  >
                    Title A-Z
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(sortBy === 'format')}
                    onClick={() => setSortBy('format')}
                  >
                    Format
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Filter</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(formatFilter === 'all')}
                    onClick={() => setFormatFilter('all')}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(formatFilter === 'pdf')}
                    onClick={() => setFormatFilter('pdf')}
                  >
                    PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(formatFilter === 'epub')}
                    onClick={() => setFormatFilter('epub')}
                  >
                    EPUB
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(formatFilter === 'fb2')}
                    onClick={() => setFormatFilter('fb2')}
                  >
                    FB2
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(formatFilter === 'txt')}
                    onClick={() => setFormatFilter('txt')}
                  >
                    TXT
                  </Button>
                </div>
              </div>
            </div>

            {filteredBooks.length === 0 ? (
              <Card className="border-dashed bg-card/80">
                <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-sm font-medium">No books match your current search.</p>
                  <p className="text-sm text-muted-foreground">Try a different title, format filter, or sort mode.</p>
                </CardContent>
              </Card>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredBooks.map((book) => (
                  <li key={book.id} className="h-full">
                    <BookCard
                      book={book}
                      onOpen={onOpen}
                      onReveal={onReveal}
                      onDelete={onDelete}
                      loading={loading}
                      metric={metrics[book.id]}
                      activity={activity[book.id]}
                      lastOpenedAt={lastOpenedAtByBookId.get(book.id) ?? null}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {notice ? (
        <Alert>
          <AlertTitle>Library updated</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Request error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
