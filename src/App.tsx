import React from 'react';
import type {
  Book,
  BooksAddSampleResult,
  BooksDeleteResult,
  BooksGetPdfDataResult,
  BooksImportResult,
  BooksListResult,
  BooksRevealResult,
  Note
} from '../shared/ipc';
import { AppShell } from '@/components/AppShell';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { ScreenLoadingState } from '@/components/ScreenState';
import type { AppView } from '@/components/Sidebar';
import { LibraryScreen } from '@/screens/LibraryScreen';
import { NotesScreen } from '@/screens/NotesScreen';
import { PlaceholderScreen } from '@/screens/PlaceholderScreen';
import { useLanguage } from '@/contexts/LanguageContext';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { getReaderThemePalette } from '@/lib/reader-theme';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const EpubReaderScreen = React.lazy(async () => import('@/screens/EpubReaderScreen').then((module) => ({ default: module.EpubReaderScreen })));
const Fb2ReaderScreen = React.lazy(async () => import('@/screens/Fb2ReaderScreen').then((module) => ({ default: module.Fb2ReaderScreen })));
const PdfReaderScreen = React.lazy(async () => import('@/screens/PdfReaderScreen').then((module) => ({ default: module.PdfReaderScreen })));
const TxtReaderScreen = React.lazy(async () => import('@/screens/TxtReaderScreen').then((module) => ({ default: module.TxtReaderScreen })));
const InsightsScreen = React.lazy(async () =>
  import('@/screens/InsightsScreen').then((module) => ({ default: module.InsightsScreen }))
);
const RecommendationScreen = React.lazy(async () => import('@/screens/RecommendationScreen').then((module) => ({ default: module.RecommendationScreen })));
const WishlistScreen = React.lazy(async () => import('@/screens/WishlistScreen').then((module) => ({ default: module.WishlistScreen })));
const SettingsScreen = React.lazy(async () => import('@/screens/SettingsScreen').then((module) => ({ default: module.SettingsScreen })));

type InsightItem = import('@/screens/InsightsScreen').InsightItem;

type ReaderRuntimeBoundaryProps = {
  children: React.ReactNode;
  onBack: () => void;
  title: string;
  backLabel: string;
  fallbackMessage: string;
};

type ReaderRuntimeBoundaryState = {
  error: Error | null;
};

class ReaderRuntimeBoundary extends React.Component<ReaderRuntimeBoundaryProps, ReaderRuntimeBoundaryState> {
  state: ReaderRuntimeBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): ReaderRuntimeBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Reader runtime error', error, errorInfo);
  }

  componentDidUpdate(prevProps: ReaderRuntimeBoundaryProps) {
    if (this.state.error && prevProps.children !== this.props.children) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="mx-auto flex w-full max-w-3xl items-start justify-center py-10">
        <Alert variant="destructive">
          <AlertTitle>{this.props.title}</AlertTitle>
          <AlertDescription>
            <div className="space-y-3">
              <p>{this.state.error.message || this.props.fallbackMessage}</p>
              <Button type="button" variant="outline" onClick={this.props.onBack}>
                {this.props.backLabel}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
}

function getRendererApi() {
  if (!window.api) {
    throw new Error('Renderer API is unavailable. Open this app via Electron.');
  }

  return window.api;
}

function LazyScreenFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full min-w-0 flex-1 items-start">
      <div className="w-full">
        <ScreenLoadingState label={label} />
      </div>
    </div>
  );
}

function SectionBoundary({ area, children }: { area: string; children: React.ReactNode }) {
  return <AppErrorBoundary area={area}>{children}</AppErrorBoundary>;
}

export default function App() {
  const { t } = useLanguage();
  const { settings } = useReaderSettings();
  const palette = getReaderThemePalette(settings);
  const [loading, setLoading] = React.useState(false);
  const [booting, setBooting] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [books, setBooks] = React.useState<Book[]>([]);
  const [currentView, setCurrentView] = React.useState<AppView>('library');
  const [activeBook, setActiveBook] = React.useState<Book | null>(null);
  const [activePdfData, setActivePdfData] = React.useState<{ base64: string; title: string } | null>(null);
  const [readerInitialPage, setReaderInitialPage] = React.useState<number | null>(null);
  const [readerInitialCfi, setReaderInitialCfi] = React.useState<string | null>(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = React.useState(0);
  const [discoverInitialQuery, setDiscoverInitialQuery] = React.useState<string | null>(null);
  const [discoverInitialSearchToken, setDiscoverInitialSearchToken] = React.useState(0);

  const handleResult = React.useCallback(
    <
      T extends
        | BooksListResult
        | BooksAddSampleResult
        | BooksImportResult
        | BooksRevealResult
        | BooksDeleteResult
        | BooksGetPdfDataResult
    >(
      result: T
    ): T => {
      if (!result.ok) {
        setError(result.error);
      }
      return result;
    },
    []
  );

  const resetReaderState = React.useCallback(() => {
    setActiveBook(null);
    setActivePdfData(null);
    setReaderInitialPage(null);
    setReaderInitialCfi(null);
  }, []);

  const loadBooks = React.useCallback(async () => {
    const api = getRendererApi();
    const result = handleResult(await api.books.list());
    if (!result.ok) {
      return false;
    }

    setBooks(result.books);
    return true;
  }, [handleResult]);

  React.useEffect(() => {
    const boot = async () => {
      try {
        setError(null);
        await loadBooks();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setBooting(false);
      }
    };

    void boot();
  }, [loadBooks]);

  const onReloadBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadBooks();
      setLibraryRefreshKey((value) => value + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onAddSampleBook = async () => {
    setLoading(true);
    setError(null);
    try {
      const api = getRendererApi();
      const result = handleResult(await api.books.addSample());
      if (!result.ok) {
        return;
      }

      await loadBooks();
      setLibraryRefreshKey((value) => value + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onImportBook = async () => {
    setLoading(true);
    setError(null);
    try {
      const api = getRendererApi();
      const result = handleResult(await api.books.import());
      if (!result.ok) {
        return;
      }

      setCurrentView('library');
      await loadBooks();
      setLibraryRefreshKey((value) => value + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onOpenBook = async (
    book: Book,
    options: {
      initialPage?: number | null;
      initialCfi?: string | null;
    } = {}
  ) => {
    setReaderInitialPage(options.initialPage ?? null);
    setReaderInitialCfi(options.initialCfi ?? null);

    if (book.format === 'epub' || book.format === 'fb2' || book.format === 'txt') {
      setActiveBook(book);
      setActivePdfData(null);
      setError(null);
      setCurrentView('library');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const api = getRendererApi();
      const result = handleResult(await api.books.getPdfData({ bookId: book.id }));
      if (!result.ok) {
        return;
      }

      setActiveBook(book);
      setActivePdfData({ base64: result.base64, title: result.title });
      setCurrentView('library');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onBackToLibrary = () => {
    resetReaderState();
    setCurrentView('library');
  };

  const onOpenNote = async (note: Note) => {
    const book = books.find((item) => item.id === note.bookId && item.format === 'pdf');
    if (!book) {
      setError(t.app.noteBookNotFound);
      return;
    }

    setCurrentView('library');
    await onOpenBook(book, { initialPage: note.page });
  };

  const onOpenInsightItem = async (item: InsightItem) => {
    if (item.type === 'ai_summary' || !item.bookId) {
      return;
    }

    const book = books.find((entry) => entry.id === item.bookId);
    if (!book) {
      setError(t.app.annotationBookNotFound);
      return;
    }

    setCurrentView('library');
    if (book.format === 'pdf') {
      await onOpenBook(book, { initialPage: item.page ?? 1 });
      return;
    }

    await onOpenBook(book, { initialCfi: item.cfiRange ?? null });
  };

  const onRevealBook = async (bookId: string) => {
    setLoading(true);
    setError(null);
    try {
      const api = getRendererApi();
      handleResult(await api.books.reveal({ bookId }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onDeleteBook = async (bookId: string) => {
    setLoading(true);
    setError(null);
    try {
      const api = getRendererApi();
      const result = handleResult(await api.books.delete({ bookId }));
      if (!result.ok) {
        return;
      }

      await loadBooks();
      setLibraryRefreshKey((value) => value + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <main
        className="h-full overflow-auto px-4 py-10"
        style={{
          backgroundColor: palette.appBg,
          color: palette.appForeground
        }}
      >
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm" style={{ color: palette.mutedText }}>{t.app.loadingLibrary}</p>
        </div>
      </main>
    );
  }

  const isPdfReaderView = currentView === 'library' && activeBook?.format === 'pdf' && Boolean(activePdfData);

  const renderView = () => {
    if (currentView === 'library') {
      if (activeBook && activeBook.format === 'pdf') {
        if (!activePdfData) {
          return (
            <PlaceholderScreen
              title={t.app.pdfReader}
              description={t.app.loadingPdf}
              actionLabel={t.app.backToLibrary}
              onAction={onBackToLibrary}
            />
          );
        }

        return (
          <ReaderRuntimeBoundary
            key={`pdf:${activeBook.id}:${activePdfData.title}`}
            onBack={onBackToLibrary}
            title={t.app.readerCrashedTitle}
            backLabel={t.app.backToLibrary}
            fallbackMessage={t.app.unknownReaderError}
          >
            <React.Suspense fallback={<LazyScreenFallback label={t.app.loadingPdf} />}>
              <PdfReaderScreen
                title={activePdfData.title || activeBook.title}
                base64={activePdfData.base64}
                bookId={activeBook.id}
                initialPage={readerInitialPage}
                onInitialPageApplied={() => setReaderInitialPage(null)}
                loading={loading}
                onBack={onBackToLibrary}
              />
            </React.Suspense>
          </ReaderRuntimeBoundary>
        );
      }

      if (activeBook && activeBook.format === 'epub') {
        return (
          <ReaderRuntimeBoundary
            key={`epub:${activeBook.id}`}
            onBack={onBackToLibrary}
            title={t.app.readerCrashedTitle}
            backLabel={t.app.backToLibrary}
            fallbackMessage={t.app.unknownReaderError}
          >
            <React.Suspense fallback={<LazyScreenFallback label={t.app.loadingLibrary} />}>
              <EpubReaderScreen
                title={activeBook.title}
                bookId={activeBook.id}
                initialCfi={readerInitialCfi}
                onInitialCfiApplied={() => setReaderInitialCfi(null)}
                loading={loading}
                onBack={onBackToLibrary}
              />
            </React.Suspense>
          </ReaderRuntimeBoundary>
        );
      }

      if (activeBook && activeBook.format === 'fb2') {
        return (
          <ReaderRuntimeBoundary
            key={`fb2:${activeBook.id}`}
            onBack={onBackToLibrary}
            title={t.app.readerCrashedTitle}
            backLabel={t.app.backToLibrary}
            fallbackMessage={t.app.unknownReaderError}
          >
            <React.Suspense fallback={<LazyScreenFallback label={t.app.loadingLibrary} />}>
              <Fb2ReaderScreen
                title={activeBook.title}
                bookId={activeBook.id}
                initialCfi={readerInitialCfi}
                onInitialCfiApplied={() => setReaderInitialCfi(null)}
                loading={loading}
                onBack={onBackToLibrary}
              />
            </React.Suspense>
          </ReaderRuntimeBoundary>
        );
      }

      if (activeBook && activeBook.format === 'txt') {
        return (
          <ReaderRuntimeBoundary
            key={`txt:${activeBook.id}`}
            onBack={onBackToLibrary}
            title={t.app.readerCrashedTitle}
            backLabel={t.app.backToLibrary}
            fallbackMessage={t.app.unknownReaderError}
          >
            <React.Suspense fallback={<LazyScreenFallback label={t.app.loadingLibrary} />}>
              <TxtReaderScreen
                title={activeBook.title}
                bookId={activeBook.id}
                initialCfi={readerInitialCfi}
                onInitialCfiApplied={() => setReaderInitialCfi(null)}
                loading={loading}
                onBack={onBackToLibrary}
              />
            </React.Suspense>
          </ReaderRuntimeBoundary>
        );
      }

      return (
        <LibraryScreen
          books={books}
          refreshKey={libraryRefreshKey}
          loading={loading}
          error={error}
          discoverInitialQuery={discoverInitialQuery}
          discoverInitialSearchToken={discoverInitialSearchToken}
          onDiscoverLaunchHandled={() => setDiscoverInitialQuery(null)}
          onOpen={onOpenBook}
          onReveal={onRevealBook}
          onDelete={onDeleteBook}
          onImport={onImportBook}
          onAddSample={onAddSampleBook}
          onReload={onReloadBooks}
        />
      );
    }

    if (currentView === 'import') {
      return (
        <PlaceholderScreen
          title={t.app.importTitle}
          actionLabel={loading ? t.library.pleaseWait : t.app.selectBookFile}
          actionDisabled={loading}
          onAction={onImportBook}
        />
      );
    }

    if (currentView === 'notes') {
      return <NotesScreen books={books} onOpenNote={(note) => void onOpenNote(note)} />;
    }

    if (currentView === 'insights') {
      return (
        <SectionBoundary area="Insights">
          <React.Suspense fallback={<LazyScreenFallback label={t.app.loadingLibrary} />}>
            <InsightsScreen books={books} onOpenItem={(item) => void onOpenInsightItem(item)} />
          </React.Suspense>
        </SectionBoundary>
      );
    }

    if (currentView === 'recommendations') {
      return (
        <SectionBoundary area="Recommendations">
          <React.Suspense fallback={<LazyScreenFallback label={t.app.loadingLibrary} />}>
            <RecommendationScreen
              books={books}
              onFindInDiscover={({ query }) => {
                setDiscoverInitialQuery(query);
                setDiscoverInitialSearchToken((value) => value + 1);
                resetReaderState();
                setCurrentView('library');
              }}
            />
          </React.Suspense>
        </SectionBoundary>
      );
    }

    if (currentView === 'wishlist') {
      return (
        <SectionBoundary area="Wishlist">
          <React.Suspense fallback={<LazyScreenFallback label={t.app.loadingLibrary} />}>
            <WishlistScreen
              onSearchInDiscover={(query) => {
                setDiscoverInitialQuery(query);
                setDiscoverInitialSearchToken((value) => value + 1);
                resetReaderState();
                setCurrentView('library');
              }}
            />
          </React.Suspense>
        </SectionBoundary>
      );
    }

    return (
      <SectionBoundary area="Settings">
        <React.Suspense fallback={<LazyScreenFallback label={t.app.loadingLibrary} />}>
          <SettingsScreen />
        </React.Suspense>
      </SectionBoundary>
    );
  };

  return (
    <AppShell
      currentView={currentView}
      onViewChange={(view) => {
        setCurrentView(view);
        resetReaderState();
        if (view !== 'library') {
          setDiscoverInitialQuery(null);
        }
      }}
      contentClassName={isPdfReaderView ? '' : 'p-4 sm:p-6'}
    >
      {renderView()}
    </AppShell>
  );
}
