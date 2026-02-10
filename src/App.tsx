import React from 'react';
import type {
  AuthResult,
  Book,
  BooksAddSampleResult,
  BooksDeleteResult,
  BooksGetPdfDataResult,
  BooksImportResult,
  BooksListResult,
  BooksRevealResult,
  SignInRequest,
  SignUpRequest,
  User
} from '../shared/ipc';
import { AppShell } from '@/components/AppShell';
import { AuthCard } from '@/components/auth-card';
import type { AppView } from '@/components/Sidebar';
import { LibraryScreen } from '@/screens/LibraryScreen';
import { PdfReaderScreen } from '@/screens/PdfReaderScreen';
import { PlaceholderScreen } from '@/screens/PlaceholderScreen';

const SESSION_TOKEN_KEY = 'auth.session.token';
const SESSION_INVALID_ERROR = 'Session is invalid or expired.';

type AuthMode = 'signIn' | 'signUp';

function getRendererApi() {
  if (!window.api) {
    throw new Error('Renderer API is unavailable. Open this app via Electron.');
  }

  return window.api;
}

export default function App() {
  const [authMode, setAuthMode] = React.useState<AuthMode>('signIn');
  const [email, setEmail] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [booting, setBooting] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [books, setBooks] = React.useState<Book[]>([]);
  const [currentView, setCurrentView] = React.useState<AppView>('library');
  const [activeBook, setActiveBook] = React.useState<Book | null>(null);
  const [activePdfData, setActivePdfData] = React.useState<{ base64: string; title: string } | null>(null);

  const clearSession = React.useCallback((nextError: string | null = null) => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setBooks([]);
    setActiveBook(null);
    setActivePdfData(null);
    setPassword('');
    setError(nextError);
  }, []);

  const withSessionHandling = React.useCallback(
    (
      result:
        | BooksListResult
        | BooksAddSampleResult
        | BooksImportResult
        | BooksRevealResult
        | BooksDeleteResult
        | BooksGetPdfDataResult
    ): typeof result => {
      if (!result.ok && result.error === SESSION_INVALID_ERROR) {
        clearSession(result.error);
      }
      return result;
    },
    [clearSession]
  );

  const loadBooks = React.useCallback(
    async (activeToken: string) => {
      const api = getRendererApi();
      const result = withSessionHandling(await api.books.list({ token: activeToken }));
      if (!result.ok) {
        if (result.error !== SESSION_INVALID_ERROR) {
          setError(result.error);
        }
        return false;
      }

      setBooks(result.books);
      return true;
    },
    [withSessionHandling]
  );

  React.useEffect(() => {
    const tryAutoLogin = async () => {
      const existingToken = localStorage.getItem(SESSION_TOKEN_KEY);
      if (!existingToken) {
        setBooting(false);
        return;
      }

      try {
        const api = getRendererApi();
        const authResult = await api.auth.getCurrentUser({ token: existingToken });

        if (!authResult.ok) {
          clearSession(null);
          return;
        }

        setToken(existingToken);
        setUser(authResult.user);
        await loadBooks(existingToken);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        clearSession(message);
      } finally {
        setBooting(false);
      }
    };

    void tryAutoLogin();
  }, [clearSession, loadBooks]);

  const onSubmitAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const api = getRendererApi();
      let result: AuthResult;

      if (authMode === 'signUp') {
        const payload: SignUpRequest = {
          email,
          password,
          displayName
        };
        result = await api.auth.signUp(payload);
      } else {
        const payload: SignInRequest = {
          email,
          password
        };
        result = await api.auth.signIn(payload);
      }

      if (!result.ok) {
        setError(result.error);
        return;
      }

      localStorage.setItem(SESSION_TOKEN_KEY, result.token);
      setToken(result.token);
      setUser(result.user);
      setPassword('');
      await loadBooks(result.token);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onSignOut = async () => {
    setLoading(true);
    setError(null);

    try {
      const api = getRendererApi();
      if (token) {
        const result = await api.auth.signOut({ token });
        if (!result.ok) {
          setError(result.error);
          return;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      clearSession(null);
      setLoading(false);
    }
  };

  const onReloadBooks = async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await loadBooks(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onAddSampleBook = async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const api = getRendererApi();
      const result = withSessionHandling(await api.books.addSample({ token }));
      if (!result.ok) {
        if (result.error !== SESSION_INVALID_ERROR) {
          setError(result.error);
        }
        return;
      }

      await loadBooks(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onImportBook = async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const api = getRendererApi();
      const result = withSessionHandling(await api.books.import({ token }));
      if (!result.ok) {
        if (result.error !== SESSION_INVALID_ERROR) {
          setError(result.error);
        }
        return;
      }

      setCurrentView('library');
      await loadBooks(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onOpenBook = async (book: Book) => {
    if (book.format === 'epub') {
      setActiveBook(book);
      setActivePdfData(null);
      setError(null);
      return;
    }

    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const api = getRendererApi();
      const result = withSessionHandling(await api.books.getPdfData({ token, bookId: book.id }));
      if (!result.ok) {
        if (result.error !== SESSION_INVALID_ERROR) {
          setError(result.error);
        }
        return;
      }

      setActiveBook(book);
      setActivePdfData({ base64: result.base64, title: result.title });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onBackToLibrary = () => {
    setActiveBook(null);
    setActivePdfData(null);
    setCurrentView('library');
  };

  const onRevealBook = async (bookId: string) => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const api = getRendererApi();
      const result = withSessionHandling(await api.books.reveal({ token, bookId }));
      if (!result.ok) {
        if (result.error !== SESSION_INVALID_ERROR) {
          setError(result.error);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onDeleteBook = async (bookId: string) => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const api = getRendererApi();
      const result = withSessionHandling(await api.books.delete({ token, bookId }));
      if (!result.ok) {
        if (result.error !== SESSION_INVALID_ERROR) {
          setError(result.error);
        }
        return;
      }

      await loadBooks(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <main className="h-full overflow-auto bg-background px-4 py-10 text-foreground">
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </main>
    );
  }

  if (user) {
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
              userId={user.id.trim() || user.email}
              bookId={activeBook.id}
              loading={loading}
              onBack={onBackToLibrary}
            />
          );
        }

        if (activeBook && activeBook.format === 'epub') {
          return (
            <PlaceholderScreen
              title="EPUB Reader"
              description="EPUB reader coming soon."
              actionLabel="Back to Library"
              onAction={onBackToLibrary}
            />
          );
        }

        return (
          <LibraryScreen
            user={user}
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
        return <PlaceholderScreen title="Notes" />;
      }

      return <PlaceholderScreen title="Settings" />;
    };

    return (
      <AppShell
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view);
          setActiveBook(null);
          setActivePdfData(null);
        }}
        user={user}
        loading={loading}
        onSignOut={onSignOut}
        contentClassName={isPdfReaderView ? '' : 'p-6'}
      >
        {renderView()}
      </AppShell>
    );
  }

  return (
    <main className="h-full overflow-auto bg-background px-4 py-10 text-foreground">
      <AuthCard
        mode={authMode}
        email={email}
        displayName={displayName}
        password={password}
        loading={loading}
        error={error}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setError(null);
        }}
        onEmailChange={setEmail}
        onDisplayNameChange={setDisplayName}
        onPasswordChange={setPassword}
        onSubmit={onSubmitAuth}
      />
    </main>
  );
}
