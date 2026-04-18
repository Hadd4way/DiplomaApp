import * as React from 'react';
import type { Book } from '../../shared/ipc';
import { BookOpen, Brain, Clock3, Highlighter, MessageSquare, Search, Sparkles, Trash2 } from 'lucide-react';
import { NoteEditorDialog } from '@/components/NoteEditorDialog';
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
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type KnowledgeHubItem = {
  id: string;
  bookId: string;
  bookTitle: string;
  type: 'highlight' | 'note';
  text: string | null;
  note: string | null;
  page?: number | null;
  cfiRange?: string | null;
  createdAt: number;
};

type Props = {
  books: Book[];
  onOpenItem: (item: KnowledgeHubItem) => void;
};

type SortOption = 'newest' | 'oldest' | 'book-title';
type TypeFilter = 'all' | 'highlight' | 'note';
type RecentFilter = 'all' | '7d' | '30d';

function formatDate(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return '';
  }
  return new Date(timestamp).toLocaleString();
}

function getRecentThreshold(filter: RecentFilter): number | null {
  const now = Date.now();
  if (filter === '7d') {
    return now - 7 * 24 * 60 * 60 * 1000;
  }
  if (filter === '30d') {
    return now - 30 * 24 * 60 * 60 * 1000;
  }
  return null;
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function badgeClasses(type: KnowledgeHubItem['type']): string {
  return type === 'highlight'
    ? 'border-amber-200 bg-amber-100 text-amber-900'
    : 'border-sky-200 bg-sky-100 text-sky-900';
}

export function KnowledgeHubScreen({ books, onOpenItem }: Props) {
  const [items, setItems] = React.useState<KnowledgeHubItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [queryInput, setQueryInput] = React.useState('');
  const deferredQuery = React.useDeferredValue(queryInput.trim().toLowerCase());
  const [selectedBookId, setSelectedBookId] = React.useState('all');
  const [selectedType, setSelectedType] = React.useState<TypeFilter>('all');
  const [selectedRecent, setSelectedRecent] = React.useState<RecentFilter>('all');
  const [sortBy, setSortBy] = React.useState<SortOption>('newest');
  const [deleteTarget, setDeleteTarget] = React.useState<KnowledgeHubItem | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<KnowledgeHubItem | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);

  const loadAnnotations = React.useCallback(async () => {
    if (!window.api) {
      setError('Renderer API is unavailable. Open this app via Electron.');
      setItems([]);
      return;
    }
    const api = window.api;

    setLoading(true);
    setError(null);
    try {
      const notesPromise = api.notes.list({ bookId: null, q: null });
      const highlightPromises = books.map(async (book) => {
        if (book.format === 'pdf') {
          const result = await api.highlights.list({ bookId: book.id });
          return { book, result };
        }

        const result = await api.epubHighlights.list({ bookId: book.id });
        return { book, result };
      });

      const [notesResult, ...highlightResults] = await Promise.all([notesPromise, ...highlightPromises]);
      if (!notesResult.ok) {
        setError(notesResult.error);
      }

      const nextItems: KnowledgeHubItem[] = [];
      if (notesResult.ok) {
        for (const note of notesResult.notes) {
          const bookTitle = books.find((book) => book.id === note.bookId)?.title ?? 'Unknown book';
          nextItems.push({
            id: note.id,
            bookId: note.bookId,
            bookTitle,
            type: 'note',
            text: null,
            note: normalizeText(note.content),
            page: note.page,
            cfiRange: null,
            createdAt: note.createdAt
          });
        }
      }

      for (const entry of highlightResults) {
        if (!entry?.result?.ok) {
          continue;
        }
        for (const highlight of entry.result.highlights) {
          nextItems.push({
            id: highlight.id,
            bookId: highlight.bookId,
            bookTitle: entry.book.title,
            type: 'highlight',
            text: normalizeText(highlight.text),
            note: normalizeText(highlight.note),
            page: highlight.page,
            cfiRange: highlight.cfiRange,
            createdAt: highlight.createdAt
          });
        }
      }

      setItems(nextItems);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [books]);

  React.useEffect(() => {
    void loadAnnotations();
  }, [loadAnnotations]);

  const recentThreshold = React.useMemo(() => getRecentThreshold(selectedRecent), [selectedRecent]);

  const filteredItems = React.useMemo(() => {
    const filtered = items.filter((item) => {
      if (selectedBookId !== 'all' && item.bookId !== selectedBookId) {
        return false;
      }
      if (selectedType !== 'all' && item.type !== selectedType) {
        return false;
      }
      if (recentThreshold !== null && item.createdAt < recentThreshold) {
        return false;
      }
      if (!deferredQuery) {
        return true;
      }

      const haystack = [item.bookTitle, item.text ?? '', item.note ?? ''].join(' ').toLowerCase();
      return haystack.includes(deferredQuery);
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'oldest') {
        return a.createdAt - b.createdAt;
      }
      if (sortBy === 'book-title') {
        const titleCompare = a.bookTitle.localeCompare(b.bookTitle);
        if (titleCompare !== 0) {
          return titleCompare;
        }
        return b.createdAt - a.createdAt;
      }
      return b.createdAt - a.createdAt;
    });
  }, [deferredQuery, items, recentThreshold, selectedBookId, selectedType, sortBy]);

  const summary = React.useMemo(() => {
    const notesCount = items.filter((item) => item.type === 'note').length;
    const highlightsCount = items.filter((item) => item.type === 'highlight').length;
    return {
      total: items.length,
      notes: notesCount,
      highlights: highlightsCount,
      books: new Set(items.map((item) => item.bookId)).size
    };
  }, [items]);

  const handleDelete = React.useCallback(async () => {
    if (!window.api || !deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    setError(null);
    try {
      const result =
        deleteTarget.type === 'note'
          ? await window.api.notes.delete({ noteId: deleteTarget.id })
          : await window.api.highlights.delete({ highlightId: deleteTarget.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget]);

  const openEditDialog = React.useCallback((item: KnowledgeHubItem) => {
    setEditTarget(item);
    setEditValue(item.type === 'note' ? item.note ?? '' : item.note ?? '');
    setEditError(null);
  }, []);

  const handleSaveEdit = React.useCallback(async () => {
    if (!window.api || !editTarget) {
      return;
    }

    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      setEditError(editTarget.type === 'note' ? 'Note content is required.' : 'Note text is required.');
      return;
    }

    setEditLoading(true);
    setEditError(null);
    try {
      if (editTarget.type === 'note') {
        const result = await window.api.notes.update({ noteId: editTarget.id, content: trimmedValue });
        if (!result.ok) {
          setEditError(result.error);
          return;
        }
        setItems((prev) =>
          prev.map((item) =>
            item.id === editTarget.id
              ? {
                  ...item,
                  note: normalizeText(result.note.content),
                  page: result.note.page,
                  createdAt: result.note.createdAt
                }
              : item
          )
        );
      } else {
        const result = await window.api.highlights.updateNote({ highlightId: editTarget.id, note: trimmedValue });
        if (!result.ok) {
          setEditError(result.error);
          return;
        }
        setItems((prev) =>
          prev.map((item) =>
            item.id === editTarget.id
              ? {
                  ...item,
                  note: normalizeText(result.highlight.note),
                  text: normalizeText(result.highlight.text),
                  page: result.highlight.page,
                  cfiRange: result.highlight.cfiRange,
                  createdAt: result.highlight.createdAt
                }
              : item
          )
        );
      }

      setEditTarget(null);
      setEditValue('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setEditError(message);
    } finally {
      setEditLoading(false);
    }
  }, [editTarget, editValue]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto pr-2">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-8">
          <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_32%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.95)_52%,_rgba(8,47,73,0.92))] p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_center,_rgba(125,211,252,0.20),_transparent_68%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-100">
                  <Brain className="h-3.5 w-3.5" />
                  Second Brain
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight">Knowledge Hub</h2>
                  <p className="max-w-xl text-sm leading-6 text-slate-300">
                    Review ideas, patterns, and takeaways from every book in one place. Search your reading memory,
                    refine it, and jump straight back into the source.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card className="border-white/10 bg-white/10 text-white shadow-none backdrop-blur">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Items</p>
                    <p className="mt-2 text-2xl font-semibold">{summary.total}</p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/10 text-white shadow-none backdrop-blur">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Highlights</p>
                    <p className="mt-2 text-2xl font-semibold">{summary.highlights}</p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/10 text-white shadow-none backdrop-blur">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Notes</p>
                    <p className="mt-2 text-2xl font-semibold">{summary.notes}</p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/10 text-white shadow-none backdrop-blur">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Books</p>
                    <p className="mt-2 text-2xl font-semibold">{summary.books}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.7fr))]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                    placeholder="Search across highlights and notes..."
                    className="pl-9"
                  />
                </div>
                <select
                  value={selectedBookId}
                  onChange={(event) => setSelectedBookId(event.target.value)}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All books</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value as TypeFilter)}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All types</option>
                  <option value="highlight">Highlights</option>
                  <option value="note">Notes</option>
                </select>
                <select
                  value={selectedRecent}
                  onChange={(event) => setSelectedRecent(event.target.value as RecentFilter)}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All time</option>
                  <option value="7d">Recent 7 days</option>
                  <option value="30d">Recent 30 days</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="book-title">Book title</option>
                </select>
                <Button type="button" variant="outline" onClick={() => void loadAnnotations()} disabled={loading}>
                  Refresh
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  {filteredItems.length} surfaced
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  Sorted by {sortBy === 'book-title' ? 'book title' : sortBy}
                </div>
              </div>
            </div>
          </section>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <section className="grid gap-4">
            {!loading && filteredItems.length === 0 ? (
              <Card className="rounded-[24px] border-dashed border-slate-300 bg-slate-50/70 shadow-none">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <Brain className="h-10 w-10 text-slate-400" />
                  <div className="space-y-1">
                    <p className="text-base font-medium text-slate-800">Your hub is quiet right now</p>
                    <p className="text-sm text-slate-500">
                      Add highlights or notes in any reader and they’ll appear here automatically.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {filteredItems.map((item) => (
              <Card
                key={`${item.type}:${item.id}`}
                className="overflow-hidden rounded-[24px] border-slate-200 bg-white/95 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
              >
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-slate-900">{item.bookTitle}</p>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                            badgeClasses(item.type)
                          )}
                        >
                          {item.type === 'highlight' ? 'Highlight' : 'Note'}
                        </span>
                        <span className="text-xs text-slate-400">{formatDate(item.createdAt)}</span>
                      </div>

                      {item.text ? (
                        <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
                            <Highlighter className="h-3.5 w-3.5" />
                            Highlighted text
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{item.text}</p>
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Note text
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {item.note ?? 'No note yet.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {typeof item.page === 'number' ? <span>Page {item.page}</span> : null}
                        {item.cfiRange ? <span className="truncate">EPUB jump ready</span> : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-row gap-2 lg:w-[178px] lg:flex-col">
                      <Button type="button" onClick={() => onOpenItem(item)} className="flex-1 lg:w-full">
                        <BookOpen className="mr-2 h-4 w-4" />
                        Open in book
                      </Button>
                      <Button type="button" variant="outline" onClick={() => openEditDialog(item)} className="flex-1 lg:w-full">
                        Edit note
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDeleteTarget(item)}
                        className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 lg:w-full"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        </div>
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => (open ? undefined : setDeleteTarget(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'highlight'
                ? 'This highlight will be removed from the book and the Knowledge Hub.'
                : 'This note will be removed from the book and the Knowledge Hub.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={deleteLoading}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NoteEditorDialog
        open={Boolean(editTarget)}
        title={editTarget?.type === 'highlight' ? 'Edit highlight note' : 'Edit note'}
        subtitle={editTarget ? `${editTarget.bookTitle}${typeof editTarget.page === 'number' ? ` - page ${editTarget.page}` : ''}` : undefined}
        value={editValue}
        onValueChange={setEditValue}
        error={editError}
        saving={editLoading}
        onCancel={() => {
          setEditTarget(null);
          setEditValue('');
          setEditError(null);
        }}
        onSave={() => void handleSaveEdit()}
      />
    </div>
  );
}
