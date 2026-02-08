import { LibraryCard } from '@/components/library-card';
import type { Book, User } from '../../shared/ipc';

type Props = {
  user: User;
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

export function LibraryScreen({
  user,
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
  return (
    <LibraryCard
      user={user}
      books={books}
      loading={loading}
      error={error}
      onOpen={onOpen}
      onReveal={onReveal}
      onDelete={onDelete}
      onImport={onImport}
      onAddSample={onAddSample}
      onReload={onReload}
    />
  );
}
