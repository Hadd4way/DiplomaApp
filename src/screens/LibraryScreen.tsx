import { LibraryCard } from '@/components/library-card';
import type { Book, User } from '../../shared/ipc';

type Props = {
  user: User;
  books: Book[];
  loading: boolean;
  error: string | null;
  onAddSample: () => void;
  onReload: () => void;
};

export function LibraryScreen({ user, books, loading, error, onAddSample, onReload }: Props) {
  return (
    <LibraryCard
      user={user}
      books={books}
      loading={loading}
      error={error}
      onAddSample={onAddSample}
      onReload={onReload}
    />
  );
}

