import * as React from 'react';
import type { Book, Note } from '../../shared/ipc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { NoteEditorDialog } from '@/components/NoteEditorDialog';
import { useLanguage } from '@/contexts/LanguageContext';

type Props = {
  books: Book[];
  onOpenNote: (note: Note) => void;
};

function formatDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return '';
  }
}

export function NotesScreen({ books, onOpenNote }: Props) {
  const { t } = useLanguage();
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Note | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [selectedBookId, setSelectedBookId] = React.useState<string>('all');
  const [queryInput, setQueryInput] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [editTarget, setEditTarget] = React.useState<Note | null>(null);
  const [editContent, setEditContent] = React.useState('');
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const titleByBookId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const book of books) {
      map.set(book.id, book.title);
    }
    return map;
  }, [books]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(queryInput.trim());
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [queryInput]);

  const loadNotes = React.useCallback(async () => {
    if (!window.api) {
      setError('Renderer API is unavailable. Open this app via Electron.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await window.api.notes.list({
        bookId: selectedBookId === 'all' ? null : selectedBookId,
        q: query.length > 0 ? query : null
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotes(result.notes);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [query, selectedBookId]);

  React.useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const handleDelete = async () => {
    if (!window.api || !deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    setError(null);
    try {
      const result = await window.api.notes.delete({ noteId: deleteTarget.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotes((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleOpenEdit = (note: Note) => {
    setEditTarget(note);
    setEditContent(note.content);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!window.api || !editTarget) {
      return;
    }

    const content = editContent.trim();
    if (!content) {
      setEditError(t.notes.editRequired);
      return;
    }

    setEditLoading(true);
    setEditError(null);
    try {
      const result = await window.api.notes.update({ noteId: editTarget.id, content });
      if (!result.ok) {
        setEditError(result.error);
        return;
      }
      setNotes((prev) => {
        const updated = prev.map((item) => (item.id === result.note.id ? result.note : item));
        return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
      });
      setEditTarget(null);
      setEditContent('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setEditError(message);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t.notes.title}</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadNotes()} disabled={loading}>
          {t.notes.refresh}
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
        <select
          value={selectedBookId}
          onChange={(event) => setSelectedBookId(event.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">{t.notes.allBooks}</option>
          {books.map((book) => (
            <option key={book.id} value={book.id}>
              {book.title}
            </option>
          ))}
        </select>
        <Input
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder={t.notes.searchPlaceholder}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {!loading && notes.length === 0 ? <p className="text-sm text-muted-foreground">{t.notes.noNotes}</p> : null}

        {notes.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => onOpenNote(note)}
            className="w-full rounded-lg border bg-card p-4 text-left text-card-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{titleByBookId.get(note.bookId) ?? t.notes.unknownBook}</p>
                <p className="text-xs text-muted-foreground">{t.notes.page} {note.page}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenEdit(note);
                  }}
                >
                  {t.notes.edit}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteTarget(note);
                  }}
                >
                  {t.notes.delete}
                </Button>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{note.content}</p>
            <p className="mt-2 text-xs text-muted-foreground">{t.notes.updated} {formatDate(note.updatedAt)}</p>
          </button>
        ))}
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => (open ? undefined : setDeleteTarget(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.notes.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.notes.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>{t.notes.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={deleteLoading}>
              {t.notes.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NoteEditorDialog
        open={Boolean(editTarget)}
        title={t.notes.editTitle}
        subtitle={
          editTarget
            ? `${titleByBookId.get(editTarget.bookId) ?? t.notes.unknownBook} - ${t.notes.subtitlePage} ${editTarget.page}`
            : undefined
        }
        value={editContent}
        onValueChange={setEditContent}
        error={editError}
        saving={editLoading}
        onCancel={() => {
          setEditTarget(null);
          setEditContent('');
          setEditError(null);
        }}
        onSave={() => void handleSaveEdit()}
      />
    </div>
  );
}
