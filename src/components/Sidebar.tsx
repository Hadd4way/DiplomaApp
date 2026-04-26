import { BookOpen, Brain, Bookmark, Settings, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getReaderThemePalette } from '@/lib/reader-theme';

export type AppView = 'library' | 'import' | 'notes' | 'insights' | 'recommendations' | 'wishlist' | 'settings';

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
    { view: 'insights', label: t.sidebar.knowledgeHub, icon: Brain },
    { view: 'recommendations', label: language === 'ru' ? 'Рекомендации' : 'Recommendations', icon: Sparkles },
    { view: 'wishlist', label: language === 'ru' ? 'Вишлист' : 'Wishlist', icon: Bookmark },
    { view: 'settings', label: t.sidebar.settings, icon: Settings }
  ];

  return (
    <aside
      className="flex max-h-[42dvh] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b px-3 py-3 lg:h-full lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r lg:px-4 lg:pb-4 lg:pt-5"
      style={{
        backgroundColor: palette.panelBg,
        borderColor: palette.chromeBorder,
        color: palette.chromeText
      }}
    >
      <div className="mb-3 flex shrink-0 items-center gap-3 px-1 lg:mb-8 lg:block lg:space-y-2 lg:px-2">
        <div
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm"
          style={{
            backgroundColor: palette.accentBg,
            borderColor: palette.accentBorder,
            color: palette.accentText
          }}
        >
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold tracking-tight">{t.sidebar.title}</p>
          <p className="text-xs uppercase tracking-[0.22em]" style={{ color: palette.mutedText }}>
            Desktop Reader
          </p>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 gap-1.5 overflow-x-auto overflow-y-hidden pb-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0" aria-label={t.sidebar.navigationLabel}>
        {navItems.map((item) => {
          const isActive = item.view === currentView;
          const Icon = item.icon;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onViewChange(item.view)}
              className="surface-hover group relative flex min-h-[50px] min-w-[11rem] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-w-0"
              style={
                isActive
                  ? {
                      backgroundColor: palette.accentBg,
                      color: palette.accentText,
                      borderColor: palette.accentBorder,
                      boxShadow: `0 14px 30px -24px ${palette.accentBorder}`
                    }
                  : {
                      color: palette.chromeText,
                      borderColor: 'transparent'
                    }
              }
              aria-current={isActive ? 'page' : undefined}
              onMouseEnter={(event) => {
                if (!isActive) {
                  event.currentTarget.style.backgroundColor = palette.panelHoverBg;
                  event.currentTarget.style.borderColor = palette.chromeBorder;
                }
              }}
              onMouseLeave={(event) => {
                if (!isActive) {
                  event.currentTarget.style.backgroundColor = 'transparent';
                  event.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors"
                style={{
                  backgroundColor: isActive ? palette.buttonBg : 'transparent',
                  borderColor: isActive ? palette.accentBorder : palette.chromeBorder,
                  color: isActive ? palette.accentText : palette.mutedText
                }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
              {isActive ? (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: palette.accentText }}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
