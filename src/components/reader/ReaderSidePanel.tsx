import * as React from 'react';
import type { ReactNode } from 'react';
import type { ReaderSettings } from '../../../shared/ipc';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getReaderButtonStyles, getReaderThemePalette } from '@/lib/reader-theme';

type Props = {
  title: string;
  settings: ReaderSettings;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  icon?: ReactNode;
  className?: string;
  widthClassName?: string;
  rightOffset?: number;
  headerActions?: ReactNode;
};

export function ReaderSidePanel({
  title,
  settings,
  children,
  open,
  onClose,
  icon,
  className,
  widthClassName = 'w-[320px]',
  rightOffset = 12,
  headerActions
}: Props) {
  const palette = React.useMemo(() => getReaderThemePalette(settings), [settings]);

  if (!open) {
    return null;
  }

  return (
    <aside
      className={cn(
        'absolute top-3 bottom-3 z-40 flex flex-col rounded-lg border shadow-xl pointer-events-auto',
        widthClassName,
        className
      )}
      style={{
        right: `${rightOffset}px`,
        backgroundColor: palette.panelBg,
        borderColor: palette.chromeBorder,
        color: palette.chromeText,
        boxShadow: palette.shadow
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2" style={{ borderColor: palette.chromeBorder }}>
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <p className="truncate text-sm font-semibold">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          <Button type="button" size="sm" variant="outline" onClick={onClose} style={getReaderButtonStyles(settings)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </aside>
  );
}
