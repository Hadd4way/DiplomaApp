import type { ReactNode } from 'react';
import { AlertCircle, WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Sidebar, type AppView } from '@/components/Sidebar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNetworkStatus } from '@/contexts/NetworkStatusContext';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { getReaderThemePalette, getReaderThemeStyles } from '@/lib/reader-theme';

type Props = {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  children: ReactNode;
  contentClassName?: string;
};

export function AppShell({ currentView, onViewChange, children, contentClassName }: Props) {
  const { language } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const { settings } = useReaderSettings();
  const palette = getReaderThemePalette(settings);
  const offlineCopy =
    language === 'ru'
      ? {
          title: 'Нет подключения к интернету',
          description: 'Функции, которым нужен интернет, сейчас недоступны: поиск книг, рекомендации, книжный чат и генерация AI-конспектов.'
        }
      : {
          title: 'No internet connection',
          description: 'Features that need internet are unavailable right now: book discovery, recommendations, book chat, and AI summaries.'
        };

  return (
    <div
      className="flex h-full min-h-0 overflow-hidden"
      style={{
        ...getReaderThemeStyles(settings),
        backgroundColor: palette.appBg,
        color: palette.appForeground
      }}
    >
      <Sidebar currentView={currentView} onViewChange={onViewChange} />
      <main
        className={['flex min-h-0 flex-1 flex-col overflow-hidden', contentClassName ?? 'p-6'].join(' ')}
        style={{
          backgroundColor: palette.appBg,
          color: palette.appForeground
        }}
      >
        {!isOnline ? (
          <div className={contentClassName ? 'px-6 pt-6' : 'mb-4'}>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                <WifiOff className="h-4 w-4" />
                {offlineCopy.title}
              </AlertTitle>
              <AlertDescription>{offlineCopy.description}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
