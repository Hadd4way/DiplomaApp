import * as React from 'react';
import { BookOpenText, Bookmark, FolderOpen, Highlighter, MoreHorizontal, Trash2 } from 'lucide-react';
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
import type { BookActivitySummary, BookMetric } from '@/lib/library-metrics';
import { cn } from '@/lib/utils';

type Props = {
  book: Book;
  onOpen: (book: Book) => void;
  onReveal: (bookId: string) => void;
  onDelete: (bookId: string) => void;
  loading: boolean;
  metric?: BookMetric;
  activity?: BookActivitySummary;
  lastOpenedAt?: number | null;
  variant?: 'library' | 'continue';
};

const createdAtFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export function BookCard({
  book,
  onOpen,
  onReveal,
  onDelete,
  loading,
  metric,
  activity,
  lastOpenedAt,
  variant = 'library'
}: Props) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const metadataLabel = lastOpenedAt ? `Opened ${createdAtFormatter.format(lastOpenedAt)}` : `Added ${createdAtFormatter.format(book.createdAt)}`;
  const isContinueCard = variant === 'continue';

  return (
    <Card
      className={cn(
        'h-full overflow-hidden border-white/40 bg-card/95 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
        isContinueCard ? 'ring-1 ring-primary/10' : ''
      )}
    >
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden',
          isContinueCard
            ? 'h-52 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_55%),linear-gradient(180deg,hsl(var(--muted))_0%,transparent_100%)]'
            : 'h-44 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_55%),linear-gradient(180deg,hsl(var(--muted))_0%,transparent_100%)]'
        )}
      >
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
          <div className="flex h-full w-full items-center justify-center px-6">
            <div className="flex h-36 w-28 items-center justify-center rounded-2xl border border-white/50 bg-background/85 shadow-lg shadow-black/5 backdrop-blur">
              <BookOpenText className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
        </button>
      </div>
      <div
        role="button"
        tabIndex={loading ? -1 : 0}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          if (!loading) {
            onOpen(book);
          }
        }}
        onKeyDown={(event) => {
          if (loading) {
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen(book);
          }
        }}
        aria-label={`Open ${book.title}`}
      >
        <CardContent className={cn('space-y-3 p-4', isContinueCard ? 'pb-5' : '')}>
          <div className="space-y-2">
            <p className={cn('line-clamp-2 font-medium leading-5', isContinueCard ? 'min-h-12 text-base' : 'min-h-10 text-sm')}>
              {book.title}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {book.format}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">{metadataLabel}</span>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>{metric?.currentLocationLabel ?? (book.format === 'pdf' ? 'Opening position unavailable' : 'Continue Reading')}</span>
              <span>{metric?.pageCountLabel ?? 'Loading progress...'}</span>
            </div>
            {!isContinueCard ? (
              <div className="space-y-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${Math.max(0, Math.min(100, metric?.progressPercent ?? 0))}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">{metric?.progressLabel ?? 'Loading progress...'}</p>
              </div>
            ) : (
              <p className="text-sm font-medium text-foreground/90">{metric?.progressLabel ?? 'Loading progress...'}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Highlighter className="h-3.5 w-3.5" />
                {activity?.highlightCount ?? 0}
              </span>
              <span className="inline-flex items-center gap-1">
                <Bookmark className="h-3.5 w-3.5" />
                {activity?.bookmarkCount ?? 0}
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 px-3"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(book);
              }}
              disabled={loading}
            >
              Open
            </Button>
          </div>
        </CardContent>
      </div>

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
