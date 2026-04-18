import type { CSSProperties } from 'react';
import type {
  EpubFontFamily,
  EpubMarginSize,
  ReaderSettings,
  TextSizePreset,
  ReaderTheme
} from '../../shared/ipc';

export type ReaderThemePalette = {
  appBg: string;
  appForeground: string;
  chromeBg: string;
  chromeBorder: string;
  chromeText: string;
  mutedText: string;
  panelBg: string;
  panelHoverBg: string;
  viewportBg: string;
  pageShellBg: string;
  buttonBg: string;
  buttonBorder: string;
  buttonText: string;
  inputBg: string;
  inputText: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  epubBodyBackground: string;
  epubBodyColor: string;
  focusRing: string;
  shadow: string;
};

const READER_THEME_PALETTES: Record<ReaderTheme, ReaderThemePalette> = {
  light: {
    appBg: '#f3f5f7',
    appForeground: '#1e293b',
    chromeBg: 'rgba(255,255,255,0.95)',
    chromeBorder: '#dbe3ec',
    chromeText: '#1e293b',
    mutedText: '#64748b',
    panelBg: '#ffffff',
    panelHoverBg: '#f8fafc',
    viewportBg: '#eef1f5',
    pageShellBg: '#eef1f5',
    buttonBg: '#ffffff',
    buttonBorder: '#cbd5e1',
    buttonText: '#334155',
    inputBg: '#ffffff',
    inputText: '#0f172a',
    accentBg: '#f8fafc',
    accentText: '#1e293b',
    accentBorder: '#cbd5e1',
    epubBodyBackground: '#fdfdfb',
    epubBodyColor: '#1f2937',
    focusRing: '#2563eb',
    shadow: '0 18px 40px -18px rgba(15,23,42,0.5)'
  },
  sepia: {
    appBg: '#f2eadf',
    appForeground: '#4b3725',
    chromeBg: 'rgba(249,242,230,0.96)',
    chromeBorder: '#d8c8b2',
    chromeText: '#4b3725',
    mutedText: '#7a624d',
    panelBg: '#fbf4e8',
    panelHoverBg: '#f5ead8',
    viewportBg: '#ece0cf',
    pageShellBg: '#eadbc5',
    buttonBg: '#fff9ef',
    buttonBorder: '#ccb79e',
    buttonText: '#5b4330',
    inputBg: '#fff9ef',
    inputText: '#4b3725',
    accentBg: '#f4e8d5',
    accentText: '#4b3725',
    accentBorder: '#ccb79e',
    epubBodyBackground: '#f6efe3',
    epubBodyColor: '#433224',
    focusRing: '#8b5e34',
    shadow: '0 18px 40px -18px rgba(91,67,48,0.35)'
  },
  dark: {
    appBg: '#111827',
    appForeground: '#e5edf7',
    chromeBg: 'rgba(17,24,39,0.94)',
    chromeBorder: '#334155',
    chromeText: '#e5edf7',
    mutedText: '#94a3b8',
    panelBg: '#172033',
    panelHoverBg: '#1e293b',
    viewportBg: '#0f172a',
    pageShellBg: '#111827',
    buttonBg: '#1e293b',
    buttonBorder: '#334155',
    buttonText: '#e2e8f0',
    inputBg: '#0f172a',
    inputText: '#f8fafc',
    accentBg: '#1e293b',
    accentText: '#f8fafc',
    accentBorder: '#475569',
    epubBodyBackground: '#111827',
    epubBodyColor: '#e5e7eb',
    focusRing: '#f8fafc',
    shadow: '0 18px 40px -18px rgba(0,0,0,0.75)'
  }
};

const HIGH_CONTRAST_PALETTE: ReaderThemePalette = {
  appBg: '#000000',
  appForeground: '#ffffff',
  chromeBg: '#000000',
  chromeBorder: '#ffffff',
  chromeText: '#ffffff',
  mutedText: '#d1d5db',
  panelBg: '#050505',
  panelHoverBg: '#111111',
  viewportBg: '#000000',
  pageShellBg: '#000000',
  buttonBg: '#0a0a0a',
  buttonBorder: '#ffffff',
  buttonText: '#ffffff',
  inputBg: '#000000',
  inputText: '#ffffff',
  accentBg: '#fff59d',
  accentText: '#000000',
  accentBorder: '#ffffff',
  epubBodyBackground: '#000000',
  epubBodyColor: '#ffffff',
  focusRing: '#fff59d',
  shadow: '0 0 0 2px rgba(255,255,255,0.32)'
};

const EPUB_MARGIN_VALUES: Record<EpubMarginSize, string> = {
  small: '1rem',
  medium: '1.75rem',
  large: '2.5rem'
};

const EPUB_FONT_STACKS: Record<EpubFontFamily, string> = {
  serif: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  sans: '"Aptos", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  openDyslexic: '"OpenDyslexic", "Atkinson Hyperlegible", "Segoe UI", Arial, sans-serif'
};

function isReaderSettings(value: ReaderTheme | ReaderSettings): value is ReaderSettings {
  return typeof value === 'object' && value !== null && 'theme' in value;
}

function resolveTheme(input: ReaderTheme | ReaderSettings): ReaderTheme {
  return isReaderSettings(input) ? input.theme : input;
}

function resolveSettings(input: ReaderTheme | ReaderSettings): Partial<ReaderSettings> {
  return isReaderSettings(input) ? input : {};
}

export function getReaderTextScaleMultiplier(preset: TextSizePreset): number {
  if (preset === 'large') {
    return 1.15;
  }
  if (preset === 'extraLarge') {
    return 1.3;
  }
  return 1;
}

export function getUiFontFamily(settings: Pick<ReaderSettings, 'dyslexiaFriendlyMode'>): string {
  if (settings.dyslexiaFriendlyMode) {
    return '"OpenDyslexic", "Atkinson Hyperlegible", "Segoe UI", Arial, sans-serif';
  }
  return '"Aptos", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
}

export function getEffectiveEpubFontFamily(settings: ReaderSettings): string {
  if (settings.dyslexiaFriendlyMode) {
    return getEpubFontFamilyStack('openDyslexic');
  }
  return getEpubFontFamilyStack(settings.epubFontFamily);
}

export function getReaderThemePalette(input: ReaderTheme | ReaderSettings): ReaderThemePalette {
  const settings = resolveSettings(input);
  if (settings.highContrastMode) {
    return HIGH_CONTRAST_PALETTE;
  }
  return READER_THEME_PALETTES[resolveTheme(input)];
}

export function getReaderThemeStyles(input: ReaderTheme | ReaderSettings): CSSProperties {
  const palette = getReaderThemePalette(input);
  const settings = resolveSettings(input);
  return {
    backgroundColor: palette.appBg,
    color: palette.appForeground,
    fontFamily: settings.dyslexiaFriendlyMode ? getUiFontFamily(settings as Pick<ReaderSettings, 'dyslexiaFriendlyMode'>) : undefined,
    fontSize: settings.textSizePreset ? `${getReaderTextScaleMultiplier(settings.textSizePreset)}rem` : undefined
  };
}

export function getReaderPanelStyles(input: ReaderTheme | ReaderSettings): CSSProperties {
  const palette = getReaderThemePalette(input);
  return {
    backgroundColor: palette.panelBg,
    borderColor: palette.chromeBorder,
    color: palette.chromeText
  };
}

export function getReaderButtonStyles(input: ReaderTheme | ReaderSettings, active = false): CSSProperties {
  const palette = getReaderThemePalette(input);
  if (active) {
    return {
      backgroundColor: palette.accentBg,
      borderColor: palette.accentBorder,
      color: palette.accentText
    };
  }
  return {
    backgroundColor: palette.buttonBg,
    borderColor: palette.buttonBorder,
    color: palette.buttonText
  };
}

export function getEpubMarginCssValue(margins: EpubMarginSize): string {
  return EPUB_MARGIN_VALUES[margins];
}

export function getEpubFontFamilyStack(fontFamily: EpubFontFamily): string {
  return EPUB_FONT_STACKS[fontFamily];
}

export function getPdfViewportBackground(input: ReaderTheme | ReaderSettings): string {
  return getReaderThemePalette(input).pageShellBg;
}

export function getEpubThemeBodyStyles(settings: ReaderSettings): Record<string, string> {
  const palette = getReaderThemePalette(settings);
  const scaleMultiplier = getReaderTextScaleMultiplier(settings.textSizePreset);
  const lineHeight = settings.dyslexiaFriendlyMode
    ? Math.min(2.8, Math.round((settings.epubLineHeight + 0.15) * 10) / 10)
    : settings.epubLineHeight;
  return {
    'line-height': `${lineHeight}`,
    'font-family': getEffectiveEpubFontFamily(settings),
    'letter-spacing': settings.dyslexiaFriendlyMode ? '0.035em' : 'normal',
    'word-spacing': settings.dyslexiaFriendlyMode ? '0.08em' : 'normal',
    'font-size': `${scaleMultiplier}rem`,
    background: palette.epubBodyBackground,
    color: palette.epubBodyColor
  };
}

export function getAppThemeCssVariables(input: ReaderTheme | ReaderSettings): Record<string, string> {
  const palette = getReaderThemePalette(input);
  const theme = resolveTheme(input);
  const settings = resolveSettings(input);

  if (settings.highContrastMode) {
    return {
      '--background': '0 0% 0%',
      '--foreground': '0 0% 100%',
      '--card': '0 0% 3%',
      '--card-foreground': '0 0% 100%',
      '--primary': '56 100% 80%',
      '--primary-foreground': '0 0% 0%',
      '--muted': '0 0% 9%',
      '--muted-foreground': '0 0% 85%',
      '--accent': '56 100% 80%',
      '--accent-foreground': '0 0% 0%',
      '--destructive': '0 100% 68%',
      '--destructive-foreground': '0 0% 0%',
      '--border': '0 0% 100%',
      '--input': '0 0% 100%',
      '--ring': '56 100% 80%',
      '--reader-app-bg': palette.appBg,
      '--reader-app-foreground': palette.appForeground,
      '--reader-focus-ring': palette.focusRing
    };
  }

  if (theme === 'dark') {
    return {
      '--background': '222 47% 11%',
      '--foreground': '210 40% 96%',
      '--card': '217 35% 15%',
      '--card-foreground': '210 40% 96%',
      '--primary': '210 90% 62%',
      '--primary-foreground': '222 47% 11%',
      '--muted': '217 33% 19%',
      '--muted-foreground': '215 20% 70%',
      '--accent': '217 33% 19%',
      '--accent-foreground': '210 40% 96%',
      '--destructive': '0 72% 55%',
      '--destructive-foreground': '210 40% 98%',
      '--border': '215 28% 27%',
      '--input': '215 28% 27%',
      '--ring': '210 90% 62%',
      '--reader-app-bg': palette.appBg,
      '--reader-app-foreground': palette.appForeground,
      '--reader-focus-ring': palette.focusRing
    };
  }

  if (theme === 'sepia') {
    return {
      '--background': '36 46% 92%',
      '--foreground': '28 35% 22%',
      '--card': '38 58% 95%',
      '--card-foreground': '28 35% 22%',
      '--primary': '28 45% 40%',
      '--primary-foreground': '40 60% 96%',
      '--muted': '36 35% 88%',
      '--muted-foreground': '28 24% 41%',
      '--accent': '35 45% 86%',
      '--accent-foreground': '28 35% 22%',
      '--destructive': '3 63% 47%',
      '--destructive-foreground': '40 60% 96%',
      '--border': '35 31% 75%',
      '--input': '35 31% 75%',
      '--ring': '28 45% 40%',
      '--reader-app-bg': palette.appBg,
      '--reader-app-foreground': palette.appForeground,
      '--reader-focus-ring': palette.focusRing
    };
  }

  return {
    '--background': '210 40% 98%',
    '--foreground': '222.2 47.4% 11.2%',
    '--card': '0 0% 100%',
    '--card-foreground': '222.2 47.4% 11.2%',
    '--primary': '221.2 83.2% 53.3%',
    '--primary-foreground': '210 40% 98%',
    '--muted': '210 40% 96.1%',
    '--muted-foreground': '215.4 16.3% 46.9%',
    '--accent': '210 40% 96.1%',
    '--accent-foreground': '222.2 47.4% 11.2%',
    '--destructive': '0 84.2% 60.2%',
    '--destructive-foreground': '210 40% 98%',
    '--border': '214.3 31.8% 91.4%',
    '--input': '214.3 31.8% 91.4%',
    '--ring': '221.2 83.2% 53.3%',
    '--reader-app-bg': palette.appBg,
    '--reader-app-foreground': palette.appForeground,
    '--reader-focus-ring': palette.focusRing
  };
}
