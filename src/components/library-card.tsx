import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Book, User } from '../../shared/ipc';
import { BookCard } from '@/components/book-card';

type Props = {
  user: User;
  books: Book[];
  loading: boolean;
  error: string | null;
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
  user,
  books,
  loading,
  error,
  onAddSample,
  onReload
}: Props) {
  return (
    <Card className="mx-auto w-full max-w-6xl">
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Hello, {user.displayName || user.email}
            </h1>
            <p className="text-sm text-muted-foreground">{headerDateFormatter.format(new Date())}</p>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
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
            <Button type="button" onClick={onAddSample} disabled={loading}>
              {loading ? 'Please wait...' : 'Add sample book'}
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {books.map((book) => (
              <li key={book.id} className="h-full">
                <BookCard book={book} />
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
