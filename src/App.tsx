import React from 'react';
import type { PingResponse } from '../shared/ipc';

export default function App() {
  const [result, setResult] = React.useState<PingResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const onPing = async () => {
    setLoading(true);
    setError(null);

    try {
      const rendererApi = window.api ?? window.electronAPI;

      if (!rendererApi) {
        throw new Error('Renderer API is unavailable. Open this app via Electron, not a regular browser tab.');
      }

      const response = await rendererApi.ping();
      setResult(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <h1>Electron + Vite + React + TypeScript</h1>
      <button type="button" onClick={onPing} disabled={loading}>
        {loading ? 'Pinging...' : 'Ping main process'}
      </button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
      {error && <p role="alert">Error: {error}</p>}
    </main>
  );
}
