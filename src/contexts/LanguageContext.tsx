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
  library: {
    importedNotice: string;
    title: string;
    subtitle: string;
    importBook: string;
    discoverBooks: string;
    addSampleBook: string;
    pleaseWait: string;
    reload: string;
    emptyTitle: string;
    emptyDescription: string;
    importFirstBook: string;
    continueReadingTitle: string;
    continueReadingSubtitle: string;
    orderedByLastOpened: string;
    continueReadingEmptyTitle: string;
    continueReadingEmptyDescription: string;
    browseTitle: string;
    browseSubtitle: string;
    searchPlaceholder: string;
    sortBy: string;
    sortRecentOpened: string;
    sortRecentAdded: string;
    sortTitle: string;
    sortFormat: string;
    filter: string;
    filterAll: string;
    noBooksFoundTitle: string;
    noBooksFoundDescription: string;
    updatedTitle: string;
    requestErrorTitle: string;
  };
  discover: {
    title: string;
    subtitle: string;
    backToLibrary: string;
    searchPlaceholder: string;
    languagePlaceholder: string;
    search: string;
    allSources: string;
    gutenberg: string;
    standardEbooks: string;
    sourceAll: string;
    sourceGutenberg: string;
    sourceStandardEbooks: string;
    searchLoadingAll: string;
    searchLoadingGutenberg: string;
    searchLoadingStandardEbooks: string;
    emptyAll: string;
    emptyGutenberg: string;
    emptyStandardEbooks: string;
    emptyDescription: string;
    discoverErrorTitle: string;
    introTitle: string;
    introDescription: string;
    networkIssue: string;
    unsupportedFormat: string;
    importFailed: string;
    readyToDownload: string;
    startingDownload: string;
    downloading: string;
    importing: string;
    downloadedSuccessfully: string;
    downloadFailed: string;
    retry: string;
    download: string;
    downloaded: string;
    openNow: string;
    showInLibrary: string;
    localLibraryDescription: string;
    sameBookExists: string;
    duplicateTitle: string;
    duplicateDescription: string;
    cancel: string;
    openExisting: string;
    importAnyway: string;
    unknownAuthor: string;
    source: string;
    language: string;
    year: string;
    format: string;
    editionPremium: string;
    downloads: string;
    unknown: string;
    coverAlt: string;
    sameTitleAuthorExists: string;
    tryAgain: string;
    publicSourcesTitle: string;
    curatedEdition: string;
  };
  bookCard: {
    unknownAuthor: string;
    openedOn: string;
    addedOn: string;
    bookActions: string;
    actionsFor: string;
    showInFolder: string;
    delete: string;
    open: string;
    openBook: string;
    positionUnavailable: string;
    continueReading: string;
    loadingProgress: string;
    deleteTitle: string;
    deleteDescription: string;
    cancel: string;
    progressUnavailable: string;
    noProgressYet: string;
    percentRead: string;
    pagesUnavailable: string;
    pageUnavailable: string;
    pages: string;
    pageOf: string;
    startOnPage: string;
    locations: string;
    sections: string;
    chapters: string;
    startReading: string;
    chapter: string;
    section: string;
  };
  app: {
    readerCrashedTitle: string;
    unknownReaderError: string;
    backToLibrary: string;
    loadingLibrary: string;
    pdfReader: string;
    loadingPdf: string;
    selectBookFile: string;
    importTitle: string;
    noteBookNotFound: string;
    annotationBookNotFound: string;
  };
  notes: {
    title: string;
    refresh: string;
    allBooks: string;
    searchPlaceholder: string;
    noNotes: string;
    unknownBook: string;
    page: string;
    edit: string;
    delete: string;
    updated: string;
    deleteTitle: string;
    deleteDescription: string;
    cancel: string;
    editTitle: string;
    editRequired: string;
    subtitlePage: string;
  };
  hub: {
    secondBrain: string;
    title: string;
    description: string;
    items: string;
    highlights: string;
    notes: string;
    books: string;
    searchPlaceholder: string;
    allBooks: string;
    allTypes: string;
    allTime: string;
    recent7: string;
    recent30: string;
    newest: string;
    oldest: string;
    bookTitleSort: string;
    refresh: string;
    surfaced: string;
    sortedBy: string;
    quietTitle: string;
    quietDescription: string;
    highlight: string;
    note: string;
    highlightedText: string;
    noteText: string;
    noNoteYet: string;
    page: string;
    locationReady: string;
    openInBook: string;
    editNote: string;
    delete: string;
    deleteTitle: string;
    deleteHighlightDescription: string;
    deleteNoteDescription: string;
    cancel: string;
    editHighlightNote: string;
    editNoteTitle: string;
    noteRequired: string;
    noteTextRequired: string;
    unknownBook: string;
  };
  placeholder: {
    description: string;
    comingSoon: string;
  };
  readerPanels: {
    search: string;
    searchInDocument: string;
    prev: string;
    next: string;
    searching: string;
    results: string;
    emptyQuery: string;
    noResults: string;
    highlights: string;
    noHighlights: string;
    flowHighlight: string;
    highlight: string;
    note: string;
    highlightWithoutText: string;
    jump: string;
    editNote: string;
    addNote: string;
    delete: string;
    readerSettings: string;
    theme: string;
    themeDescription: string;
    typography: string;
    typographyFlowDescription: string;
    typographyLockedDescription: string;
    fontSize: string;
    lineHeight: string;
    margins: string;
    fontFamily: string;
    accessibility: string;
    accessibilityDescription: string;
    dyslexiaFriendly: string;
    dyslexiaFriendlyDescription: string;
    highContrast: string;
    highContrastDescription: string;
    textSizePreset: string;
    reduceMotion: string;
    reduceMotionDescription: string;
    on: string;
    off: string;
    pdfDisplay: string;
    pdfDescription: string;
    pdfLockedDescription: string;
    backgroundAroundPage: string;
    zoomPreset: string;
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
    },
    library: {
      importedNotice: 'Книга добавлена в библиотеку, а расширенные метаданные подтянутся автоматически.',
      title: 'Библиотека',
      subtitle: 'Продолжайте чтение с того места, где остановились, и держите всю коллекцию под рукой.',
      importBook: 'Импортировать книгу',
      discoverBooks: 'Найти книги',
      addSampleBook: 'Добавить пример книги',
      pleaseWait: 'Подождите...',
      reload: 'Обновить',
      emptyTitle: 'Соберите свой читательский центр',
      emptyDescription: 'Импортируйте первую PDF, EPUB, FB2 или TXT книгу, чтобы включить продолжение чтения, отслеживание прогресса и полную локальную библиотеку.',
      importFirstBook: 'Импортировать первую книгу',
      continueReadingTitle: 'Продолжить чтение',
      continueReadingSubtitle: 'Ваши последние открытые книги, готовые к продолжению.',
      orderedByLastOpened: 'Сортировка по последнему открытию',
      continueReadingEmptyTitle: 'Откройте книгу, чтобы заполнить полку продолжения чтения.',
      continueReadingEmptyDescription: 'Недавние сессии чтения появятся здесь автоматически.',
      browseTitle: 'Все книги',
      browseSubtitle: 'Просматривайте всю библиотеку, фильтруйте по формату и открывайте книги в один клик.',
      searchPlaceholder: 'Поиск по названию, подзаголовку или автору...',
      sortBy: 'Сортировка',
      sortRecentOpened: 'Недавно открытые',
      sortRecentAdded: 'Недавно добавленные',
      sortTitle: 'Название А-Я',
      sortFormat: 'Формат',
      filter: 'Фильтр',
      filterAll: 'Все',
      noBooksFoundTitle: 'По текущему запросу книги не найдены.',
      noBooksFoundDescription: 'Попробуйте другое название, фильтр формата или режим сортировки.',
      updatedTitle: 'Библиотека обновлена',
      requestErrorTitle: 'Ошибка запроса'
    },
    discover: {
      title: 'Поиск книг',
      subtitle: 'Ищите в Project Gutenberg для широты выбора, в Standard Ebooks для отобранных EPUB-изданий и добавляйте хорошие книги в локальную библиотеку.',
      backToLibrary: 'Назад в библиотеку',
      searchPlaceholder: 'Поиск по названию или автору...',
      languagePlaceholder: 'Код языка, необязательно, например en',
      search: 'Искать',
      allSources: 'Все источники',
      gutenberg: 'Gutenberg',
      standardEbooks: 'Standard Ebooks',
      sourceAll: 'Источник: все источники',
      sourceGutenberg: 'Источник: Project Gutenberg',
      sourceStandardEbooks: 'Источник: Standard Ebooks',
      searchLoadingAll: 'Ищем по всем источникам...',
      searchLoadingGutenberg: 'Ищем в Project Gutenberg...',
      searchLoadingStandardEbooks: 'Ищем в Standard Ebooks...',
      emptyAll: 'Поиск не дал результатов ни в Standard Ebooks, ни в Project Gutenberg.',
      emptyGutenberg: 'В Project Gutenberg ничего не найдено по этому запросу.',
      emptyStandardEbooks: 'В Standard Ebooks ничего не найдено по этому запросу.',
      emptyDescription: 'Попробуйте более общее название, другое написание автора или иной код языка.',
      discoverErrorTitle: 'Ошибка поиска',
      introTitle: 'Ищите бесплатные книги из двух public-domain источников',
      introDescription: 'Исследуйте Gutenberg ради количества и Standard Ebooks ради тщательно подготовленных изданий, затем загружайте книги прямо в локальную коллекцию.',
      networkIssue: 'Проблема с сетью. Проверьте подключение и попробуйте ещё раз.',
      unsupportedFormat: 'У этого издания пока нет формата, который можно импортировать.',
      importFailed: 'Не удалось добавить книгу в локальную библиотеку. Попробуйте снова.',
      readyToDownload: 'Готово к загрузке',
      startingDownload: 'Начинаем загрузку...',
      downloading: 'Загрузка...',
      importing: 'Импорт в локальную библиотеку...',
      downloadedSuccessfully: 'Успешно загружено',
      downloadFailed: 'Загрузка не удалась',
      retry: 'Повторить',
      download: 'Скачать',
      downloaded: 'Загружено',
      openNow: 'Открыть',
      showInLibrary: 'Показать в библиотеке',
      localLibraryDescription: 'Книга уже добавлена в локальную библиотеку.',
      sameBookExists: 'Локальная книга с таким же названием и автором уже существует.',
      duplicateTitle: 'Такая книга уже есть.',
      duplicateDescription: 'Локальная копия с таким же названием и автором уже находится в библиотеке. Можно открыть существующую книгу, всё равно импортировать новую или отменить действие.',
      cancel: 'Отмена',
      openExisting: 'Открыть существующую',
      importAnyway: 'Импортировать всё равно',
      unknownAuthor: 'Автор неизвестен',
      source: 'Источник',
      language: 'Язык',
      year: 'Год',
      format: 'Формат',
      editionPremium: 'Издание: Premium EPUB',
      downloads: 'Загрузки',
      unknown: 'Неизвестно',
      coverAlt: 'обложка',
      sameTitleAuthorExists: 'В локальной библиотеке уже есть книга с таким же названием и автором.',
      tryAgain: 'Попробуйте ещё раз.',
      publicSourcesTitle: 'Открытые источники',
      curatedEdition: 'Кураторское издание'
    },
    bookCard: {
      unknownAuthor: 'Автор неизвестен',
      openedOn: 'Открыта',
      addedOn: 'Добавлена',
      bookActions: 'Действия с книгой',
      actionsFor: 'Действия для',
      showInFolder: 'Показать в папке',
      delete: 'Удалить',
      open: 'Открыть',
      openBook: 'Открыть',
      positionUnavailable: 'Позиция открытия недоступна',
      continueReading: 'Продолжить чтение',
      loadingProgress: 'Загрузка прогресса...',
      deleteTitle: 'Удалить книгу?',
      deleteDescription: 'Книга будет удалена из библиотеки вместе с локальными файлами.',
      cancel: 'Отмена',
      progressUnavailable: 'Прогресс недоступен',
      noProgressYet: 'Прогресса пока нет',
      percentRead: '% прочитано',
      pagesUnavailable: 'Страницы недоступны',
      pageUnavailable: 'Страница недоступна',
      pages: 'стр.',
      pageOf: 'Страница',
      startOnPage: 'Начать с 1 страницы',
      locations: 'позиций',
      sections: 'секций',
      chapters: 'глав',
      startReading: 'Начать чтение',
      chapter: 'Глава',
      section: 'Секция'
    },
    app: {
      readerCrashedTitle: 'Ридер упал при открытии книги',
      unknownReaderError: 'Неизвестная ошибка ридера.',
      backToLibrary: 'Назад в библиотеку',
      loadingLibrary: 'Загрузка библиотеки...',
      pdfReader: 'PDF ридер',
      loadingPdf: 'Загрузка PDF...',
      selectBookFile: 'Выберите PDF/EPUB/FB2/TXT',
      importTitle: 'Импорт',
      noteBookNotFound: 'Книга для этой заметки не найдена.',
      annotationBookNotFound: 'Книга для этой аннотации не найдена.'
    },
    notes: {
      title: 'Заметки',
      refresh: 'Обновить',
      allBooks: 'Все книги',
      searchPlaceholder: 'Поиск по заметкам...',
      noNotes: 'Заметок пока нет.',
      unknownBook: 'Неизвестная книга',
      page: 'Страница',
      edit: 'Редактировать',
      delete: 'Удалить',
      updated: 'Обновлено',
      deleteTitle: 'Удалить заметку?',
      deleteDescription: 'Это действие нельзя отменить.',
      cancel: 'Отмена',
      editTitle: 'Редактировать заметку',
      editRequired: 'Текст заметки обязателен.',
      subtitlePage: 'страница'
    },
    hub: {
      secondBrain: 'Второй мозг',
      title: 'База знаний',
      description: 'Просматривайте идеи, паттерны и выводы из всех книг в одном месте. Ищите по памяти чтения, редактируйте её и быстро возвращайтесь к источнику.',
      items: 'Элементы',
      highlights: 'Выделения',
      notes: 'Заметки',
      books: 'Книги',
      searchPlaceholder: 'Поиск по выделениям и заметкам...',
      allBooks: 'Все книги',
      allTypes: 'Все типы',
      allTime: 'За всё время',
      recent7: 'Последние 7 дней',
      recent30: 'Последние 30 дней',
      newest: 'Сначала новые',
      oldest: 'Сначала старые',
      bookTitleSort: 'По названию книги',
      refresh: 'Обновить',
      surfaced: 'найдено',
      sortedBy: 'Сортировка',
      quietTitle: 'Пока здесь тихо',
      quietDescription: 'Добавьте выделения или заметки в любом ридере, и они автоматически появятся здесь.',
      highlight: 'Выделение',
      note: 'Заметка',
      highlightedText: 'Выделенный текст',
      noteText: 'Текст заметки',
      noNoteYet: 'Заметки пока нет.',
      page: 'Страница',
      locationReady: 'Переход к месту готов',
      openInBook: 'Открыть в книге',
      editNote: 'Редактировать заметку',
      delete: 'Удалить',
      deleteTitle: 'Удалить этот элемент?',
      deleteHighlightDescription: 'Это выделение будет удалено из книги и из базы знаний.',
      deleteNoteDescription: 'Эта заметка будет удалена из книги и из базы знаний.',
      cancel: 'Отмена',
      editHighlightNote: 'Редактировать заметку к выделению',
      editNoteTitle: 'Редактировать заметку',
      noteRequired: 'Текст заметки обязателен.',
      noteTextRequired: 'Текст заметки обязателен.',
      unknownBook: 'Неизвестная книга'
    },
    placeholder: {
      description: 'Этот раздел появится в будущем обновлении.',
      comingSoon: 'Скоро'
    },
    readerPanels: {
      search: 'Поиск',
      searchInDocument: 'Поиск по документу',
      prev: 'Назад',
      next: 'Далее',
      searching: 'Идёт поиск...',
      results: 'результатов',
      emptyQuery: 'Введите запрос, чтобы искать по всей книге.',
      noResults: 'Ничего не найдено.',
      highlights: 'Выделения',
      noHighlights: 'Для этой книги пока нет выделений.',
      flowHighlight: 'Потоковое выделение',
      highlight: 'Выделение',
      note: 'Заметка',
      highlightWithoutText: '(выделение без текста)',
      jump: 'Перейти',
      editNote: 'Редактировать заметку',
      addNote: 'Добавить заметку',
      delete: 'Удалить',
      readerSettings: 'Настройки ридера',
      theme: 'Тема',
      themeDescription: 'Общая тема ридера для PDF и всех потоковых форматов.',
      typography: 'Типографика',
      typographyFlowDescription: 'Живые настройки типографики для комфортного чтения потокового текста.',
      typographyLockedDescription: 'Настройки типографики станут активны при открытии EPUB, FB2 или TXT.',
      fontSize: 'Размер шрифта',
      lineHeight: 'Межстрочный интервал',
      margins: 'Поля',
      fontFamily: 'Семейство шрифтов',
      accessibility: 'Доступность',
      accessibilityDescription: 'Поддержка комфортного чтения для контента и интерфейса ридера.',
      dyslexiaFriendly: 'Режим для дислексии',
      dyslexiaFriendlyDescription: 'Использует специальный стек шрифтов, добавляет интервалы и ослабляет плотность текста.',
      highContrast: 'Высокая контрастность',
      highContrastDescription: 'Усиливает контраст, границы и заметность элементов управления.',
      textSizePreset: 'Предустановка размера текста',
      reduceMotion: 'Уменьшение анимации',
      reduceMotionDescription: 'Отключает анимации, переходы и плавную прокрутку, где это возможно.',
      on: 'Вкл',
      off: 'Выкл',
      pdfDisplay: 'Отображение PDF',
      pdfDescription: 'Настройте настроение фона и способ вписывания страницы.',
      pdfLockedDescription: 'Параметры PDF станут активны при открытии PDF-файла.',
      backgroundAroundPage: 'Фон вокруг страницы',
      zoomPreset: 'Предустановка масштаба'
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
    },
    library: {
      importedNotice: 'Your library now includes the downloaded book, and richer metadata will fill in automatically.',
      title: 'Library',
      subtitle: 'Continue where you left off and keep your collection within reach.',
      importBook: 'Import book',
      discoverBooks: 'Discover Books',
      addSampleBook: 'Add sample book',
      pleaseWait: 'Please wait...',
      reload: 'Reload',
      emptyTitle: 'Build your reading hub',
      emptyDescription: 'Import your first PDF, EPUB, FB2, or TXT to unlock continue reading, progress tracking, and your full desktop library.',
      importFirstBook: 'Import your first book',
      continueReadingTitle: 'Continue Reading',
      continueReadingSubtitle: 'Your most recently opened books, ready to jump back in.',
      orderedByLastOpened: 'Ordered by last opened',
      continueReadingEmptyTitle: 'Open a book to start your continue reading shelf.',
      continueReadingEmptyDescription: 'Recent reading sessions will appear here automatically.',
      browseTitle: 'Library',
      browseSubtitle: 'Browse every book, refine by format, and open anything in one click.',
      searchPlaceholder: 'Search by title, subtitle, or author...',
      sortBy: 'Sort by',
      sortRecentOpened: 'Recently opened',
      sortRecentAdded: 'Recently added',
      sortTitle: 'Title A-Z',
      sortFormat: 'Format',
      filter: 'Filter',
      filterAll: 'All',
      noBooksFoundTitle: 'No books match your current search.',
      noBooksFoundDescription: 'Try a different title, format filter, or sort mode.',
      updatedTitle: 'Library updated',
      requestErrorTitle: 'Request error'
    },
    discover: {
      title: 'Discover Books',
      subtitle: 'Search Project Gutenberg for breadth, Standard Ebooks for curated EPUBs, and bring great books into your local library.',
      backToLibrary: 'Back to Library',
      searchPlaceholder: 'Search by title or author...',
      languagePlaceholder: 'Language code (optional, e.g. en)',
      search: 'Search',
      allSources: 'All Sources',
      gutenberg: 'Gutenberg',
      standardEbooks: 'Standard Ebooks',
      sourceAll: 'Source: All Sources',
      sourceGutenberg: 'Source: Project Gutenberg',
      sourceStandardEbooks: 'Source: Standard Ebooks',
      searchLoadingAll: 'Searching all sources...',
      searchLoadingGutenberg: 'Searching Project Gutenberg...',
      searchLoadingStandardEbooks: 'Searching Standard Ebooks...',
      emptyAll: 'No books matched that search across Standard Ebooks or Project Gutenberg.',
      emptyGutenberg: 'No Project Gutenberg books matched that search.',
      emptyStandardEbooks: 'No Standard Ebooks titles matched that search.',
      emptyDescription: 'Try a broader title, another author spelling, or a different language code.',
      discoverErrorTitle: 'Discover error',
      introTitle: 'Search free books from two public-domain sources',
      introDescription: 'Explore Gutenberg for quantity and Standard Ebooks for polished curated editions, then download straight into your local collection.',
      networkIssue: 'Network issue. Check your connection and try again.',
      unsupportedFormat: 'This edition does not have a format we can import yet.',
      importFailed: 'Import failed while adding the book to your local library. Please retry.',
      readyToDownload: 'Ready to download',
      startingDownload: 'Starting download...',
      downloading: 'Downloading...',
      importing: 'Importing into your local library...',
      downloadedSuccessfully: 'Downloaded successfully',
      downloadFailed: 'Download failed',
      retry: 'Retry',
      download: 'Download',
      downloaded: 'Downloaded',
      openNow: 'Open Now',
      showInLibrary: 'Show in Library',
      localLibraryDescription: 'Your book is now part of the local library.',
      sameBookExists: 'A local book with the same title and author already exists.',
      duplicateTitle: 'This book already exists.',
      duplicateDescription: 'A local copy with the same title and author is already in your library. You can open the existing book, import this one anyway, or cancel.',
      cancel: 'Cancel',
      openExisting: 'Open Existing',
      importAnyway: 'Import Anyway',
      unknownAuthor: 'Unknown author',
      source: 'Source',
      language: 'Language',
      year: 'Year',
      format: 'Format',
      editionPremium: 'Edition: Premium EPUB',
      downloads: 'Downloads',
      unknown: 'Unknown',
      coverAlt: 'cover',
      sameTitleAuthorExists: 'A local book with the same title and author already exists.',
      tryAgain: 'Please try again.',
      publicSourcesTitle: 'Public-domain sources',
      curatedEdition: 'Curated Edition'
    },
    bookCard: {
      unknownAuthor: 'Unknown author',
      openedOn: 'Opened',
      addedOn: 'Added',
      bookActions: 'Book actions',
      actionsFor: 'Actions for',
      showInFolder: 'Show in folder',
      delete: 'Delete',
      open: 'Open',
      openBook: 'Open',
      positionUnavailable: 'Opening position unavailable',
      continueReading: 'Continue Reading',
      loadingProgress: 'Loading progress...',
      deleteTitle: 'Delete book?',
      deleteDescription: 'This will remove the book from your library and delete its local files.',
      cancel: 'Cancel',
      progressUnavailable: 'Progress unavailable',
      noProgressYet: 'No progress yet',
      percentRead: '% read',
      pagesUnavailable: 'Pages unavailable',
      pageUnavailable: 'Page unavailable',
      pages: 'pages',
      pageOf: 'Page',
      startOnPage: 'Start on page 1',
      locations: 'locations',
      sections: 'sections',
      chapters: 'chapters',
      startReading: 'Start Reading',
      chapter: 'Chapter',
      section: 'Section'
    },
    app: {
      readerCrashedTitle: 'Reader crashed while opening this book',
      unknownReaderError: 'Unknown reader error.',
      backToLibrary: 'Back to Library',
      loadingLibrary: 'Loading library...',
      pdfReader: 'PDF Reader',
      loadingPdf: 'Loading PDF...',
      selectBookFile: 'Select PDF/EPUB/FB2/TXT',
      importTitle: 'Import',
      noteBookNotFound: 'Book for this note was not found.',
      annotationBookNotFound: 'Book for this annotation was not found.'
    },
    notes: {
      title: 'Notes',
      refresh: 'Refresh',
      allBooks: 'All books',
      searchPlaceholder: 'Search notes...',
      noNotes: 'No notes yet.',
      unknownBook: 'Unknown book',
      page: 'Page',
      edit: 'Edit',
      delete: 'Delete',
      updated: 'Updated',
      deleteTitle: 'Delete note?',
      deleteDescription: 'This action cannot be undone.',
      cancel: 'Cancel',
      editTitle: 'Edit note',
      editRequired: 'Note content is required.',
      subtitlePage: 'page'
    },
    hub: {
      secondBrain: 'Second Brain',
      title: 'Knowledge Hub',
      description: 'Review ideas, patterns, and takeaways from every book in one place. Search your reading memory, refine it, and jump straight back into the source.',
      items: 'Items',
      highlights: 'Highlights',
      notes: 'Notes',
      books: 'Books',
      searchPlaceholder: 'Search across highlights and notes...',
      allBooks: 'All books',
      allTypes: 'All types',
      allTime: 'All time',
      recent7: 'Recent 7 days',
      recent30: 'Recent 30 days',
      newest: 'Newest',
      oldest: 'Oldest',
      bookTitleSort: 'Book title',
      refresh: 'Refresh',
      surfaced: 'surfaced',
      sortedBy: 'Sorted by',
      quietTitle: 'Your hub is quiet right now',
      quietDescription: 'Add highlights or notes in any reader and they will appear here automatically.',
      highlight: 'Highlight',
      note: 'Note',
      highlightedText: 'Highlighted text',
      noteText: 'Note text',
      noNoteYet: 'No note yet.',
      page: 'Page',
      locationReady: 'Location jump ready',
      openInBook: 'Open in book',
      editNote: 'Edit note',
      delete: 'Delete',
      deleteTitle: 'Delete this item?',
      deleteHighlightDescription: 'This highlight will be removed from the book and the Knowledge Hub.',
      deleteNoteDescription: 'This note will be removed from the book and the Knowledge Hub.',
      cancel: 'Cancel',
      editHighlightNote: 'Edit highlight note',
      editNoteTitle: 'Edit note',
      noteRequired: 'Note content is required.',
      noteTextRequired: 'Note text is required.',
      unknownBook: 'Unknown book'
    },
    placeholder: {
      description: 'This section will be available in a future update.',
      comingSoon: 'Coming soon'
    },
    readerPanels: {
      search: 'Search',
      searchInDocument: 'Search in document',
      prev: 'Prev',
      next: 'Next',
      searching: 'Searching...',
      results: 'results',
      emptyQuery: 'Type a query to search this book.',
      noResults: 'No matches found.',
      highlights: 'Highlights',
      noHighlights: 'No highlights for this book.',
      flowHighlight: 'Flow highlight',
      highlight: 'Highlight',
      note: 'Note',
      highlightWithoutText: '(highlight without text)',
      jump: 'Jump',
      editNote: 'Edit note',
      addNote: 'Add note',
      delete: 'Delete',
      readerSettings: 'Reader Settings',
      theme: 'Theme',
      themeDescription: 'Shared reader chrome for PDF and all flow formats.',
      typography: 'Typography',
      typographyFlowDescription: 'Live flow-reader typography adjustments for comfort and focus.',
      typographyLockedDescription: 'Typography controls become active when you open an EPUB, FB2, or TXT book.',
      fontSize: 'Font Size',
      lineHeight: 'Line Height',
      margins: 'Margins',
      fontFamily: 'Font Family',
      accessibility: 'Accessibility',
      accessibilityDescription: 'Inclusive reading support across flow content and the reader interface.',
      dyslexiaFriendly: 'Dyslexia Friendly Mode',
      dyslexiaFriendlyDescription: 'Uses a dyslexia-friendly font stack, adds spacing, and relaxes line height for easier tracking.',
      highContrast: 'High Contrast Mode',
      highContrastDescription: 'Overrides the standard theme with stronger contrast, borders, and clearer controls.',
      textSizePreset: 'Text Size Preset',
      reduceMotion: 'Reduce Motion',
      reduceMotionDescription: 'Turns off transitions, animations, and smooth scrolling where possible.',
      on: 'On',
      off: 'Off',
      pdfDisplay: 'PDF Display',
      pdfDescription: 'Set the page shell mood and default page fitting.',
      pdfLockedDescription: 'PDF display controls become active when you open a PDF.',
      backgroundAroundPage: 'Background Around Page',
      zoomPreset: 'Zoom Preset'
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
