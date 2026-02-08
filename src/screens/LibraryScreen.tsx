import { LibraryCard } from '@/components/library-card';
import type { Book, User } from '../../shared/ipc';

type Props = {
  user: User;
  books: Book[];
  loading: boolean;
  error: string | null;
  onReveal: (bookId: string) => void;
  onImport: () => void;
  onAddSample: () => void;
  onReload: () => void;
};

export function LibraryScreen({
  user,
  books,
  loading,
  error,
  onReveal,
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
      onReveal={onReveal}
      onImport={onImport}
      onAddSample={onAddSample}
      onReload={onReload}
    />
  );
}
