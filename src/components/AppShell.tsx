import type { ReactNode } from 'react';
import { Sidebar, type AppView } from '@/components/Sidebar';

type Props = {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  children: ReactNode;
  contentClassName?: string;
};

export function AppShell({ currentView, onViewChange, children, contentClassName }: Props) {
  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background text-foreground">
      <Sidebar currentView={currentView} onViewChange={onViewChange} />
      <main className={['flex min-h-0 flex-1 overflow-hidden', contentClassName ?? 'p-6'].join(' ')}>
        {children}
      </main>
    </div>
  );
}
