import { BookOpen, Download, FileText, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ComponentType } from 'react';
import type { User } from '../../shared/ipc';

export type AppView = 'library' | 'import' | 'notes' | 'settings';

type Props = {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  user: User;
  loading: boolean;
  onSignOut: () => void;
};

const navItems: Array<{ view: AppView; label: string; icon: ComponentType<{ className?: string }> }> = [
  { view: 'library', label: 'Library', icon: BookOpen },
  { view: 'import', label: 'Import', icon: Download },
  { view: 'notes', label: 'Notes', icon: FileText },
  { view: 'settings', label: 'Settings', icon: Settings }
];

export function Sidebar({ currentView, onViewChange, user, loading, onSignOut }: Props) {
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
              {item.view === 'notes' || item.view === 'settings' ? (
                <span className="ml-auto text-[10px] uppercase tracking-wide opacity-80">Soon</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-4 space-y-3 border-t pt-4">
        <div>
          <p className="truncate text-sm font-medium">{user.displayName || user.email}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={onSignOut} disabled={loading}>
          Log out
        </Button>
      </div>
    </aside>
  );
}
