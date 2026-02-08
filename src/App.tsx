import React from 'react';

export default function App() {
  return (
    <main>
      <h1>Electron + Vite + React + TypeScript</h1>
      <p>Preload API check: {window.electronAPI.ping()}</p>
    </main>
  );
}