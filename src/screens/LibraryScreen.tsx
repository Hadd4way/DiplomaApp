import { LibraryCard } from '@/components/library-card';
import type { Book } from '../../shared/ipc';

type Props = {
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
    <div className="h-full overflow-y-auto pr-1">
      <LibraryCard
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
    </div>
  );
}
