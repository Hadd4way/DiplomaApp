import { BookOpenText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Book } from '../../shared/ipc';

type Props = {
  book: Book;
};

const createdAtFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export function BookCard({ book }: Props) {
  return (
    <Card className="h-full overflow-hidden">
      <div className="flex h-48 items-center justify-center bg-gradient-to-b from-muted to-muted/40">
        <BookOpenText className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      </div>
      <CardContent className="space-y-2 p-4">
        <p className="line-clamp-2 min-h-10 text-sm font-medium leading-5">{book.title}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {book.format}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {createdAtFormatter.format(book.createdAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

