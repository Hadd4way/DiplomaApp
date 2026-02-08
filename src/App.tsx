import React from 'react';
import type {
  AuthResult,
  Book,
  BooksAddSampleResult,
  BooksListResult,
  SignInRequest,
  SignUpRequest,
  User
} from '../shared/ipc';
import { AuthCard } from '@/components/auth-card';
import { LibraryCard } from '@/components/library-card';

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

  const clearSession = React.useCallback((nextError: string | null = null) => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setBooks([]);
    setPassword('');
    setError(nextError);
  }, []);

  const withSessionHandling = React.useCallback(
    (result: BooksListResult | BooksAddSampleResult): typeof result => {
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
    return (
      <main className="min-h-screen bg-background px-4 py-10 text-foreground">
        <LibraryCard
          user={user}
          books={books}
          loading={loading}
          error={error}
          onAddSample={onAddSampleBook}
          onReload={onReloadBooks}
          onSignOut={onSignOut}
        />
      </main>
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

