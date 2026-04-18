import * as React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type {
  EpubFontFamily,
  EpubMarginSize,
  PdfZoomPreset,
  ReaderSettings,
  ReaderTheme,
  TextSizePreset
} from '../../shared/ipc';
import { cn } from '@/lib/utils';
import type { ReaderThemePalette } from '@/lib/reader-theme';
import { ReaderSidePanel } from '@/components/reader/ReaderSidePanel';

const THEMES: Array<{ value: ReaderTheme; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'dark', label: 'Dark' }
];

const EPUB_MARGINS: Array<{ value: EpubMarginSize; label: string }> = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
];

const EPUB_FONTS: Array<{ value: EpubFontFamily; label: string; detail: string }> = [
  { value: 'serif', label: 'Serif', detail: 'Bookish default' },
  { value: 'sans', label: 'Sans', detail: 'Clean and modern' },
  { value: 'georgia', label: 'Georgia-like', detail: 'Classic editorial' },
  { value: 'openDyslexic', label: 'OpenDyslexic', detail: 'Future-ready stack' }
];

const PDF_ZOOM_PRESETS: Array<{ value: PdfZoomPreset; label: string }> = [
  { value: 'fitWidth', label: 'Fit Width' },
  { value: 'fitPage', label: 'Fit Page' },
  { value: 'actualSize', label: '100%' }
];

const TEXT_SIZE_PRESETS: Array<{ value: TextSizePreset; label: string; detail: string }> = [
  { value: 'normal', label: 'Normal', detail: 'Current default sizing' },
  { value: 'large', label: 'Large', detail: '+15% content and UI text' },
  { value: 'extraLarge', label: 'Extra Large', detail: '+30% content and UI text' }
];

type Props = {
  open: boolean;
  format: 'pdf' | 'epub' | 'fb2';
  settings: ReaderSettings;
  onClose: () => void;
  onChange: (patch: Partial<ReaderSettings>) => void;
  palette: ReaderThemePalette;
  className?: string;
};

function Section({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const isFlowFormat = format === 'epub' || format === 'fb2';

  return (
    <section className="space-y-3 rounded-2xl border p-4 backdrop-blur-sm" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs leading-5 opacity-80">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ReaderSettingsPanel({
  open,
  format,
  settings,
  onClose,
  onChange,
  palette,
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

  const chipStyles = (active: boolean): React.CSSProperties => ({
    ...(active
      ? {
          backgroundColor: palette.accentBg,
          borderColor: palette.accentBorder,
          color: palette.accentText,
          boxShadow: `0 10px 24px -18px ${palette.accentBorder}`
        }
      : {
          backgroundColor: palette.buttonBg,
          borderColor: palette.buttonBorder,
          color: palette.buttonText
        }),
    transition: settings.reduceMotion ? 'none' : 'all 180ms ease'
  });

  const renderToggle = (
    label: string,
    description: string,
    value: boolean,
    key: 'dyslexiaFriendlyMode' | 'highContrastMode' | 'reduceMotion'
  ) => (
    <button
      type="button"
      aria-pressed={value}
      className="flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left"
      style={chipStyles(value)}
      onClick={() => onChange({ [key]: !value } as Partial<ReaderSettings>)}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] leading-5 opacity-80">{description}</p>
      </div>
      <span
        className="inline-flex min-w-16 items-center justify-center rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide"
        style={{
          borderColor: value ? palette.accentBorder : palette.buttonBorder,
          backgroundColor: value ? palette.accentBg : palette.buttonBg,
          color: value ? palette.accentText : palette.buttonText
        }}
      >
        {value ? 'On' : 'Off'}
      </span>
    </button>
  );

  return (
    <ReaderSidePanel
      title="Reader Settings"
      settings={settings}
      open={open}
      onClose={onClose}
      icon={<SlidersHorizontal className="h-4 w-4" />}
      widthClassName="w-[332px]"
      className={cn('backdrop-blur-xl', className)}
    >
      <div className="space-y-4 p-1">
        <Section title="Theme" description="Shared reader chrome for PDF, EPUB, and FB2.">
          <div
            className="grid grid-cols-3 gap-2 rounded-2xl border p-1.5"
            style={{ borderColor: palette.chromeBorder, backgroundColor: palette.accentBg }}
          >
            {THEMES.map((theme) => {
              const active = settings.theme === theme.value;
              return (
                <button
                  key={theme.value}
                  type="button"
                  className="rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200"
                  style={chipStyles(active)}
                  onClick={() => onChange({ theme: theme.value })}
                >
                  {theme.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          title="Typography"
          description={
            isFlowFormat
              ? 'Live flow-reader typography adjustments for comfort and focus.'
              : 'Typography controls become active when you open an EPUB or FB2 book.'
          }
        >
          <div className={cn('space-y-4 transition-opacity duration-200', isFlowFormat ? 'opacity-100' : 'opacity-50')}>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs" style={{ color: palette.mutedText }}>
                <span>Font Size</span>
                <span>{settings.epubFontSize}%</span>
              </div>
              <input
                type="range"
                min={80}
                max={180}
                step={10}
                value={draftFontSize}
                disabled={!isFlowFormat}
                onInput={(event) => {
                  const value = Number((event.target as HTMLInputElement).value);
                  setDraftFontSize(value);
                  onChange({ epubFontSize: value });
                }}
                onChange={(event) => setDraftFontSize(Number(event.target.value))}
                className="reader-range w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs" style={{ color: palette.mutedText }}>
                <span>Line Height</span>
                <span>{settings.epubLineHeight.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={1.2}
                max={2.4}
                step={0.1}
                value={draftLineHeight}
                disabled={!isFlowFormat}
                onInput={(event) => {
                  const value = Number((event.target as HTMLInputElement).value);
                  setDraftLineHeight(value);
                  onChange({ epubLineHeight: value });
                }}
                onChange={(event) => setDraftLineHeight(Number(event.target.value))}
                className="reader-range w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium" style={{ color: palette.mutedText }}>
                Margins
              </div>
              <div
                className="grid grid-cols-3 gap-2 rounded-2xl border p-1.5"
                style={{ borderColor: palette.chromeBorder, backgroundColor: palette.accentBg }}
              >
                {EPUB_MARGINS.map((option) => {
                  const active = settings.epubMargins === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                  disabled={!isFlowFormat}
                      className="rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed"
                      style={chipStyles(active)}
                      onClick={() => onChange({ epubMargins: option.value })}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium" style={{ color: palette.mutedText }}>
                Font Family
              </div>
              <div className="grid grid-cols-2 gap-2">
                {EPUB_FONTS.map((font) => {
                  const active = settings.epubFontFamily === font.value;
                  return (
                    <button
                      key={font.value}
                      type="button"
                  disabled={!isFlowFormat}
                      className="rounded-2xl border px-3 py-3 text-left transition-all duration-200 disabled:cursor-not-allowed"
                      style={chipStyles(active)}
                      onClick={() => onChange({ epubFontFamily: font.value })}
                    >
                      <span className="block text-sm font-medium">{font.label}</span>
                      <span className="mt-1 block text-[11px] opacity-70">{font.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Accessibility"
          description="Inclusive reading support across EPUB content and the reader interface."
        >
          <div className="space-y-3">
            {renderToggle(
              'Dyslexia Friendly Mode',
              'Uses a dyslexia-friendly font stack, adds spacing, and relaxes line height for easier tracking.',
              settings.dyslexiaFriendlyMode,
              'dyslexiaFriendlyMode'
            )}
            {renderToggle(
              'High Contrast Mode',
              'Overrides the standard theme with stronger contrast, borders, and clearer controls.',
              settings.highContrastMode,
              'highContrastMode'
            )}
            <div className="space-y-2">
              <div className="text-xs font-medium" style={{ color: palette.mutedText }}>
                Text Size Preset
              </div>
              <div className="grid grid-cols-1 gap-2">
                {TEXT_SIZE_PRESETS.map((preset) => {
                  const active = settings.textSizePreset === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      className="rounded-2xl border px-3 py-3 text-left"
                      style={chipStyles(active)}
                      onClick={() => onChange({ textSizePreset: preset.value })}
                    >
                      <span className="block text-sm font-medium">{preset.label}</span>
                      <span className="mt-1 block text-[11px] opacity-75">{preset.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {renderToggle(
              'Reduce Motion',
              'Turns off transitions, animations, and smooth scrolling where possible.',
              settings.reduceMotion,
              'reduceMotion'
            )}
          </div>
        </Section>

        <Section
          title="PDF Display"
          description={
            format === 'pdf'
              ? 'Set the page shell mood and default page fitting.'
              : 'PDF display controls become active when you open a PDF.'
          }
        >
          <div className={cn('space-y-4 transition-opacity duration-200', format === 'pdf' ? 'opacity-100' : 'opacity-50')}>
            <div className="space-y-2">
              <div className="text-xs font-medium" style={{ color: palette.mutedText }}>
                Background Around Page
              </div>
              <div
                className="grid grid-cols-3 gap-2 rounded-2xl border p-1.5"
                style={{ borderColor: palette.chromeBorder, backgroundColor: palette.accentBg }}
              >
                {THEMES.map((theme) => {
                  const active = settings.pdfBackground === theme.value;
                  return (
                    <button
                      key={theme.value}
                      type="button"
                      disabled={format !== 'pdf'}
                      className="rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed"
                      style={chipStyles(active)}
                      onClick={() => onChange({ pdfBackground: theme.value })}
                    >
                      {theme.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium" style={{ color: palette.mutedText }}>
                Zoom Preset
              </div>
              <div className="grid grid-cols-1 gap-2">
                {PDF_ZOOM_PRESETS.map((preset) => {
                  const active = settings.pdfZoomPreset === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      disabled={format !== 'pdf'}
                      className="rounded-2xl border px-3 py-3 text-left text-sm transition-all duration-200 disabled:cursor-not-allowed"
                      style={chipStyles(active)}
                      onClick={() => onChange({ pdfZoomPreset: preset.value })}
                    >
                      <span className="font-medium">{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </ReaderSidePanel>
  );
}
