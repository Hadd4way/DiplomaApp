import * as React from 'react';
import { Bookmark, FolderOpen, Highlighter, MoreHorizontal, Trash2 } from 'lucide-react';
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
import { useLanguage } from '@/contexts/LanguageContext';
import { FORMAT_BADGE_LABELS } from '@/lib/constants';
import type { Book } from '../../shared/ipc';
import type { BookActivitySummary, BookMetric } from '@/lib/library-metrics';
import { cn } from '@/lib/utils';

type Props = {
  book: Book;
  onOpen: (book: Book) => void;
  onInspect?: (book: Book) => void;
  onReveal: (bookId: string) => void;
  onDelete: (bookId: string) => void;
  loading: boolean;
  metric?: BookMetric;
  activity?: BookActivitySummary;
  lastOpenedAt?: number | null;
  variant?: 'library' | 'continue';
};

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
    ['from-rose-200 via-pink-100 to-fuchsia-100', 'bg-rose-950/80', 'text-rose-950']
  ] as const;

  return palettes[value % palettes.length];
}

function PlaceholderCover({
  title,
  author,
  fallbackAuthor
}: {
  title: string;
  author: string | null | undefined;
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

function MetaLine({ children }: { children?: React.ReactNode }) {
  return (
    <p className={cn('line-clamp-2 min-h-8 text-xs text-muted-foreground', children ? 'opacity-100' : 'opacity-0')} aria-hidden={!children}>
      {children ?? 'placeholder'}
    </p>
  );
}

function BookCardComponent({
  book,
  onOpen,
  onInspect: _onInspect,
  onReveal,
  onDelete,
  loading,
  metric,
  activity,
  lastOpenedAt,
  variant = 'library'
}: Props) {
  const { language, t } = useLanguage();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const createdAtFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }),
    [language]
  );
  const metadataLabel = lastOpenedAt
    ? `${t.bookCard.openedOn} ${createdAtFormatter.format(lastOpenedAt)}`
    : `${t.bookCard.addedOn} ${createdAtFormatter.format(book.createdAt)}`;
  const isContinueCard = variant === 'continue';
  const authorLine = [book.author, book.publishYear ? String(book.publishYear) : null].filter(Boolean).join(' • ');

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
              title={t.bookCard.bookActions}
              aria-label={`${t.bookCard.actionsFor} ${book.title}`}
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
              {t.bookCard.showInFolder}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(event) => {
                event.preventDefault();
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t.bookCard.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          className="flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onOpen(book)}
          disabled={loading}
          aria-label={`${t.bookCard.openBook} ${book.title}`}
        >
          <div className="flex h-full w-full items-center justify-center px-6">
            <div className="h-36 w-28 overflow-hidden rounded-2xl border border-white/50 bg-background/85 shadow-lg shadow-black/5 backdrop-blur">
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={`${book.title} ${t.discover.coverAlt}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <PlaceholderCover title={book.title} author={book.author} fallbackAuthor={t.bookCard.unknownAuthor} />
              )}
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
        aria-label={`${t.bookCard.openBook} ${book.title}`}
      >
        <CardContent className={cn('space-y-3 p-4', isContinueCard ? 'pb-5' : '')}>
          <div className="flex min-h-[128px] flex-col">
            <p
              className={cn(
                'line-clamp-2 font-medium leading-5',
                isContinueCard ? 'min-h-12 text-base' : 'min-h-10 text-sm'
              )}
            >
              {book.title}
            </p>
            <div className="mt-2 space-y-1">
              <MetaLine>{book.subtitle}</MetaLine>
              <MetaLine>{authorLine}</MetaLine>
            </div>
            <div className="mt-auto flex items-center justify-between gap-2 pt-2">
              <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {FORMAT_BADGE_LABELS[book.format]}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">{metadataLabel}</span>
            </div>
          </div>

          <div className="flex min-h-[78px] flex-col justify-between space-y-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>{metric?.currentLocationLabel ?? (book.format === 'pdf' ? t.bookCard.positionUnavailable : t.bookCard.continueReading)}</span>
              <span>{metric?.pageCountLabel ?? t.bookCard.loadingProgress}</span>
            </div>
            {!isContinueCard ? (
              <div className="space-y-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${Math.max(0, Math.min(100, metric?.progressPercent ?? 0))}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">{metric?.progressLabel ?? t.bookCard.loadingProgress}</p>
              </div>
            ) : (
              <p className="text-sm font-medium text-foreground/90">{metric?.progressLabel ?? t.bookCard.loadingProgress}</p>
            )}
          </div>

          <div className="flex min-h-8 items-center justify-between gap-2">
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
              {t.bookCard.open}
            </Button>
          </div>
        </CardContent>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.bookCard.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.bookCard.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>{t.bookCard.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading}
              onClick={() => onDelete(book.id)}
            >
              {t.bookCard.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export const BookCard = React.memo(BookCardComponent);
