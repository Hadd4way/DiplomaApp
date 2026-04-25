import * as React from 'react';
import { ArrowLeft, BookOpen, FolderOpen, Layers3, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BookCard } from '@/components/book-card';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { getReaderHeroCardStyles } from '@/lib/reader-theme';
import type { Book, RecommendationEntry } from '../../shared/ipc';
import type { BookActivitySummary, BookMetric } from '@/lib/library-metrics';

type Props = {
  book: Book;
  loading: boolean;
  similarBooks: RecommendationEntry[];
  moreByAuthor: RecommendationEntry[];
  recommendationsLoading: boolean;
  recommendationsError: string | null;
  metrics: Record<string, BookMetric>;
  activity: Record<string, BookActivitySummary>;
  lastOpenedAtByBookId: Map<string, number | null>;
  onBack: () => void;
  onOpen: (book: Book) => void;
  onInspect: (book: Book) => void;
  onReveal: (bookId: string) => void;
  onDelete: (bookId: string) => void;
};

function getReasonLabel(entry: RecommendationEntry) {
  if (entry.matchedAuthors.length > 0) {
    return `Author match: ${entry.matchedAuthors.slice(0, 2).join(', ')}`;
  }
  if (entry.matchedSubjects.length > 0) {
    return `Genre match: ${entry.matchedSubjects.slice(0, 3).join(', ')}`;
  }
  if (entry.reasons.includes('similar-title')) {
    return 'Similar title signal';
  }
  return 'Related from your library';
}

function RecommendationShelf({
  title,
  description,
  entries,
  loading,
  emptyMessage,
  props
}: {
  title: string;
  description: string;
  entries: RecommendationEntry[];
  loading: boolean;
  emptyMessage: string;
  props: Omit<Props, 'book' | 'similarBooks' | 'moreByAuthor' | 'recommendationsLoading' | 'recommendationsError'>;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {loading ? (
        <Card className="border-dashed bg-card/80">
          <CardContent className="p-6 text-sm text-muted-foreground">Building local recommendations...</CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card className="border-dashed bg-card/80">
          <CardContent className="p-6 text-sm text-muted-foreground">{emptyMessage}</CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {entries.map((entry) => (
            <li key={entry.book.id} className="space-y-2">
              <BookCard
                book={entry.book}
                loading={props.loading}
                onOpen={props.onOpen}
                onInspect={props.onInspect}
                onReveal={props.onReveal}
                onDelete={props.onDelete}
                metric={props.metrics[entry.book.id]}
                activity={props.activity[entry.book.id]}
                lastOpenedAt={props.lastOpenedAtByBookId.get(entry.book.id) ?? null}
              />
              <p className="px-1 text-xs text-muted-foreground">{getReasonLabel(entry)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function BookDetailsScreen(props: Props) {
  const {
    book,
    recommendationsError,
    recommendationsLoading,
    similarBooks,
    moreByAuthor,
    onBack,
    onOpen,
    onReveal
  } = props;
  const { settings } = useReaderSettings();

  return (
    <div className="flex h-full w-full min-w-0 flex-1 overflow-y-auto pr-1">
      <div className="flex w-full min-w-0 flex-col gap-6">
        <Card className="overflow-hidden shadow-sm" style={getReaderHeroCardStyles(settings)}>
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
                Back to Library
              </Button>

              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Local recommendation signals
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight">{book.title}</h1>
                  {book.subtitle ? <p className="text-base text-muted-foreground">{book.subtitle}</p> : null}
                  <p className="text-sm text-muted-foreground">
                    {[book.author ?? 'Unknown author', book.publishYear ? String(book.publishYear) : null, book.format.toUpperCase()]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                </div>

                {book.description ? (
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{book.description}</p>
                ) : (
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                    Rich metadata will keep improving in the background as local and Open Library data are matched.
                  </p>
                )}

                {(book.subjects ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(book.subjects ?? []).slice(0, 8).map((subject) => (
                      <span
                        key={subject}
                        className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-3xl border border-border/60 bg-background/80 p-5">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Actions</p>
                  <p className="text-sm text-muted-foreground">Jump in now or manage the local file on disk.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => onOpen(book)}>
                    <BookOpen className="h-4 w-4" />
                    Open Book
                  </Button>
                  <Button type="button" variant="outline" onClick={() => onReveal(book.id)}>
                    <FolderOpen className="h-4 w-4" />
                    Show in Folder
                  </Button>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                  <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                    <Layers3 className="h-4 w-4" />
                    Discovery signals
                  </div>
                  <p>Similar books are ranked by shared author, subject overlap, and title proximity.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {recommendationsError ? (
          <Alert variant="destructive">
            <AlertTitle>Recommendations unavailable</AlertTitle>
            <AlertDescription>{recommendationsError}</AlertDescription>
          </Alert>
        ) : null}

        <RecommendationShelf
          title="Similar Books"
          description="Related titles from your library ranked by author, genre, and metadata overlap."
          entries={similarBooks}
          loading={recommendationsLoading}
          emptyMessage="Add more books with related subjects or authors to grow this shelf."
          props={props}
        />

        <RecommendationShelf
          title={book.author ? `More by ${book.author}` : 'More by Author'}
          description="Other books in your local collection by the same author."
          entries={moreByAuthor}
          loading={recommendationsLoading}
          emptyMessage={book.author ? `No other books by ${book.author} are in your local library yet.` : 'Author metadata is needed to build this shelf.'}
          props={props}
        />
      </div>
    </div>
  );
}
