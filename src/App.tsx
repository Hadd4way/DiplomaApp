import React from 'react';
import type { AuthResult, PingResponse, SignInRequest, SignUpRequest, User } from '../shared/ipc';

const SESSION_TOKEN_KEY = 'auth.session.token';

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
  const [pingResult, setPingResult] = React.useState<PingResponse | null>(null);

  React.useEffect(() => {
    const tryAutoLogin = async () => {
      const existingToken = localStorage.getItem(SESSION_TOKEN_KEY);
      if (!existingToken) {
        setBooting(false);
        return;
      }

      try {
        const api = getRendererApi();
        const result = await api.auth.getCurrentUser({ token: existingToken });

        if (result.ok) {
          setToken(existingToken);
          setUser(result.user);
        } else {
          localStorage.removeItem(SESSION_TOKEN_KEY);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        localStorage.removeItem(SESSION_TOKEN_KEY);
      } finally {
        setBooting(false);
      }
    };

    void tryAutoLogin();
  }, []);

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
      setPingResult(null);
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
      localStorage.removeItem(SESSION_TOKEN_KEY);
      setToken(null);
      setUser(null);
      setPingResult(null);
      setPassword('');
      setLoading(false);
    }
  };

  const onPing = async () => {
    setLoading(true);
    setError(null);

    try {
      const api = getRendererApi();
      const result = await api.ping();
      setPingResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <main>
        <h1>Loading...</h1>
      </main>
    );
  }

  if (user) {
    return (
      <main>
        <h1>Home</h1>
        <p>
          Logged in as {user.displayName} ({user.email})
        </p>
        <div className="row">
          <button type="button" onClick={onPing} disabled={loading}>
            {loading ? 'Please wait...' : 'Ping main process'}
          </button>
          <button type="button" onClick={onSignOut} disabled={loading}>
            Log out
          </button>
        </div>
        {pingResult && <pre>{JSON.stringify(pingResult, null, 2)}</pre>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </main>
    );
  }

  return (
    <main>
      <h1>Authentication</h1>

      <div className="tabs">
        <button
          type="button"
          className={authMode === 'signIn' ? 'active' : ''}
          onClick={() => {
            setAuthMode('signIn');
            setError(null);
          }}
          disabled={loading}
        >
          Sign in
        </button>
        <button
          type="button"
          className={authMode === 'signUp' ? 'active' : ''}
          onClick={() => {
            setAuthMode('signUp');
            setError(null);
          }}
          disabled={loading}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={onSubmitAuth}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        {authMode === 'signUp' && (
          <>
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </>
        )}

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={authMode === 'signUp' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' : authMode === 'signUp' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </main>
  );
}

