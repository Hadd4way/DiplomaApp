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
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { getReaderThemePalette } from '@/lib/reader-theme';
import { READER_SETTINGS_DEFAULTS } from '../../shared/ipc';

type ToggleRowProps = {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const SettingCard = React.memo(function SettingCard({
  title,
  description,
  children,
  palette
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  palette: ReturnType<typeof getReaderThemePalette>;
}) {
  return (
    <Card
      style={{
        backgroundColor: palette.panelBg,
        borderColor: palette.chromeBorder,
        color: palette.chromeText
      }}
    >
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
});

const ToggleRow = React.memo(function ToggleRow({ title, description, checked, onChange }: ToggleRowProps) {
  const { settings } = useReaderSettings();
  const palette = getReaderThemePalette(settings);

  return (
    <label
      className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3"
      style={{
        borderColor: palette.chromeBorder,
        backgroundColor: palette.panelHoverBg
      }}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded"
        checked={checked}
        aria-label={title}
        onChange={(event) => onChange(event.target.checked)}
        style={{
          accentColor: palette.focusRing,
          backgroundColor: palette.inputBg,
          borderColor: palette.buttonBorder
        }}
      />
    </label>
  );
});

export function SettingsScreen() {
  const { settings, loading, error, updateSettings } = useReaderSettings();
  const { language, setLanguage, t } = useLanguage();
  const palette = getReaderThemePalette(settings);
  const THEME_OPTIONS: Array<{ value: ReaderTheme; label: string; description: string }> = [
    { value: 'light', label: t.settings.themeLight, description: t.settings.themeLightDescription },
    { value: 'sepia', label: t.settings.themeSepia, description: t.settings.themeSepiaDescription },
    { value: 'dark', label: t.settings.themeDark, description: t.settings.themeDarkDescription }
  ];
  const TEXT_SIZE_OPTIONS: Array<{ value: TextSizePreset; label: string }> = [
    { value: 'normal', label: t.settings.textSizeNormal },
    { value: 'large', label: t.settings.textSizeLarge },
    { value: 'extraLarge', label: t.settings.textSizeExtraLarge }
  ];
  const EPUB_MARGIN_OPTIONS: Array<{ value: EpubMarginSize; label: string }> = [
    { value: 'small', label: t.settings.marginSmall },
    { value: 'medium', label: t.settings.marginMedium },
    { value: 'large', label: t.settings.marginLarge }
  ];
  const EPUB_FONT_OPTIONS: Array<{ value: EpubFontFamily; label: string }> = [
    { value: 'serif', label: t.settings.fontSerif },
    { value: 'sans', label: t.settings.fontSans },
    { value: 'georgia', label: t.settings.fontGeorgia },
    { value: 'openDyslexic', label: t.settings.fontOpenDyslexic }
  ];
  const PDF_ZOOM_OPTIONS: Array<{ value: PdfZoomPreset; label: string }> = [
    { value: 'fitWidth', label: t.settings.zoomFitWidth },
    { value: 'fitPage', label: t.settings.zoomFitPage },
    { value: 'actualSize', label: t.settings.zoomActualSize }
  ];

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
              <CardTitle className="text-3xl">{t.settings.title}</CardTitle>
              <CardDescription className="max-w-2xl">
                {t.settings.description}
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={() => updateSettings(READER_SETTINGS_DEFAULTS)}>
              {t.settings.resetDefaults}
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-md border border-border bg-background/70 px-3 py-2">
              <span className="font-medium">{t.settings.status}:</span>{' '}
              {loading ? t.settings.loading : t.settings.ready}
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                {error}
              </div>
            ) : (
              <div className="text-muted-foreground">
                {t.settings.themeSummary}: {THEME_OPTIONS.find((option) => option.value === settings.theme)?.label}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <SettingCard title={t.settings.languageTitle} description={t.settings.languageDescription} palette={palette}>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={language === 'ru' ? 'default' : 'outline'} onClick={() => setLanguage('ru')}>
                  {t.settings.languageRu}
                </Button>
                <Button type="button" variant={language === 'en' ? 'default' : 'outline'} onClick={() => setLanguage('en')}>
                  {t.settings.languageEn}
                </Button>
              </div>
            </SettingCard>

            <SettingCard title={t.settings.appearanceTitle} description={t.settings.appearanceDescription} palette={palette}>
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
                        'rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      )}
                      style={{
                        borderColor: active ? palette.accentBorder : palette.chromeBorder,
                        backgroundColor: active ? palette.accentBg : palette.panelHoverBg,
                        color: active ? palette.accentText : palette.chromeText
                      }}
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
                  <p className="text-sm font-medium">{t.settings.interfaceTextSizeTitle}</p>
                  <p className="text-sm text-muted-foreground">{t.settings.interfaceTextSizeDescription}</p>
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

            <SettingCard title={t.settings.flowReadingTitle} description={t.settings.flowReadingDescription} palette={palette}>
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="epub-font-family">
                    {t.settings.fontFamily}
                  </label>
                  <select
                    id="epub-font-family"
                    className="h-10 w-full rounded-md border px-3 text-sm"
                    value={settings.epubFontFamily}
                    onChange={(event) => updateSettings({ epubFontFamily: event.target.value as EpubFontFamily })}
                    style={{
                      borderColor: palette.buttonBorder,
                      backgroundColor: palette.inputBg,
                      color: palette.inputText
                    }}
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
                    {t.settings.margins}
                  </label>
                  <select
                    id="epub-margins"
                    className="h-10 w-full rounded-md border px-3 text-sm"
                    value={settings.epubMargins}
                    onChange={(event) => updateSettings({ epubMargins: event.target.value as EpubMarginSize })}
                    style={{
                      borderColor: palette.buttonBorder,
                      backgroundColor: palette.inputBg,
                      color: palette.inputText
                    }}
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
                      {t.settings.fontSize}
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
                      {t.settings.lineHeight}
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
            <SettingCard title={t.settings.pdfTitle} description={t.settings.pdfDescription} palette={palette}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="pdf-background">
                  {t.settings.backgroundTheme}
                </label>
                <select
                  id="pdf-background"
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={settings.pdfBackground}
                  onChange={(event) => updateSettings({ pdfBackground: event.target.value as ReaderTheme })}
                  style={{
                    borderColor: palette.buttonBorder,
                    backgroundColor: palette.inputBg,
                    color: palette.inputText
                  }}
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
                  {t.settings.defaultZoom}
                </label>
                <select
                  id="pdf-zoom"
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={settings.pdfZoomPreset}
                  onChange={(event) => updateSettings({ pdfZoomPreset: event.target.value as PdfZoomPreset })}
                  style={{
                    borderColor: palette.buttonBorder,
                    backgroundColor: palette.inputBg,
                    color: palette.inputText
                  }}
                >
                  {PDF_ZOOM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </SettingCard>

            <SettingCard title={t.settings.accessibilityTitle} description={t.settings.accessibilityDescription} palette={palette}>
              <div className="space-y-3">
                <ToggleRow
                  title={t.settings.dyslexiaFriendlyMode}
                  description={t.settings.dyslexiaFriendlyModeDescription}
                  checked={settings.dyslexiaFriendlyMode}
                  onChange={(checked) => updateSettings({ dyslexiaFriendlyMode: checked })}
                />
                <ToggleRow
                  title={t.settings.highContrastMode}
                  description={t.settings.highContrastModeDescription}
                  checked={settings.highContrastMode}
                  onChange={(checked) => updateSettings({ highContrastMode: checked })}
                />
                <ToggleRow
                  title={t.settings.reduceMotion}
                  description={t.settings.reduceMotionDescription}
                  checked={settings.reduceMotion}
                  onChange={(checked) => updateSettings({ reduceMotion: checked })}
                />
              </div>
            </SettingCard>

            <SettingCard title={t.settings.currentProfileTitle} description={t.settings.currentProfileDescription} palette={palette}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border px-4 py-3" style={{ borderColor: palette.chromeBorder, backgroundColor: palette.panelHoverBg }}>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.settings.profileTheme}</p>
                  <p className="mt-2 text-lg font-semibold">{settings.highContrastMode ? t.settings.highContrastProfile : THEME_OPTIONS.find((option) => option.value === settings.theme)?.label}</p>
                </div>
                <div className="rounded-lg border px-4 py-3" style={{ borderColor: palette.chromeBorder, backgroundColor: palette.panelHoverBg }}>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.settings.profilePdfZoom}</p>
                  <p className="mt-2 text-lg font-semibold">{PDF_ZOOM_OPTIONS.find((option) => option.value === settings.pdfZoomPreset)?.label}</p>
                </div>
                <div className="rounded-lg border px-4 py-3" style={{ borderColor: palette.chromeBorder, backgroundColor: palette.panelHoverBg }}>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.settings.profileEpubFont}</p>
                  <p className="mt-2 text-lg font-semibold">{EPUB_FONT_OPTIONS.find((option) => option.value === settings.epubFontFamily)?.label}</p>
                </div>
                <div className="rounded-lg border px-4 py-3" style={{ borderColor: palette.chromeBorder, backgroundColor: palette.panelHoverBg }}>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.settings.profileTextSize}</p>
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
