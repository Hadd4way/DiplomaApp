import React from 'react';
import type {
  AuthResult,
  Book,
  BooksAddSampleResult,
  BooksDeleteResult,
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

  const clearSession = React.useCallback((nextError: string | null = null) => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setBooks([]);
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
      <main className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </main>
    );
  }

  if (user) {
    const renderView = () => {
      if (currentView === 'library') {
        return (
          <LibraryScreen
            user={user}
            books={books}
            loading={loading}
            error={error}
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
        onViewChange={setCurrentView}
        user={user}
        loading={loading}
        onSignOut={onSignOut}
      >
        {renderView()}
      </AppShell>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
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
