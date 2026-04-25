import * as React from 'react';
import { isNavigatorOnline } from '@/lib/network';

type NetworkStatusContextValue = {
  isOnline: boolean;
};

const NetworkStatusContext = React.createContext<NetworkStatusContextValue | null>(null);

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = React.useState(() => isNavigatorOnline());

  React.useEffect(() => {
    const updateStatus = () => {
      setIsOnline(isNavigatorOnline());
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const value = React.useMemo<NetworkStatusContextValue>(
    () => ({
      isOnline
    }),
    [isOnline]
  );

  return <NetworkStatusContext.Provider value={value}>{children}</NetworkStatusContext.Provider>;
}

export function useNetworkStatus() {
  const context = React.useContext(NetworkStatusContext);
  if (!context) {
    throw new Error('useNetworkStatus must be used within NetworkStatusProvider.');
  }

  return context;
}
