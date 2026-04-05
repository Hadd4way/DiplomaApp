import * as React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { ReaderSettings, ReaderTheme } from '../../shared/ipc';
import { cn } from '@/lib/utils';
import { getReaderButtonStyles, type ReaderThemePalette } from '@/lib/reader-theme';
import { ReaderSidePanel } from '@/components/reader/ReaderSidePanel';

const THEMES: Array<{ value: ReaderTheme; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'dark', label: 'Dark' }
];

type Props = {
  open: boolean;
  settings: ReaderSettings;
  onClose: () => void;
  onChange: (patch: Partial<ReaderSettings>) => void;
  palette: ReaderThemePalette;
  showEpubControls?: boolean;
  className?: string;
};

export function ReaderSettingsPanel({
  open,
  settings,
  onClose,
  onChange,
  palette,
  showEpubControls = true,
  className
}: Props) {
  const [draftFontSize, setDraftFontSize] = React.useState(settings.epubFontSize);
  const [draftLineHeight, setDraftLineHeight] = React.useState(settings.epubLineHeight);

  React.useEffect(() => {
    setDraftFontSize(settings.epubFontSize);
  }, [settings.epubFontSize]);

  React.useEffect(() => {
    setDraftLineHeight(settings.epubLineHeight);
  }, [settings.epubLineHeight]);

  if (!open) {
    return null;
  }

  return (
    <ReaderSidePanel
      title="Reader Settings"
      theme={settings.theme}
      open={open}
      onClose={onClose}
      icon={<SlidersHorizontal className="h-4 w-4" />}
      className={cn('', className)}
    >
      <div className="space-y-5 p-1">
        <section className="space-y-2">
          <div>
            <p className="text-sm font-semibold">Theme</p>
            <p className="text-xs" style={{ color: palette.mutedText }}>
              Applied to reader chrome in PDF and EPUB, plus EPUB content styling.
            </p>
          </div>
          <div
            className="grid grid-cols-3 gap-2 rounded-lg border p-1"
            style={{ borderColor: palette.chromeBorder, backgroundColor: palette.accentBg }}
          >
            {THEMES.map((theme) => {
              const active = settings.theme === theme.value;
              return (
                <button
                  key={theme.value}
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                  style={getReaderButtonStyles(theme.value, active)}
                  onClick={() => onChange({ theme: theme.value })}
                >
                  {theme.label}
                </button>
              );
            })}
          </div>
        </section>

        {showEpubControls ? (
          <>
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">EPUB Font Size</p>
                  <p className="text-xs" style={{ color: palette.mutedText }}>
                    {settings.epubFontSize}%
                  </p>
                </div>
                <div className="text-xs font-medium" style={{ color: palette.mutedText }}>
                  A- / A+
                </div>
              </div>
              <input
                type="range"
                min={80}
                max={180}
                step={10}
                value={draftFontSize}
                onInput={(event) => {
                  const value = Number((event.target as HTMLInputElement).value);
                  setDraftFontSize(value);
                  onChange({ epubFontSize: value });
                }}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setDraftFontSize(value);
                }}
                className="w-full accent-blue-600"
              />
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">EPUB Line Height</p>
                  <p className="text-xs" style={{ color: palette.mutedText }}>
                    {settings.epubLineHeight.toFixed(1)}
                  </p>
                </div>
              </div>
              <input
                type="range"
                min={1.2}
                max={2.4}
                step={0.1}
                value={draftLineHeight}
                onInput={(event) => {
                  const value = Number((event.target as HTMLInputElement).value);
                  setDraftLineHeight(value);
                  onChange({ epubLineHeight: value });
                }}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setDraftLineHeight(value);
                }}
                className="w-full accent-blue-600"
              />
            </section>
          </>
        ) : (
          <section className="space-y-2">
            <p className="text-sm font-semibold">EPUB Typography</p>
            <p className="text-xs" style={{ color: palette.mutedText }}>
              Font size and line height are available only while reading EPUB files.
            </p>
          </section>
        )}
      </div>
    </ReaderSidePanel>
  );
}
