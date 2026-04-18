import { LibraryCard } from '@/components/library-card';
import { DiscoverScreen } from '@/screens/DiscoverScreen';
import * as React from 'react';
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
  const [mode, setMode] = React.useState<'library' | 'discover'>('library');
  const [notice, setNotice] = React.useState<string | null>(null);

  if (mode === 'discover') {
    return (
      <div className="h-full overflow-y-auto pr-1">
        <DiscoverScreen
          books={books}
          onBack={() => setMode('library')}
          onLibraryChanged={async () => {
            await Promise.resolve(onReload());
            setNotice('Your library now includes the downloaded Project Gutenberg book.');
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-1">
      <LibraryCard
        books={books}
        loading={loading}
        error={error}
        notice={notice}
        onOpen={onOpen}
        onReveal={onReveal}
        onDelete={onDelete}
        onImport={onImport}
        onDiscover={() => {
          setNotice(null);
          setMode('discover');
        }}
        onAddSample={onAddSample}
        onReload={onReload}
      />
    </div>
  );
}
