import * as React from 'react';
import type {
  EpubFontFamily,
  EpubMarginSize,
  PdfZoomPreset,
  ReaderTheme,
  TextSizePreset
} from '../../shared/ipc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { cn } from '@/lib/utils';
import { getReaderThemePalette } from '@/lib/reader-theme';
import { READER_SETTINGS_DEFAULTS } from '../../shared/ipc';

const THEME_OPTIONS: Array<{ value: ReaderTheme; label: string; description: string }> = [
  { value: 'light', label: 'Light', description: 'Bright workspace with neutral contrast.' },
  { value: 'sepia', label: 'Sepia', description: 'Warm paper-like colors for longer sessions.' },
  { value: 'dark', label: 'Dark', description: 'Low-glare reading for evening work.' }
];

const TEXT_SIZE_OPTIONS: Array<{ value: TextSizePreset; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'extraLarge', label: 'Extra large' }
];

const EPUB_MARGIN_OPTIONS: Array<{ value: EpubMarginSize; label: string }> = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
];

const EPUB_FONT_OPTIONS: Array<{ value: EpubFontFamily; label: string }> = [
  { value: 'serif', label: 'Serif' },
  { value: 'sans', label: 'Sans' },
  { value: 'georgia', label: 'Georgia' },
  { value: 'openDyslexic', label: 'OpenDyslexic' }
];

const PDF_ZOOM_OPTIONS: Array<{ value: PdfZoomPreset; label: string }> = [
  { value: 'fitWidth', label: 'Fit width' },
  { value: 'fitPage', label: 'Fit page' },
  { value: 'actualSize', label: 'Actual size' }
];

type ToggleRowProps = {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function SettingCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function ToggleRow({ title, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background/60 px-4 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-input"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function SettingsScreen() {
  const { settings, loading, error, updateSettings } = useReaderSettings();
  const palette = getReaderThemePalette(settings);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 overflow-auto">
      <div className="w-full space-y-6 pb-8">
        <Card
          className="border"
          style={{
            background: `linear-gradient(135deg, ${palette.panelBg} 0%, ${palette.appBg} 100%)`,
            borderColor: palette.chromeBorder,
            color: palette.chromeText
          }}
        >
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-3xl">Settings</CardTitle>
              <CardDescription className="max-w-2xl">
                Configure the reading experience for EPUB, FB2, TXT, and PDF. Changes are applied immediately and saved automatically.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={() => updateSettings(READER_SETTINGS_DEFAULTS)}>
              Reset defaults
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-md border border-border bg-background/70 px-3 py-2">
              <span className="font-medium">Status:</span>{' '}
              {loading ? 'Loading settings...' : 'Settings are ready'}
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                {error}
              </div>
            ) : (
              <div className="text-muted-foreground">Reader theme: {settings.theme}</div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <SettingCard title="Appearance" description="Pick the global look and the default text scale for the app UI.">
              <div className="grid gap-3 md:grid-cols-3">
                {THEME_OPTIONS.map((option) => {
                  const optionPalette = getReaderThemePalette(option.value);
                  const active = settings.theme === option.value && !settings.highContrastMode;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateSettings({ theme: option.value })}
                      className={cn(
                        'rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-accent/60'
                      )}
                    >
                      <div className="mb-4 flex gap-2">
                        <span className="h-6 w-6 rounded-full border" style={{ backgroundColor: optionPalette.appBg, borderColor: optionPalette.chromeBorder }} />
                        <span className="h-6 w-6 rounded-full border" style={{ backgroundColor: optionPalette.panelBg, borderColor: optionPalette.chromeBorder }} />
                        <span className="h-6 w-6 rounded-full border" style={{ backgroundColor: optionPalette.accentBg, borderColor: optionPalette.accentBorder }} />
                      </div>
                      <p className="font-medium">{option.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Interface text size</p>
                  <p className="text-sm text-muted-foreground">Scales menus, controls, and reading interface labels.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TEXT_SIZE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={settings.textSizePreset === option.value ? 'default' : 'outline'}
                      onClick={() => updateSettings({ textSizePreset: option.value })}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </SettingCard>

            <SettingCard title="Flow Reading" description="Defaults for EPUB, FB2, and TXT books with reflowable text.">
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="epub-font-family">
                    Font family
                  </label>
                  <select
                    id="epub-font-family"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={settings.epubFontFamily}
                    onChange={(event) => updateSettings({ epubFontFamily: event.target.value as EpubFontFamily })}
                  >
                    {EPUB_FONT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="epub-margins">
                    Margins
                  </label>
                  <select
                    id="epub-margins"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={settings.epubMargins}
                    onChange={(event) => updateSettings({ epubMargins: event.target.value as EpubMarginSize })}
                  >
                    {EPUB_MARGIN_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium" htmlFor="epub-font-size">
                      Font size
                    </label>
                    <span className="text-sm text-muted-foreground">{settings.epubFontSize}%</span>
                  </div>
                  <input
                    id="epub-font-size"
                    type="range"
                    min={80}
                    max={160}
                    step={10}
                    value={settings.epubFontSize}
                    className="w-full"
                    onChange={(event) => updateSettings({ epubFontSize: Number(event.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium" htmlFor="epub-line-height">
                      Line height
                    </label>
                    <span className="text-sm text-muted-foreground">{settings.epubLineHeight.toFixed(1)}</span>
                  </div>
                  <input
                    id="epub-line-height"
                    type="range"
                    min={1.2}
                    max={2.2}
                    step={0.1}
                    value={settings.epubLineHeight}
                    className="w-full"
                    onChange={(event) => updateSettings({ epubLineHeight: Number(event.target.value) })}
                  />
                </div>
              </div>
            </SettingCard>
          </div>

          <div className="space-y-6">
            <SettingCard title="PDF" description="Choose how PDF documents open by default.">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="pdf-background">
                  Background theme
                </label>
                <select
                  id="pdf-background"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={settings.pdfBackground}
                  onChange={(event) => updateSettings({ pdfBackground: event.target.value as ReaderTheme })}
                >
                  {THEME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="pdf-zoom">
                  Default zoom
                </label>
                <select
                  id="pdf-zoom"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={settings.pdfZoomPreset}
                  onChange={(event) => updateSettings({ pdfZoomPreset: event.target.value as PdfZoomPreset })}
                >
                  {PDF_ZOOM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </SettingCard>

            <SettingCard title="Accessibility" description="Improve readability and reduce visual strain.">
              <div className="space-y-3">
                <ToggleRow
                  title="Dyslexia friendly mode"
                  description="Uses a dyslexia-oriented UI font and increases spacing in reflowable text."
                  checked={settings.dyslexiaFriendlyMode}
                  onChange={(checked) => updateSettings({ dyslexiaFriendlyMode: checked })}
                />
                <ToggleRow
                  title="High contrast mode"
                  description="Overrides the theme with maximum contrast across the app."
                  checked={settings.highContrastMode}
                  onChange={(checked) => updateSettings({ highContrastMode: checked })}
                />
                <ToggleRow
                  title="Reduce motion"
                  description="Disables extra movement and keeps transitions minimal."
                  checked={settings.reduceMotion}
                  onChange={(checked) => updateSettings({ reduceMotion: checked })}
                />
              </div>
            </SettingCard>

            <SettingCard title="Current Profile" description="Quick summary of the active reader setup.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Theme</p>
                  <p className="mt-2 text-lg font-semibold capitalize">{settings.highContrastMode ? 'High contrast' : settings.theme}</p>
                </div>
                <div className="rounded-lg border border-border px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">PDF zoom</p>
                  <p className="mt-2 text-lg font-semibold">{PDF_ZOOM_OPTIONS.find((option) => option.value === settings.pdfZoomPreset)?.label}</p>
                </div>
                <div className="rounded-lg border border-border px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">EPUB font</p>
                  <p className="mt-2 text-lg font-semibold">{EPUB_FONT_OPTIONS.find((option) => option.value === settings.epubFontFamily)?.label}</p>
                </div>
                <div className="rounded-lg border border-border px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Text size</p>
                  <p className="mt-2 text-lg font-semibold">{TEXT_SIZE_OPTIONS.find((option) => option.value === settings.textSizePreset)?.label}</p>
                </div>
              </div>
            </SettingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
