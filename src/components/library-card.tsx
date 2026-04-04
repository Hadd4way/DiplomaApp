import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Book } from '../../shared/ipc';
import { BookCard } from '@/components/book-card';
import { useLibraryBookMetrics, useRecentBooks } from '@/lib/library-metrics';

type Props = {
  books: Book[];
  loading: boolean;
  error: string | null;
  onOpen: (book: Book) => void;
  onReveal: (bookId: string) => void;
  onDelete: (bookId: string) => void;
  onImport: () => void;
  onAddSample: () => void;
  onReload: () => void;
};

const headerDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export function LibraryCard({
  books,
  loading,
  error,
  onOpen,
  onReveal,
  onDelete,
  onImport,
  onAddSample,
  onReload
}: Props) {
  const metrics = useLibraryBookMetrics(books);
  const { recentBooks } = useRecentBooks();
  const recentOrder = new Map(recentBooks.map((entry, index) => [entry.bookId, index]));
  const displayedBooks = [...books].sort((left, right) => {
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
    <Card className="mx-auto w-full max-w-6xl">
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
            <p className="text-sm text-muted-foreground">{headerDateFormatter.format(new Date())}</p>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onImport} disabled={loading}>
              Import book
            </Button>
            <Button type="button" onClick={onAddSample} disabled={loading}>
              {loading ? 'Please wait...' : 'Add sample book'}
            </Button>
            <Button type="button" variant="outline" onClick={onReload} disabled={loading}>
              Reload
            </Button>
          </div>
        </div>

        {books.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 p-6 text-center">
            <p className="text-sm text-muted-foreground">No books yet. Add a sample book or import one.</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" variant="outline" onClick={onImport} disabled={loading}>
                Import book
              </Button>
              <Button type="button" onClick={onAddSample} disabled={loading}>
                {loading ? 'Please wait...' : 'Add sample book'}
              </Button>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayedBooks.map((book) => (
              <li key={book.id} className="h-full">
                <BookCard
                  book={book}
                  onOpen={onOpen}
                  onReveal={onReveal}
                  onDelete={onDelete}
                  loading={loading}
                  metric={metrics[book.id]}
                />
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Request error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
