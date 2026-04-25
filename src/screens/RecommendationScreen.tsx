import * as React from 'react';
import { AlertCircle, ArrowRight, BookOpenText, BookmarkPlus, LoaderCircle, Sparkles, WifiOff, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookAdvisorChat } from '@/components/BookAdvisorChat';
import { ScreenEmptyState, ScreenErrorState, ScreenLoadingState } from '@/components/ScreenState';
import { SkeletonGrid } from '@/components/Skeletons';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNetworkStatus } from '@/contexts/NetworkStatusContext';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { LIST_BATCH_SIZE } from '@/lib/constants';
import { getReaderHeroCardStyles, getReaderThemePalette } from '@/lib/reader-theme';
import { useRecentBooks } from '@/lib/library-metrics';
import { useIncrementalList } from '@/lib/useIncrementalList';
import { useWishlist } from '@/lib/useWishlist';
import { cn } from '@/lib/utils';
import {
  recommendBooks,
  type RecommendationLanguagePreference,
  type RecommendationLibraryBook,
  type RecommendationLength,
  type Recommendation
} from '@/services/recommendationApi';
import type { Book } from '../../shared/ipc';

type TypePreference = 'fiction' | 'non-fiction' | 'any';
type EraPreference = 'classic' | 'modern' | 'any';

type DiscoverLaunchPayload = {
  query: string;
};

type Props = {
  books: Book[];
  onFindInDiscover: (payload: DiscoverLaunchPayload) => void;
};

type RecommendationCopy = (typeof screenCopy)['en'] | (typeof screenCopy)['ru'];

const genreOptions = [
  { id: 'dystopia', label: { ru: 'Антиутопия', en: 'Dystopia' } },
  { id: 'philosophy', label: { ru: 'Философия', en: 'Philosophy' } },
  { id: 'science-fiction', label: { ru: 'Научная фантастика', en: 'Science Fiction' } },
  { id: 'fantasy', label: { ru: 'Фэнтези', en: 'Fantasy' } },
  { id: 'history', label: { ru: 'История', en: 'History' } },
  { id: 'psychology', label: { ru: 'Психология', en: 'Psychology' } },
  { id: 'classics', label: { ru: 'Классика', en: 'Classics' } },
  { id: 'self-development', label: { ru: 'Саморазвитие', en: 'Self-development' } },
  { id: 'romance', label: { ru: 'Романтика', en: 'Romance' } },
  { id: 'mystery', label: { ru: 'Детектив', en: 'Mystery' } }
] as const;

const moodOptions = [
  { id: 'dark', label: { ru: 'Мрачное', en: 'Dark' } },
  { id: 'intellectual', label: { ru: 'Интеллектуальное', en: 'Intellectual' } },
  { id: 'inspiring', label: { ru: 'Вдохновляющее', en: 'Inspiring' } },
  { id: 'cozy', label: { ru: 'Уютное', en: 'Cozy' } },
  { id: 'serious', label: { ru: 'Серьёзное', en: 'Serious' } },
  { id: 'emotional', label: { ru: 'Эмоциональное', en: 'Emotional' } },
  { id: 'fast-paced', label: { ru: 'Динамичное', en: 'Fast-paced' } },
  { id: 'reflective', label: { ru: 'Созерцательное', en: 'Reflective' } }
] as const;

const screenCopy = {
  ru: {
    title: 'Книжный советник',
    subtitle: 'Задайте жанры, настроение и предпочтения по формату, а AI подберёт подходящие книги.',
    formTitle: 'Ваши предпочтения',
    formDescription: 'Выберите несколько фильтров или опишите своими словами, какую книгу хотите найти.',
    genres: 'Жанры',
    moods: 'Настроение / тон',
    length: 'Объём книги',
    type: 'Тип',
    era: 'Эпоха',
    preferredLanguage: 'Предпочитаемый язык',
    freeTextLabel: 'Свободное описание',
    freeTextPlaceholder: 'Опишите, какую книгу вы хотите',
    libraryContext: 'Учитывать мою библиотеку',
    libraryContextHint: 'Отправим только названия и авторов из локальной библиотеки, без заметок, подсветок, экспортов и аннотаций.',
    personalizedNote: 'Рекомендации персонализированы с учетом вашей библиотеки.',
    currentLibrary: 'Локальная библиотека',
    booksInLibrary: 'книг в библиотеке',
    short: 'Короткая',
    medium: 'Средняя',
    long: 'Длинная',
    fiction: 'Художественная',
    nonFiction: 'Нон-фикшн',
    any: 'Любой',
    classic: 'Классика',
    modern: 'Современная',
    russian: 'Русский',
    english: 'English',
    submit: 'Получить рекомендации',
    loading: 'Подбираем книги...',
    emptyTitle: 'Выберите предпочтения и получите рекомендации',
    emptyDescription: 'Комбинируйте жанры, настроение и свободное описание, чтобы настроить подборку.',
    noRecommendations: 'Рекомендации не найдены',
    noRecommendationsDescription: 'Попробуйте сделать фильтры шире или добавить больше деталей в описание.',
    errorTitle: 'Не удалось получить рекомендации',
    recommendationsTitle: 'AI-рекомендации',
    recommendationsDescription: 'Книги, которые лучше всего подходят под выбранные вами предпочтения.',
    summaryTitle: 'Комментарий советника',
    summaryBadge: 'Заметка советника',
    confidence: 'Уверенность',
    save: 'Сохранить',
    saved: 'Сохранено',
    dismiss: 'Скрыть',
    findInDiscover: 'Найти в поиске',
    aiRecommendation: 'AI-рекомендация',
    sourceFallback: 'Резервный набор',
    sourceOpenrouter: 'AI-рекомендация',
    warningTitle: 'Внимание',
    recommendationCount: 'рекомендаций',
    helperLine: 'Запросы отправляются только в локальный backend.',
    showMore: 'Показать ещё',
    recommendationsTab: 'Рекомендации',
    chatTab: 'Чат'
  },
  en: {
    title: 'Recommendations',
    subtitle: 'Set genres, mood, and format preferences, then let AI suggest books that fit.',
    formTitle: 'Your preferences',
    formDescription: 'Pick a few filters or describe the kind of book you want in your own words.',
    genres: 'Genres',
    moods: 'Mood / tone',
    length: 'Book length',
    type: 'Type',
    era: 'Era',
    preferredLanguage: 'Preferred language',
    freeTextLabel: 'Free text',
    freeTextPlaceholder: 'Describe what kind of book you want',
    libraryContext: 'Use my library context',
    libraryContextHint: 'We only send titles and authors from your local library, never notes, highlights, exports, or annotations.',
    personalizedNote: 'Recommendations personalized using your library.',
    currentLibrary: 'Local library',
    booksInLibrary: 'books in library',
    short: 'Short',
    medium: 'Medium',
    long: 'Long',
    fiction: 'Fiction',
    nonFiction: 'Non-fiction',
    any: 'Any',
    classic: 'Classic',
    modern: 'Modern',
    russian: 'Russian',
    english: 'English',
    submit: 'Get recommendations',
    loading: 'Finding books...',
    emptyTitle: 'Choose your preferences and get recommendations',
    emptyDescription: 'Mix genres, mood, and a free-text prompt to shape the suggestions.',
    noRecommendations: 'No recommendations found',
    noRecommendationsDescription: 'Try broader filters or add more detail to your description.',
    errorTitle: 'Failed to get recommendations',
    recommendationsTitle: 'AI recommendations',
    recommendationsDescription: 'Books that best match the preferences you selected.',
    summaryTitle: 'Recommendation Summary',
    summaryBadge: 'Summary',
    confidence: 'Confidence',
    save: 'Save',
    saved: 'Saved',
    dismiss: 'Dismiss',
    findInDiscover: 'Find in Discover',
    aiRecommendation: 'AI recommendation',
    sourceFallback: 'Fallback set',
    sourceOpenrouter: 'AI recommendation',
    warningTitle: 'Notice',
    recommendationCount: 'recommendations',
    helperLine: 'Requests are sent only to the local backend.',
    showMore: 'Show more',
    recommendationsTab: 'Recommendations',
    chatTab: 'Chat'
  }
} as const;

function getLanguageDefault(language: 'ru' | 'en'): RecommendationLanguagePreference {
  return language === 'ru' ? 'ru' : 'en';
}

function getConfidenceLabel(value: number | undefined, label: string) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  const normalized = value > 1 ? value / 100 : value;
  const percent = Math.max(0, Math.min(100, Math.round(normalized * 100)));
  return `${label}: ${percent}%`;
}

function getRecommendationKey(recommendation: { title: string; author?: string | null }) {
  return `${recommendation.title.trim().toLocaleLowerCase()}::${(recommendation.author ?? '').trim().toLocaleLowerCase()}`;
}

function toLibraryBook(book: Pick<Book, 'title' | 'author'>): RecommendationLibraryBook | null {
  const title = book.title.trim();
  const author = book.author?.trim() ?? null;

  if (!title) {
    return null;
  }

  return {
    title,
    author: author || null
  };
}

function getLibraryBookKey(book: Pick<Book, 'title' | 'author'>) {
  return `${book.title.trim().toLocaleLowerCase()}::${(book.author ?? '').trim().toLocaleLowerCase()}`;
}

function buildLibraryContext(books: Book[], recentBookIds: string[]) {
  const recentBooksById = new Map(recentBookIds.map((bookId, index) => [bookId, index]));
  const booksById = new Map(books.map((book) => [book.id, book]));
  const sortedBooks = [...books].sort((left, right) => {
    const leftRecentIndex = recentBooksById.get(left.id);
    const rightRecentIndex = recentBooksById.get(right.id);

    if (leftRecentIndex !== undefined || rightRecentIndex !== undefined) {
      if (leftRecentIndex === undefined) {
        return 1;
      }
      if (rightRecentIndex === undefined) {
        return -1;
      }
      return leftRecentIndex - rightRecentIndex;
    }

    return right.createdAt - left.createdAt;
  });

  const seen = new Set<string>();
  const libraryBooks: RecommendationLibraryBook[] = [];

  for (const book of sortedBooks) {
    const entry = toLibraryBook(book);
    if (!entry) {
      continue;
    }

    const key = getLibraryBookKey(entry);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    libraryBooks.push(entry);

    if (libraryBooks.length >= 30) {
      break;
    }
  }

  const recentlyOpenedBooks: RecommendationLibraryBook[] = [];

  for (const bookId of recentBookIds) {
    const book = booksById.get(bookId);
    if (!book) {
      continue;
    }

    const entry = toLibraryBook(book);
    if (!entry) {
      continue;
    }

    const key = getLibraryBookKey(entry);
    if (recentlyOpenedBooks.some((candidate) => getLibraryBookKey(candidate) === key)) {
      continue;
    }

    recentlyOpenedBooks.push(entry);

    if (recentlyOpenedBooks.length >= 5) {
      break;
    }
  }

  const authorCounts = new Map<string, number>();
  for (const book of libraryBooks) {
    const author = book.author?.trim();
    if (!author) {
      continue;
    }

    authorCounts.set(author, (authorCounts.get(author) ?? 0) + 1);
  }

  const commonAuthors = [...authorCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([author]) => author);

  return {
    books: libraryBooks,
    recentlyOpenedBooks,
    commonAuthors
  };
}

const ChipGroup = React.memo(function ChipGroup({
  options,
  selected,
  language,
  onToggle
}: {
  options: readonly { id: string; label: { ru: string; en: string } }[];
  selected: string[];
  language: 'ru' | 'en';
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.id)}
            className={cn(
              'rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected
                ? 'border-primary/25 bg-primary text-primary-foreground shadow-[0_12px_28px_-18px_hsl(var(--primary))]'
                : 'border-border bg-background/86 text-muted-foreground hover:border-foreground/10 hover:bg-accent hover:text-foreground'
            )}
            aria-pressed={isSelected}
          >
            {option.label[language]}
          </button>
        );
      })}
    </div>
  );
});

function SegmentedControlInner<TValue extends string>({
  value,
  options,
  onChange
}: {
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected
                ? 'border-primary/25 bg-primary text-primary-foreground shadow-[0_12px_28px_-18px_hsl(var(--primary))]'
                : 'border-border bg-background/86 text-muted-foreground hover:border-foreground/10 hover:bg-accent hover:text-foreground'
            )}
            aria-pressed={isSelected}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const SegmentedControl = React.memo(SegmentedControlInner) as typeof SegmentedControlInner;

type RecommendationCardProps = {
  recommendation: Recommendation;
  copy: RecommendationCopy;
  sourceLabel: string;
  isSaved: boolean;
  isSaving: boolean;
  onSave: (recommendation: Recommendation, recommendationKey: string) => void;
  onFindInDiscover: (query: string) => void;
  onDismiss: (recommendationKey: string) => void;
};

const RecommendationCard = React.memo(function RecommendationCard({
  recommendation,
  copy,
  sourceLabel,
  isSaved,
  isSaving,
  onSave,
  onFindInDiscover,
  onDismiss
}: RecommendationCardProps) {
  const query = `${recommendation.title} ${recommendation.author}`.trim();
  const confidenceLabel = getConfidenceLabel(recommendation.confidence, copy.confidence);
  const recommendationKey = getRecommendationKey(recommendation);

  return (
    <Card className="surface-hover flex h-full flex-col border-white/60 bg-card/95">
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {copy.aiRecommendation}
          </span>
          {confidenceLabel ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
              {confidenceLabel}
            </span>
          ) : null}
          {isSaved ? (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800">
              {copy.saved}
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight">{recommendation.title}</h3>
          <p className="text-sm text-muted-foreground">{recommendation.author}</p>
          <p className="text-sm leading-6 text-muted-foreground">{recommendation.reason}</p>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
          <span className="text-xs text-muted-foreground">{sourceLabel}</span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={isSaved ? 'ghost' : 'default'} disabled={isSaved || isSaving} onClick={() => onSave(recommendation, recommendationKey)}>
              <BookmarkPlus className="h-4 w-4" />
              {isSaved ? copy.saved : copy.save}
            </Button>
            <Button type="button" variant="outline" onClick={() => onFindInDiscover(query)}>
              {copy.findInDiscover}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" onClick={() => onDismiss(recommendationKey)}>
              <X className="h-4 w-4" />
              {copy.dismiss}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export function RecommendationScreen({ books, onFindInDiscover }: Props) {
  const { language } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const { settings } = useReaderSettings();
  const copy = screenCopy[language];
  const palette = getReaderThemePalette(settings);
  const offlineMessage =
    language === 'ru'
      ? 'Рекомендации работают только при подключении к интернету.'
      : 'Recommendations are available only when you are connected to the internet.';
  const { recentBooks } = useRecentBooks('recommendations');
  const [genres, setGenres] = React.useState<string[]>([]);
  const [moods, setMoods] = React.useState<string[]>([]);
  const [length, setLength] = React.useState<RecommendationLength>('medium');
  const [typePreference, setTypePreference] = React.useState<TypePreference>('any');
  const [eraPreference, setEraPreference] = React.useState<EraPreference>('any');
  const [languagePreference, setLanguagePreference] = React.useState<RecommendationLanguagePreference>(getLanguageDefault(language));
  const [freeText, setFreeText] = React.useState('');
  const [useLibraryContext, setUseLibraryContext] = React.useState(true);
  const [recommendations, setRecommendations] = React.useState<Recommendation[]>([]);
  const [recommendationSummary, setRecommendationSummary] = React.useState('');
  const [responseSource, setResponseSource] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasRequested, setHasRequested] = React.useState(false);
  const [dismissedKeys, setDismissedKeys] = React.useState<string[]>([]);
  const [savingKeys, setSavingKeys] = React.useState<string[]>([]);
  const { items: wishlistItems, saveItem } = useWishlist();

  React.useEffect(() => {
    setLanguagePreference((current) => (current === 'any' ? current : getLanguageDefault(language)));
  }, [language]);

  const libraryContext = React.useMemo(
    () => buildLibraryContext(books, recentBooks.map((book) => book.bookId)),
    [books, recentBooks]
  );

  const toggleSelection = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isOnline) {
      setHasRequested(true);
      setLoading(false);
      setError(offlineMessage);
      setWarning(null);
      setRecommendationSummary('');
      setRecommendations([]);
      return;
    }

    setHasRequested(true);
    setLoading(true);
    setError(null);
    setWarning(null);
    setRecommendationSummary('');

    try {
      const result = await recommendBooks({
        genres,
        moods,
        length,
        fiction: typePreference === 'fiction',
        classic: eraPreference === 'classic',
        freeText: freeText.trim(),
        languagePreference,
        responseLanguage: language,
        libraryContext: useLibraryContext && libraryContext.books.length > 0 ? libraryContext : undefined
      });

      setRecommendationSummary(result.summary);
      setRecommendations(result.recommendations);
      setDismissedKeys([]);
      setResponseSource(result.source ?? null);
      setWarning(result.warning ?? null);
    } catch (requestError) {
      setRecommendationSummary('');
      setRecommendations([]);
      setDismissedKeys([]);
      setResponseSource(null);
      setWarning(null);
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  const sourceLabel = responseSource === 'fallback' ? copy.sourceFallback : copy.sourceOpenrouter;
  const wishlistKeySet = React.useMemo(() => new Set(wishlistItems.map(getRecommendationKey)), [wishlistItems]);
  const dismissedKeySet = React.useMemo(() => new Set(dismissedKeys), [dismissedKeys]);
  const savingKeySet = React.useMemo(() => new Set(savingKeys), [savingKeys]);
  const visibleRecommendations = React.useMemo(
    () => recommendations.filter((recommendation) => !dismissedKeySet.has(getRecommendationKey(recommendation))),
    [dismissedKeySet, recommendations]
  );
  const { visibleItems: visibleRecommendationItems, hasMore, showMore } = useIncrementalList(
    visibleRecommendations,
    LIST_BATCH_SIZE.recommendations
  );
  const showPersonalizedNote = useLibraryContext && libraryContext.books.length > 0;

  const retrySubmit = React.useCallback(() => {
    const form = document.querySelector('form');
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  }, []);

  const handleSaveRecommendation = React.useCallback((recommendation: Recommendation, recommendationKey: string) => {
    setSavingKeys((current) => [...current, recommendationKey]);
    void saveItem({
      title: recommendation.title,
      author: recommendation.author,
      reason: recommendation.reason,
      confidence: recommendation.confidence ?? null
    }).finally(() => {
      setSavingKeys((current) => current.filter((value) => value !== recommendationKey));
    });
  }, [saveItem]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-6 overflow-hidden pr-1">
      <Card className="shrink-0 overflow-hidden" style={getReaderHeroCardStyles(settings)}>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-background/85 shadow-[var(--shadow-sm)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
                  {!isOnline ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      <WifiOff className="h-3.5 w-3.5" />
                      {language === 'ru' ? 'Офлайн' : 'Offline'}
                    </span>
                  ) : null}
                </div>
                <p className="max-w-2xl text-sm text-muted-foreground">{copy.subtitle}</p>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="recommendations" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsList className="w-fit">
          <TabsTrigger value="recommendations">{copy.recommendationsTab}</TabsTrigger>
          <TabsTrigger value="chat">{copy.chatTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="mt-6 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <div className="grid min-h-0 flex-1 gap-6 overflow-hidden xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
            <div className="min-h-0 overflow-y-auto pb-2">
              <Card className="border-white/60 bg-card/95">
                <CardContent className="space-y-6 p-6">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight">{copy.formTitle}</h2>
                    <p className="text-sm text-muted-foreground">{copy.formDescription}</p>
                  </div>

                  {!isOnline ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{language === 'ru' ? 'Офлайн-режим' : 'Offline mode'}</AlertTitle>
                      <AlertDescription>{offlineMessage}</AlertDescription>
                    </Alert>
                  ) : null}

                  <form className={isOnline ? 'space-y-6' : 'space-y-6 opacity-60'} onSubmit={handleSubmit}>
                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold">{copy.genres}</h3>
                      <div className={!isOnline ? 'pointer-events-none' : undefined}>
                        <ChipGroup options={genreOptions} selected={genres} language={language} onToggle={(value) => toggleSelection(value, setGenres)} />
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold">{copy.moods}</h3>
                      <div className={!isOnline ? 'pointer-events-none' : undefined}>
                        <ChipGroup options={moodOptions} selected={moods} language={language} onToggle={(value) => toggleSelection(value, setMoods)} />
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold">{copy.length}</h3>
                      <div className={!isOnline ? 'pointer-events-none' : undefined}>
                        <SegmentedControl
                          value={length}
                          onChange={setLength}
                          options={[
                            { value: 'short', label: copy.short },
                            { value: 'medium', label: copy.medium },
                            { value: 'long', label: copy.long }
                          ]}
                        />
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold">{copy.type}</h3>
                      <div className={!isOnline ? 'pointer-events-none' : undefined}>
                        <SegmentedControl
                          value={typePreference}
                          onChange={setTypePreference}
                          options={[
                            { value: 'fiction', label: copy.fiction },
                            { value: 'non-fiction', label: copy.nonFiction },
                            { value: 'any', label: copy.any }
                          ]}
                        />
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold">{copy.era}</h3>
                      <div className={!isOnline ? 'pointer-events-none' : undefined}>
                        <SegmentedControl
                          value={eraPreference}
                          onChange={setEraPreference}
                          options={[
                            { value: 'classic', label: copy.classic },
                            { value: 'modern', label: copy.modern },
                            { value: 'any', label: copy.any }
                          ]}
                        />
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold">{copy.preferredLanguage}</h3>
                      <div className={!isOnline ? 'pointer-events-none' : undefined}>
                        <SegmentedControl
                          value={languagePreference}
                          onChange={setLanguagePreference}
                          options={[
                            { value: 'ru', label: copy.russian },
                            { value: 'en', label: copy.english },
                            { value: 'any', label: copy.any }
                          ]}
                        />
                      </div>
                    </section>

                    <section className="space-y-3">
                      <label className="text-sm font-semibold" htmlFor="recommendations-free-text">
                        {copy.freeTextLabel}
                      </label>
                      <textarea
                        id="recommendations-free-text"
                        value={freeText}
                        onChange={(event) => setFreeText(event.target.value)}
                        placeholder={copy.freeTextPlaceholder}
                        className="min-h-36 w-full rounded-2xl border border-input bg-background/92 px-4 py-3.5 text-sm shadow-[0_8px_24px_-20px_rgba(15,23,42,0.22)] ring-offset-background transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        disabled={!isOnline}
                      />
                    </section>

                    <section className="space-y-2 rounded-[1.4rem] border border-dashed border-border bg-muted/25 p-4">
                      <label className="flex items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={useLibraryContext}
                          onChange={(event) => setUseLibraryContext(event.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border border-input"
                          disabled={!isOnline}
                        />
                        <span className="space-y-1">
                          <span className="block font-medium text-foreground">{copy.libraryContext}</span>
                          <span className="block text-muted-foreground">{copy.libraryContextHint}</span>
                        </span>
                      </label>
                      {showPersonalizedNote ? <p className="text-xs font-medium" style={{ color: palette.accentText }}>{copy.personalizedNote}</p> : null}
                    </section>

                    <Button type="submit" disabled={loading || !isOnline} size="lg" className="w-full">
                      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {loading ? copy.loading : copy.submit}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="min-h-0 overflow-y-auto pb-2">
              <div className="space-y-6">
                {error ? <ScreenErrorState title={copy.errorTitle} description={error} onRetry={retrySubmit} /> : null}

                {warning ? (
                  <Alert>
                    <AlertTitle>{copy.warningTitle}</AlertTitle>
                    <AlertDescription>{warning}</AlertDescription>
                  </Alert>
                ) : null}

                {!hasRequested ? (
                  <ScreenEmptyState
                    title={copy.emptyTitle}
                    description={copy.emptyDescription}
                    icon={<BookOpenText className="h-6 w-6 text-muted-foreground" />}
                  />
                ) : loading ? (
                  <div className="space-y-4">
                    <ScreenLoadingState label={copy.loading} />
                    <SkeletonGrid count={4} />
                  </div>
                ) : visibleRecommendations.length === 0 ? (
                  <ScreenEmptyState title={copy.noRecommendations} description={copy.noRecommendationsDescription} icon={<BookOpenText className="h-6 w-6 text-muted-foreground" />} />
                ) : (
                  <>
                    {recommendationSummary ? (
                      <Card className="overflow-hidden border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.98)_0%,rgba(255,255,255,0.99)_48%,rgba(255,247,237,0.98)_100%)]">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200/80 bg-white/90 text-amber-700 shadow-[var(--shadow-sm)]">
                              <Sparkles className="h-5 w-5" />
                            </div>
                            <div className="space-y-2">
                              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                                {copy.summaryBadge}
                              </span>
                              <div className="space-y-1">
                                <h3 className="text-lg font-semibold tracking-tight text-foreground">{copy.summaryTitle}</h3>
                                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{recommendationSummary}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}

                    <Card className="border-white/60 bg-card/90">
                      <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 className="text-xl font-semibold tracking-tight">{copy.recommendationsTitle}</h2>
                          <p className="text-sm text-muted-foreground">{copy.recommendationsDescription}</p>
                          {showPersonalizedNote ? <p className="mt-2 text-xs font-medium" style={{ color: palette.accentText }}>{copy.personalizedNote}</p> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-border bg-background/80 px-3 py-1.5 font-medium text-muted-foreground">
                            {visibleRecommendations.length} {copy.recommendationCount}
                          </span>
                          <span className="rounded-full border border-border bg-background/80 px-3 py-1.5 font-medium text-muted-foreground">
                            {sourceLabel}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <ul className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                      {visibleRecommendationItems.map((recommendation) => {
                        const recommendationKey = getRecommendationKey(recommendation);
                        const isSaved = wishlistKeySet.has(recommendationKey);
                        const isSaving = savingKeySet.has(recommendationKey);

                        return (
                          <li key={recommendationKey}>
                            <RecommendationCard
                              recommendation={recommendation}
                              copy={copy}
                              sourceLabel={sourceLabel}
                              isSaved={isSaved}
                              isSaving={isSaving}
                              onSave={handleSaveRecommendation}
                              onFindInDiscover={(query) => onFindInDiscover({ query })}
                              onDismiss={(key) => setDismissedKeys((current) => [...current, key])}
                            />
                          </li>
                        );
                      })}
                    </ul>
                    {hasMore ? (
                      <div className="flex justify-center pt-2">
                        <Button type="button" variant="outline" onClick={showMore}>
                          {copy.showMore}
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="chat" className="mt-6 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <BookAdvisorChat libraryContext={useLibraryContext && libraryContext.books.length > 0 ? libraryContext : undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

