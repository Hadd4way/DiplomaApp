import * as React from 'react';
import type { ReactNode } from 'react';
import type { ReaderSettings } from '../../../shared/ipc';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
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

function ReaderSidePanelComponent({
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
  const { t } = useLanguage();
  const palette = React.useMemo(() => getReaderThemePalette(settings), [settings]);

  return (
    <aside
      className={cn(
        'absolute bottom-3 top-3 z-40 flex flex-col rounded-[1.35rem] border shadow-xl transition-all duration-200 pointer-events-auto',
        open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-4 opacity-0',
        widthClassName,
        className
      )}
      style={{
        right: `${rightOffset}px`,
        backgroundColor: palette.panelBg,
        borderColor: palette.chromeBorder,
        color: palette.chromeText,
        boxShadow: palette.shadow,
        visibility: open ? 'visible' : 'hidden'
      }}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: palette.chromeBorder }}>
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <p className="truncate text-sm font-semibold">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          <Button type="button" size="sm" variant="outline" onClick={onClose} style={getReaderButtonStyles(settings)} aria-label={t.notes.cancel} title={t.notes.cancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  );
}

export const ReaderSidePanel = React.memo(ReaderSidePanelComponent);
