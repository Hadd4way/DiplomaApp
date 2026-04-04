import type { ReactNode } from 'react';
import { Sidebar, type AppView } from '@/components/Sidebar';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { getReaderThemePalette, getReaderThemeStyles } from '@/lib/reader-theme';

type Props = {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  children: ReactNode;
  contentClassName?: string;
};

export function AppShell({ currentView, onViewChange, children, contentClassName }: Props) {
  const { settings } = useReaderSettings();
  const palette = getReaderThemePalette(settings.theme);

  return (
    <div
      className="flex h-full min-h-0 overflow-hidden"
      style={{
        ...getReaderThemeStyles(settings.theme),
        backgroundColor: palette.appBg,
        color: palette.appForeground
      }}
    >
      <Sidebar currentView={currentView} onViewChange={onViewChange} />
      <main
        className={['flex min-h-0 flex-1 overflow-hidden', contentClassName ?? 'p-6'].join(' ')}
        style={{
          backgroundColor: palette.appBg,
          color: palette.appForeground
        }}
      >
        {children}
      </main>
    </div>
  );
}
