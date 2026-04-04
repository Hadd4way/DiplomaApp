import { BookOpen, Download, FileText, Settings } from 'lucide-react';
import type { ComponentType } from 'react';

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
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-card p-4">
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
              className={[
                'flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
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

      <div className="mt-4 space-y-3 border-t pt-4">
        <button
          type="button"
          className="w-full rounded-md border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
          onClick={() => onViewChange('settings')}
        >
          App settings
        </button>
      </div>
    </aside>
  );
}
