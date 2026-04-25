import { LibraryCard } from '@/components/library-card';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { DiscoverScreen } from '@/screens/DiscoverScreen';
import * as React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Book } from '../../shared/ipc';

type Props = {
  books: Book[];
  refreshKey?: number;
  loading: boolean;
  error: string | null;
  discoverInitialQuery?: string | null;
  discoverInitialSearchToken?: number;
  onDiscoverLaunchHandled?: () => void;
  onOpen: (book: Book) => void;
  onReveal: (bookId: string) => void;
  onDelete: (bookId: string) => void;
  onImport: () => void;
  onAddSample: () => void;
  onReload: () => void;
};

export function LibraryScreen({
  books,
  refreshKey = 0,
  loading,
  error,
  discoverInitialQuery = null,
  discoverInitialSearchToken,
  onDiscoverLaunchHandled,
  onOpen,
  onReveal,
  onDelete,
  onImport,
  onAddSample,
  onReload
}: Props) {
  const { t } = useLanguage();
  const [mode, setMode] = React.useState<'library' | 'discover'>('library');
  const [notice, setNotice] = React.useState<string | null>(null);
  const [discoverLaunch, setDiscoverLaunch] = React.useState<{ query: string; token: number } | null>(null);

  React.useEffect(() => {
    const trimmedQuery = discoverInitialQuery?.trim();
    if (trimmedQuery) {
      setNotice(null);
      setMode('discover');
      setDiscoverLaunch({
        query: trimmedQuery,
        token: discoverInitialSearchToken ?? Date.now()
      });
      onDiscoverLaunchHandled?.();
    }
  }, [discoverInitialQuery, discoverInitialSearchToken, onDiscoverLaunchHandled]);

  if (mode === 'discover') {
    return (
      <div className="h-full w-full min-w-0 flex-1 overflow-y-auto pr-1">
        <AppErrorBoundary area="Discover">
          <DiscoverScreen
            books={books}
            initialQuery={discoverLaunch?.query ?? null}
            initialSearchToken={discoverLaunch?.token}
            onBack={() => {
              setDiscoverLaunch(null);
              setMode('library');
            }}
            onOpenBook={onOpen}
            onLibraryChanged={async () => {
              await Promise.resolve(onReload());
              setNotice(t.library.importedNotice);
            }}
          />
        </AppErrorBoundary>
      </div>
    );
  }

  return (
    <div className="h-full w-full min-w-0 flex-1 overflow-y-auto pr-1">
      <LibraryCard
        books={books}
        refreshKey={refreshKey}
        loading={loading}
        error={error}
        notice={notice}
        onOpen={onOpen}
        onReveal={onReveal}
        onDelete={onDelete}
        onImport={onImport}
        onDiscover={() => {
          setNotice(null);
          setDiscoverLaunch(null);
          setMode('discover');
        }}
        onAddSample={onAddSample}
        onReload={onReload}
      />
    </div>
  );
}
