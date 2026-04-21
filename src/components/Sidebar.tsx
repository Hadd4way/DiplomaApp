import { BookOpen, Brain, Settings, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getReaderThemePalette } from '@/lib/reader-theme';

export type AppView = 'library' | 'import' | 'notes' | 'knowledge-hub' | 'book-advisor' | 'settings';

type Props = {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
};

export function Sidebar({ currentView, onViewChange }: Props) {
  const { settings } = useReaderSettings();
  const { language, t } = useLanguage();
  const palette = getReaderThemePalette(settings);
  const navItems: Array<{ view: AppView; label: string; icon: ComponentType<{ className?: string }> }> = [
    { view: 'library', label: t.sidebar.library, icon: BookOpen },
    { view: 'knowledge-hub', label: t.sidebar.knowledgeHub, icon: Brain },
    { view: 'book-advisor', label: language === 'ru' ? 'Книжный советник' : 'Book Advisor', icon: Sparkles },
    { view: 'settings', label: t.sidebar.settings, icon: Settings }
  ];

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
        <p className="text-lg font-semibold tracking-tight">{t.sidebar.title}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label={t.sidebar.navigationLabel}>
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
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
