import * as React from 'react';

export type AppLanguage = 'ru' | 'en';

type TranslationTree = {
  sidebar: {
    title: string;
    navigationLabel: string;
    library: string;
    knowledgeHub: string;
    settings: string;
  };
  settings: {
    title: string;
    description: string;
    resetDefaults: string;
    status: string;
    loading: string;
    ready: string;
    themeSummary: string;
    languageTitle: string;
    languageDescription: string;
    languageRu: string;
    languageEn: string;
    appearanceTitle: string;
    appearanceDescription: string;
    interfaceTextSizeTitle: string;
    interfaceTextSizeDescription: string;
    flowReadingTitle: string;
    flowReadingDescription: string;
    fontFamily: string;
    margins: string;
    fontSize: string;
    lineHeight: string;
    pdfTitle: string;
    pdfDescription: string;
    backgroundTheme: string;
    defaultZoom: string;
    accessibilityTitle: string;
    accessibilityDescription: string;
    dyslexiaFriendlyMode: string;
    dyslexiaFriendlyModeDescription: string;
    highContrastMode: string;
    highContrastModeDescription: string;
    reduceMotion: string;
    reduceMotionDescription: string;
    currentProfileTitle: string;
    currentProfileDescription: string;
    profileTheme: string;
    profilePdfZoom: string;
    profileEpubFont: string;
    profileTextSize: string;
    highContrastProfile: string;
    themeLight: string;
    themeSepia: string;
    themeDark: string;
    themeLightDescription: string;
    themeSepiaDescription: string;
    themeDarkDescription: string;
    textSizeNormal: string;
    textSizeLarge: string;
    textSizeExtraLarge: string;
    marginSmall: string;
    marginMedium: string;
    marginLarge: string;
    fontSerif: string;
    fontSans: string;
    fontGeorgia: string;
    fontOpenDyslexic: string;
    zoomFitWidth: string;
    zoomFitPage: string;
    zoomActualSize: string;
  };
};

const STORAGE_KEY = 'diploma-app-language';

const translations: Record<AppLanguage, TranslationTree> = {
  ru: {
    sidebar: {
      title: 'Reader',
      navigationLabel: 'Основная навигация',
      library: 'Библиотека',
      knowledgeHub: 'База знаний',
      settings: 'Настройки'
    },
    settings: {
      title: 'Настройки',
      description: 'Настройте опыт чтения для EPUB, FB2, TXT и PDF. Изменения применяются сразу и сохраняются автоматически.',
      resetDefaults: 'Сбросить по умолчанию',
      status: 'Статус',
      loading: 'Загрузка настроек...',
      ready: 'Настройки готовы',
      themeSummary: 'Тема интерфейса',
      languageTitle: 'Язык',
      languageDescription: 'Выберите язык интерфейса приложения.',
      languageRu: 'Русский',
      languageEn: 'English',
      appearanceTitle: 'Внешний вид',
      appearanceDescription: 'Выберите общую тему и размер текста интерфейса.',
      interfaceTextSizeTitle: 'Размер текста интерфейса',
      interfaceTextSizeDescription: 'Масштабирует меню, элементы управления и подписи в интерфейсе.',
      flowReadingTitle: 'Потоковое чтение',
      flowReadingDescription: 'Параметры по умолчанию для EPUB, FB2 и TXT с переформатируемым текстом.',
      fontFamily: 'Шрифт',
      margins: 'Поля',
      fontSize: 'Размер шрифта',
      lineHeight: 'Межстрочный интервал',
      pdfTitle: 'PDF',
      pdfDescription: 'Выберите, как PDF будут открываться по умолчанию.',
      backgroundTheme: 'Тема фона',
      defaultZoom: 'Масштаб по умолчанию',
      accessibilityTitle: 'Доступность',
      accessibilityDescription: 'Улучшите читаемость и снизьте визуальную нагрузку.',
      dyslexiaFriendlyMode: 'Режим для дислексии',
      dyslexiaFriendlyModeDescription: 'Использует специальный шрифт интерфейса и увеличивает интервалы в тексте.',
      highContrastMode: 'Высокая контрастность',
      highContrastModeDescription: 'Перекрывает тему интерфейса режимом максимального контраста.',
      reduceMotion: 'Уменьшение анимации',
      reduceMotionDescription: 'Отключает лишние движения и делает переходы минимальными.',
      currentProfileTitle: 'Текущий профиль',
      currentProfileDescription: 'Краткая сводка активной конфигурации ридера.',
      profileTheme: 'Тема',
      profilePdfZoom: 'PDF масштаб',
      profileEpubFont: 'Шрифт EPUB',
      profileTextSize: 'Размер текста',
      highContrastProfile: 'Высокая контрастность',
      themeLight: 'Светлая',
      themeSepia: 'Сепия',
      themeDark: 'Тёмная',
      themeLightDescription: 'Светлое рабочее пространство с нейтральным контрастом.',
      themeSepiaDescription: 'Тёплые бумажные оттенки для длинных сессий чтения.',
      themeDarkDescription: 'Мягкая тема с низкой яркостью для вечернего чтения.',
      textSizeNormal: 'Обычный',
      textSizeLarge: 'Крупный',
      textSizeExtraLarge: 'Очень крупный',
      marginSmall: 'Маленькие',
      marginMedium: 'Средние',
      marginLarge: 'Большие',
      fontSerif: 'Serif',
      fontSans: 'Sans',
      fontGeorgia: 'Georgia',
      fontOpenDyslexic: 'OpenDyslexic',
      zoomFitWidth: 'По ширине',
      zoomFitPage: 'По странице',
      zoomActualSize: 'Фактический размер'
    }
  },
  en: {
    sidebar: {
      title: 'Reader',
      navigationLabel: 'Main navigation',
      library: 'Library',
      knowledgeHub: 'Knowledge Hub',
      settings: 'Settings'
    },
    settings: {
      title: 'Settings',
      description: 'Configure the reading experience for EPUB, FB2, TXT, and PDF. Changes are applied immediately and saved automatically.',
      resetDefaults: 'Reset defaults',
      status: 'Status',
      loading: 'Loading settings...',
      ready: 'Settings are ready',
      themeSummary: 'Reader theme',
      languageTitle: 'Language',
      languageDescription: 'Choose the app interface language.',
      languageRu: 'Русский',
      languageEn: 'English',
      appearanceTitle: 'Appearance',
      appearanceDescription: 'Pick the global look and the default text scale for the app UI.',
      interfaceTextSizeTitle: 'Interface text size',
      interfaceTextSizeDescription: 'Scales menus, controls, and reading interface labels.',
      flowReadingTitle: 'Flow Reading',
      flowReadingDescription: 'Defaults for EPUB, FB2, and TXT books with reflowable text.',
      fontFamily: 'Font family',
      margins: 'Margins',
      fontSize: 'Font size',
      lineHeight: 'Line height',
      pdfTitle: 'PDF',
      pdfDescription: 'Choose how PDF documents open by default.',
      backgroundTheme: 'Background theme',
      defaultZoom: 'Default zoom',
      accessibilityTitle: 'Accessibility',
      accessibilityDescription: 'Improve readability and reduce visual strain.',
      dyslexiaFriendlyMode: 'Dyslexia friendly mode',
      dyslexiaFriendlyModeDescription: 'Uses a dyslexia-oriented UI font and increases spacing in reflowable text.',
      highContrastMode: 'High contrast mode',
      highContrastModeDescription: 'Overrides the theme with maximum contrast across the app.',
      reduceMotion: 'Reduce motion',
      reduceMotionDescription: 'Disables extra movement and keeps transitions minimal.',
      currentProfileTitle: 'Current Profile',
      currentProfileDescription: 'Quick summary of the active reader setup.',
      profileTheme: 'Theme',
      profilePdfZoom: 'PDF zoom',
      profileEpubFont: 'EPUB font',
      profileTextSize: 'Text size',
      highContrastProfile: 'High contrast',
      themeLight: 'Light',
      themeSepia: 'Sepia',
      themeDark: 'Dark',
      themeLightDescription: 'Bright workspace with neutral contrast.',
      themeSepiaDescription: 'Warm paper-like colors for longer sessions.',
      themeDarkDescription: 'Low-glare reading for evening work.',
      textSizeNormal: 'Normal',
      textSizeLarge: 'Large',
      textSizeExtraLarge: 'Extra large',
      marginSmall: 'Small',
      marginMedium: 'Medium',
      marginLarge: 'Large',
      fontSerif: 'Serif',
      fontSans: 'Sans',
      fontGeorgia: 'Georgia',
      fontOpenDyslexic: 'OpenDyslexic',
      zoomFitWidth: 'Fit width',
      zoomFitPage: 'Fit page',
      zoomActualSize: 'Actual size'
    }
  }
};

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: TranslationTree;
};

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return 'ru';
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'ru' || saved === 'en') {
    return saved;
  }

  const browserLanguage = window.navigator.language.toLowerCase();
  return browserLanguage.startsWith('ru') ? 'ru' : 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<AppLanguage>(getInitialLanguage);

  const setLanguage = React.useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = React.useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: translations[language]
    }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider.');
  }
  return context;
}
