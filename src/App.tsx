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
import type { AppView } from '@/components/Sidebar';
import { LibraryScreen } from '@/screens/LibraryScreen';
import { EpubReaderScreen } from '@/screens/EpubReaderScreen';
import { PdfReaderScreen } from '@/screens/PdfReaderScreen';
import { NotesScreen } from '@/screens/NotesScreen';
import { PlaceholderScreen } from '@/screens/PlaceholderScreen';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { getReaderThemePalette } from '@/lib/reader-theme';

function getRendererApi() {
  if (!window.api) {
    throw new Error('Renderer API is unavailable. Open this app via Electron.');
  }

  return window.api;
}

export default function App() {
  const { settings } = useReaderSettings();
  const palette = getReaderThemePalette(settings.theme);
  const [loading, setLoading] = React.useState(false);
  const [booting, setBooting] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [books, setBooks] = React.useState<Book[]>([]);
  const [currentView, setCurrentView] = React.useState<AppView>('library');
  const [activeBook, setActiveBook] = React.useState<Book | null>(null);
  const [activePdfData, setActivePdfData] = React.useState<{ base64: string; title: string } | null>(null);
  const [readerInitialPage, setReaderInitialPage] = React.useState<number | null>(null);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onOpenBook = async (book: Book, initialPageOverride: number | null = null) => {
    setReaderInitialPage(initialPageOverride);

    if (book.format === 'epub') {
      setActiveBook(book);
      setActivePdfData(null);
      setError(null);
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
      setError('Book for this note was not found.');
      return;
    }

    setCurrentView('library');
    await onOpenBook(book, note.page);
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
          <p className="text-sm" style={{ color: palette.mutedText }}>Loading library...</p>
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
              title="PDF Reader"
              description="Loading PDF..."
              actionLabel="Back to Library"
              onAction={onBackToLibrary}
            />
          );
        }

        return (
          <PdfReaderScreen
            title={activePdfData.title || activeBook.title}
            base64={activePdfData.base64}
            bookId={activeBook.id}
            initialPage={readerInitialPage}
            onInitialPageApplied={() => setReaderInitialPage(null)}
            loading={loading}
            onBack={onBackToLibrary}
          />
        );
      }

      if (activeBook && activeBook.format === 'epub') {
        return (
          <EpubReaderScreen title={activeBook.title} bookId={activeBook.id} loading={loading} onBack={onBackToLibrary} />
        );
      }

      return (
        <LibraryScreen
          books={books}
          loading={loading}
          error={error}
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
          title="Import"
          actionLabel={loading ? 'Please wait...' : 'Select PDF/EPUB'}
          actionDisabled={loading}
          onAction={onImportBook}
        />
      );
    }

    if (currentView === 'notes') {
      return <NotesScreen books={books} onOpenNote={(note) => void onOpenNote(note)} />;
    }

    return <PlaceholderScreen title="Settings" />;
  };

  return (
    <AppShell
      currentView={currentView}
      onViewChange={(view) => {
        setCurrentView(view);
        resetReaderState();
      }}
      contentClassName={isPdfReaderView ? '' : 'p-6'}
    >
      {renderView()}
    </AppShell>
  );
}
