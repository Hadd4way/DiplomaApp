import * as React from 'react';
import type { ReactNode } from 'react';
import type { ReaderSettings } from '../../../shared/ipc';
import { cn } from '@/lib/utils';
import { getReaderThemePalette, getReaderThemeStyles } from '@/lib/reader-theme';

export type ReaderShellProps = {
  title: string;
  settings: ReaderSettings;
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  headerStatus?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  rootRef?: React.Ref<HTMLDivElement>;
  rootTabIndex?: number;
  leftPanelWidthClassName?: string;
  mainClassName?: string;
  viewportClassName?: string;
};

function ReaderShellComponent({
  title,
  settings,
  leftPanel,
  rightPanel,
  headerLeft,
  headerRight,
  headerStatus,
  footer,
  children,
  rootRef,
  rootTabIndex,
  leftPanelWidthClassName = 'w-[320px]',
  mainClassName,
  viewportClassName
}: ReaderShellProps) {
  const palette = React.useMemo(() => getReaderThemePalette(settings), [settings]);

  return (
    <div
      ref={rootRef}
      tabIndex={rootTabIndex}
      className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden"
      style={getReaderThemeStyles(settings)}
    >
      <header
        className="shrink-0 border-b backdrop-blur-xl"
        style={{
          backgroundColor: palette.chromeBg,
          borderColor: palette.chromeBorder,
          color: palette.chromeText
        }}
      >
        <div className="flex min-h-[68px] flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">{headerLeft}</div>
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-sm font-semibold tracking-tight">{title}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">{headerRight}</div>
        </div>
        {headerStatus ? <div className="px-4 pb-3">{headerStatus}</div> : null}
      </header>

      <main className={cn('flex w-full flex-1 min-h-0 min-w-0', mainClassName)}>
        {leftPanel ? (
          <aside
            className={cn('h-full shrink-0 border-r backdrop-blur-xl', leftPanelWidthClassName)}
            style={{
              backgroundColor: palette.panelBg,
              borderColor: palette.chromeBorder,
              color: palette.chromeText
            }}
          >
            {leftPanel}
          </aside>
        ) : null}

        <div className={cn('relative flex min-h-0 min-w-0 flex-1 basis-0', viewportClassName)}>
          {children}
          {rightPanel}
        </div>
      </main>

      {footer ? (
        <footer
          className="shrink-0 border-t px-4 py-3 backdrop-blur-xl"
          style={{
            backgroundColor: palette.chromeBg,
            borderColor: palette.chromeBorder,
            color: palette.chromeText
          }}
        >
          {footer}
        </footer>
      ) : null}
    </div>
  );
}

export const ReaderShell = React.memo(ReaderShellComponent);
