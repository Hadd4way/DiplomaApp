import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ReaderSettingsProvider } from '@/contexts/ReaderSettingsContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { NetworkStatusProvider } from '@/contexts/NetworkStatusContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <NetworkStatusProvider>
        <ReaderSettingsProvider>
          <App />
        </ReaderSettingsProvider>
      </NetworkStatusProvider>
    </LanguageProvider>
  </React.StrictMode>
);
