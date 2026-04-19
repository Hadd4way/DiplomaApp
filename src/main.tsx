import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ReaderSettingsProvider } from '@/contexts/ReaderSettingsContext';
import { LanguageProvider } from '@/contexts/LanguageContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <ReaderSettingsProvider>
        <App />
      </ReaderSettingsProvider>
    </LanguageProvider>
  </React.StrictMode>
);
