import * as React from 'react';
import { ArrowUpDown, BookMarked, Clock3, Compass, Plus, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScreenEmptyState, ScreenErrorState } from '@/components/ScreenState';
import { SkeletonGrid } from '@/components/Skeletons';
import { Input } from '@/components/ui/input';
import { BookCard } from '@/components/book-card';
import { useLanguage } from '@/contexts/LanguageContext';
import { DEBOUNCE_MS, FORMAT_BADGE_LABELS, LIST_BATCH_SIZE } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useLibraryBookActivity, useLibraryBookMetrics, useRecentBooks } from '@/lib/library-metrics';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useIncrementalList } from '@/lib/useIncrementalList';
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
  const { language, t } = useLanguage();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState<SortKey>('recent-opened');
  const [formatFilter, setFormatFilter] = React.useState<FormatFilter>('all');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, DEBOUNCE_MS.librarySearch);
  const refreshToken = React.useMemo(
    () => `${refreshKey}|${books.map((book) => `${book.id}:${book.createdAt}`).join('|')}`,
    [books, refreshKey]
  );
  const metrics = useLibraryBookMetrics(books, refreshToken);
  const activity = useLibraryBookActivity(books, refreshToken);
  const { recentBooks } = useRecentBooks(refreshToken);
  const recentOrder = new Map(recentBooks.map((entry, index) => [entry.bookId, index]));
  const lastOpenedAtByBookId = new Map(recentBooks.map((entry) => [entry.bookId, entry.lastOpenedAt]));
  const trimmedQuery = debouncedSearchQuery.trim().toLocaleLowerCase();
  const headerDateFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }),
    [language]
  );

  const continueReadingBooks = recentBooks
    .map((entry) => books.find((book) => book.id === entry.bookId) ?? null)
    .filter((book): book is Book => Boolean(book))
    .slice(0, 6);

  const filteredBooks = React.useMemo(
    () =>
      books
        .filter((book) => formatFilter === 'all' || book.format === formatFilter)
        .filter((book) => {
          if (trimmedQuery.length === 0) {
            return true;
          }

          return [book.title, book.subtitle ?? '', book.author ?? ''].some((value) =>
            value.toLocaleLowerCase().includes(trimmedQuery)
          );
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
        }),
    [books, formatFilter, recentOrder, sortBy, trimmedQuery]
  );
  const { visibleItems: visibleBooks, hasMore, showMore } = useIncrementalList(filteredBooks, LIST_BATCH_SIZE.library);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <Card className="overflow-hidden border-white/50 bg-[linear-gradient(135deg,rgba(219,234,254,0.9)_0%,rgba(239,246,255,0.92)_38%,rgba(255,255,255,0.98)_100%)] shadow-sm">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
            <div className="space-y-2">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight">{t.library.title}</h1>
                <p className="text-sm text-muted-foreground">{t.library.subtitle}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
                  {headerDateFormatter.format(new Date())}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onImport} disabled={loading}>
              <Plus className="h-4 w-4" />
              {t.library.importBook}
            </Button>
            <Button type="button" variant="outline" onClick={onDiscover} disabled={loading}>
              <Compass className="h-4 w-4" />
              {t.library.discoverBooks}
            </Button>
            <Button type="button" variant="outline" onClick={onAddSample} disabled={loading}>
              {loading ? t.library.pleaseWait : t.library.addSampleBook}
            </Button>
            <Button type="button" variant="outline" onClick={onReload} disabled={loading}>
              {t.library.reload}
            </Button>
          </div>
        </CardContent>
      </Card>

      {books.length === 0 ? (
        <ScreenEmptyState
          title={t.library.emptyTitle}
          description={t.library.emptyDescription}
          actionLabel={t.library.importFirstBook}
          onAction={onImport}
          icon={<BookMarked className="h-6 w-6 text-muted-foreground" />}
        />
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{t.library.continueReadingTitle}</h2>
                <p className="text-sm text-muted-foreground">{t.library.continueReadingSubtitle}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                {t.library.orderedByLastOpened}
              </div>
            </div>

            {continueReadingBooks.length === 0 ? (
              <Card className="border-dashed bg-card/80">
                <CardContent className="flex min-h-36 flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-sm font-medium">{t.library.continueReadingEmptyTitle}</p>
                  <p className="text-sm text-muted-foreground">{t.library.continueReadingEmptyDescription}</p>
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
                  <h2 className="text-xl font-semibold tracking-tight">{t.library.browseTitle}</h2>
                  <p className="text-sm text-muted-foreground">{t.library.browseSubtitle}</p>
                </div>
                <div className="relative w-full lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t.library.searchPlaceholder}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    {t.library.sortBy}
                  </span>
                    <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(sortBy === 'recent-opened')}
                    onClick={() => setSortBy('recent-opened')}
                  >
                    {t.library.sortRecentOpened}
                  </Button>
                    <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(sortBy === 'recent-added')}
                    onClick={() => setSortBy('recent-added')}
                  >
                    {t.library.sortRecentAdded}
                  </Button>
                    <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(sortBy === 'title')}
                    onClick={() => setSortBy('title')}
                  >
                    {t.library.sortTitle}
                  </Button>
                    <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(sortBy === 'format')}
                    onClick={() => setSortBy('format')}
                  >
                    {t.library.sortFormat}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t.library.filter}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(formatFilter === 'all')}
                    onClick={() => setFormatFilter('all')}
                  >
                    {t.library.filterAll}
                  </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={getFilterButtonClassName(formatFilter === 'pdf')}
                      onClick={() => setFormatFilter('pdf')}
                    >
                    {FORMAT_BADGE_LABELS.pdf}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(formatFilter === 'epub')}
                    onClick={() => setFormatFilter('epub')}
                  >
                    {FORMAT_BADGE_LABELS.epub}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(formatFilter === 'fb2')}
                    onClick={() => setFormatFilter('fb2')}
                  >
                    {FORMAT_BADGE_LABELS.fb2}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={getFilterButtonClassName(formatFilter === 'txt')}
                    onClick={() => setFormatFilter('txt')}
                  >
                    {FORMAT_BADGE_LABELS.txt}
                  </Button>
                </div>
              </div>
            </div>

            {filteredBooks.length === 0 ? (
              <ScreenEmptyState
                title={t.library.noBooksFoundTitle}
                description={t.library.noBooksFoundDescription}
                icon={<Search className="h-6 w-6 text-muted-foreground" />}
              />
            ) : loading ? (
              <SkeletonGrid count={6} variant="library" />
            ) : (
              <>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleBooks.map((book) => (
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
                {hasMore ? (
                  <div className="flex justify-center pt-2">
                    <Button type="button" variant="outline" onClick={showMore}>
                      Show more
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </>
      )}

      {notice ? (
        <Alert>
          <AlertTitle>{t.library.updatedTitle}</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <ScreenErrorState title={t.library.requestErrorTitle} description={error} onRetry={onReload} />
      ) : null}
    </div>
  );
}
