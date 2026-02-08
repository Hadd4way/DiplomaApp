import React from 'react';
import type { AuthResult, PingResponse, SignInRequest, SignUpRequest, User } from '../shared/ipc';
import { AuthCard } from '@/components/auth-card';
import { HomeCard } from '@/components/home-card';

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
        <HomeCard
          user={user}
          loading={loading}
          error={error}
          pingResult={pingResult}
          onPing={onPing}
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
