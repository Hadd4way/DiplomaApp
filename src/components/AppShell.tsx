import type { ReactNode } from 'react';
import { Sidebar, type AppView } from '@/components/Sidebar';
import type { User } from '../../shared/ipc';

type Props = {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  user: User;
  loading: boolean;
  onSignOut: () => void;
  children: ReactNode;
};

export function AppShell({
  currentView,
  onViewChange,
  user,
  loading,
  onSignOut,
  children
}: Props) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar
        currentView={currentView}
        onViewChange={onViewChange}
        user={user}
        loading={loading}
        onSignOut={onSignOut}
      />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

