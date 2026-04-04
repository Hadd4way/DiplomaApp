import { BookOpen, Download, FileText, Settings } from 'lucide-react';
import type { ComponentType } from 'react';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { getReaderThemePalette } from '@/lib/reader-theme';

export type AppView = 'library' | 'import' | 'notes' | 'settings';

type Props = {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
};

const navItems: Array<{ view: AppView; label: string; icon: ComponentType<{ className?: string }> }> = [
  { view: 'library', label: 'Library', icon: BookOpen },
  { view: 'import', label: 'Import', icon: Download },
  { view: 'notes', label: 'Notes', icon: FileText },
  { view: 'settings', label: 'Settings', icon: Settings }
];

export function Sidebar({ currentView, onViewChange }: Props) {
  const { settings } = useReaderSettings();
  const palette = getReaderThemePalette(settings.theme);

  return (
    <aside
      className="flex w-60 shrink-0 flex-col border-r p-4"
      style={{
        backgroundColor: palette.panelBg,
        borderColor: palette.chromeBorder,
        color: palette.chromeText
      }}
    >
      <div className="mb-6">
        <p className="text-lg font-semibold tracking-tight">Reader</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = item.view === currentView;
          const Icon = item.icon;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onViewChange(item.view)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={
                isActive
                  ? {
                      backgroundColor: palette.accentBg,
                      color: palette.accentText,
                      borderColor: palette.accentBorder
                    }
                  : {
                      color: palette.chromeText
                    }
              }
              aria-current={isActive ? 'page' : undefined}
              onMouseEnter={(event) => {
                if (!isActive) {
                  event.currentTarget.style.backgroundColor = palette.panelHoverBg;
                }
              }}
              onMouseLeave={(event) => {
                if (!isActive) {
                  event.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.view === 'settings' ? (
                <span className="ml-auto text-[10px] uppercase tracking-wide opacity-80">Soon</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: palette.chromeBorder }}>
        <button
          type="button"
          className="w-full rounded-md border px-3 py-2 text-left text-sm transition-colors"
          onClick={() => onViewChange('settings')}
          style={{
            borderColor: palette.buttonBorder,
            backgroundColor: palette.buttonBg,
            color: palette.mutedText
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor = palette.panelHoverBg;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = palette.buttonBg;
          }}
        >
          App settings
        </button>
      </div>
    </aside>
  );
}
