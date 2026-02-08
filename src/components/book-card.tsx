import * as React from 'react';
import { BookOpenText, FolderOpen, MoreHorizontal, Trash2 } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { Book } from '../../shared/ipc';

type Props = {
  book: Book;
  onOpen: (book: Book) => void;
  onReveal: (bookId: string) => void;
  onDelete: (bookId: string) => void;
  loading: boolean;
};

const createdAtFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export function BookCard({ book, onOpen, onReveal, onDelete, loading }: Props) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <Card className="h-full overflow-hidden">
      <div className="relative flex h-48 items-center justify-center bg-gradient-to-b from-muted to-muted/40">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute right-2 top-2 z-10 h-8 w-8 p-0"
              disabled={loading}
              onClick={(event) => event.stopPropagation()}
              title="Book actions"
              aria-label={`Actions for ${book.title}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onReveal(book.id);
              }}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Show in folder
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(event) => {
                event.preventDefault();
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          className="flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onOpen(book)}
          disabled={loading}
          aria-label={`Open ${book.title}`}
        >
          <BookOpenText className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onOpen(book)}
        disabled={loading}
      >
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
      </button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete book?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the book from your library and delete its local files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading}
              onClick={() => onDelete(book.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
