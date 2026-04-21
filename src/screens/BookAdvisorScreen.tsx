import * as React from 'react';
import { AlertCircle, ArrowRight, BookOpenText, LoaderCircle, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  recommendBooks,
  type AdvisorLanguagePreference,
  type AdvisorLength,
  type AdvisorRecommendation
} from '@/services/advisorApi';
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

const genreOptions = [
  'Dystopia',
  'Philosophy',
  'Science Fiction',
  'Fantasy',
  'History',
  'Psychology',
  'Classics',
  'Self-development',
  'Romance',
  'Mystery'
] as const;

const moodOptions = ['Dark', 'Intellectual', 'Inspiring', 'Cozy', 'Serious', 'Emotional', 'Fast-paced', 'Reflective'] as const;

const screenCopy = {
  ru: {
    title: 'Книжный советник',
    subtitle: 'Настройте жанры, настроение и формат, а AI подберет книги под ваш запрос.',
    formTitle: 'Ваши предпочтения',
    formDescription: 'Выберите несколько фильтров или просто опишите желаемую книгу своими словами.',
    genres: 'Жанры',
    moods: 'Настроение / тон',
    length: 'Длина книги',
    type: 'Тип',
    era: 'Эпоха',
    preferredLanguage: 'Предпочтительный язык',
    freeTextLabel: 'Свободный запрос',
    freeTextPlaceholder: 'Опишите, какую книгу вы хотите',
    libraryContext: 'Учитывать мою библиотеку',
    libraryContextHint: 'Скоро: передача локальной библиотеки в AI-контекст.',
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
    english: 'Английский',
    submit: 'Получить рекомендации',
    loading: 'Подбираем книги...',
    emptyTitle: 'Выберите предпочтения и получите рекомендации',
    emptyDescription: 'Комбинируйте жанры и настроение или добавьте свободный запрос, чтобы сузить подборку.',
    noRecommendations: 'Рекомендации не найдены',
    noRecommendationsDescription: 'Попробуйте смягчить фильтры или добавить больше деталей в описание.',
    errorTitle: 'Не удалось получить рекомендации',
    recommendationsTitle: 'Рекомендации AI',
    recommendationsDescription: 'Книги, которые лучше всего подходят под выбранные параметры.',
    confidence: 'Уверенность',
    findInDiscover: 'Найти в Discover',
    aiRecommendation: 'AI recommendation',
    sourceFallback: 'Резервная выдача',
    sourceOpenrouter: 'AI recommendation',
    warningTitle: 'Внимание',
    recommendationCount: 'рекомендаций',
    helperLine: 'Запрос отправляется только в локальный backend.'
  },
  en: {
    title: 'Book Advisor',
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
    libraryContextHint: 'Coming soon: send a lightweight local library summary to the AI backend.',
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
    confidence: 'Confidence',
    findInDiscover: 'Find in Discover',
    aiRecommendation: 'AI recommendation',
    sourceFallback: 'Fallback set',
    sourceOpenrouter: 'AI recommendation',
    warningTitle: 'Notice',
    recommendationCount: 'recommendations',
    helperLine: 'Requests are sent only to the local backend.'
  }
} as const;

function getLanguageDefault(language: 'ru' | 'en'): AdvisorLanguagePreference {
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

function ChipGroup({
  options,
  selected,
  onToggle
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={cn(
              'rounded-full border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background/80 hover:bg-accent'
            )}
            aria-pressed={isSelected}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function SegmentedControl<TValue extends string>({
  value,
  options,
  onChange
}: {
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-xl border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background/80 hover:bg-accent'
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

export function BookAdvisorScreen({ books, onFindInDiscover }: Props) {
  const { language } = useLanguage();
  const copy = screenCopy[language];
  const [genres, setGenres] = React.useState<string[]>([]);
  const [moods, setMoods] = React.useState<string[]>([]);
  const [length, setLength] = React.useState<AdvisorLength>('medium');
  const [typePreference, setTypePreference] = React.useState<TypePreference>('any');
  const [eraPreference, setEraPreference] = React.useState<EraPreference>('any');
  const [languagePreference, setLanguagePreference] = React.useState<AdvisorLanguagePreference>(getLanguageDefault(language));
  const [freeText, setFreeText] = React.useState('');
  const [useLibraryContext, setUseLibraryContext] = React.useState(false);
  const [recommendations, setRecommendations] = React.useState<AdvisorRecommendation[]>([]);
  const [responseSource, setResponseSource] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasRequested, setHasRequested] = React.useState(false);

  React.useEffect(() => {
    setLanguagePreference((current) => (current === 'any' ? current : getLanguageDefault(language)));
  }, [language]);

  const toggleSelection = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasRequested(true);
    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      const result = await recommendBooks({
        genres,
        moods,
        length,
        fiction: typePreference === 'fiction',
        classic: eraPreference === 'classic',
        freeText: freeText.trim(),
        languagePreference
      });

      setRecommendations(result.recommendations);
      setResponseSource(result.source ?? null);
      setWarning(result.warning ?? null);
    } catch (requestError) {
      setRecommendations([]);
      setResponseSource(null);
      setWarning(null);
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  const sourceLabel = responseSource === 'fallback' ? copy.sourceFallback : copy.sourceOpenrouter;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-6 overflow-hidden pr-1">
      <Card className="shrink-0 overflow-hidden border-white/70 bg-[linear-gradient(135deg,rgba(255,250,245,0.98)_0%,rgba(255,255,255,0.99)_50%,rgba(239,246,255,0.98)_100%)] shadow-sm">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-background/85 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
                <p className="max-w-2xl text-sm text-muted-foreground">{copy.subtitle}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground shadow-sm">
              <p className="font-medium text-foreground">{copy.currentLibrary}</p>
              <p>{books.length} {copy.booksInLibrary}</p>
              <p className="mt-1 text-xs">{copy.helperLine}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
        <div className="min-h-0 overflow-y-auto pb-2">
          <Card className="border-white/60 bg-card/95 shadow-sm">
            <CardContent className="space-y-6 p-6">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight">{copy.formTitle}</h2>
                <p className="text-sm text-muted-foreground">{copy.formDescription}</p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">{copy.genres}</h3>
                  <ChipGroup options={genreOptions} selected={genres} onToggle={(value) => toggleSelection(value, setGenres)} />
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">{copy.moods}</h3>
                  <ChipGroup options={moodOptions} selected={moods} onToggle={(value) => toggleSelection(value, setMoods)} />
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">{copy.length}</h3>
                  <SegmentedControl
                    value={length}
                    onChange={setLength}
                    options={[
                      { value: 'short', label: copy.short },
                      { value: 'medium', label: copy.medium },
                      { value: 'long', label: copy.long }
                    ]}
                  />
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">{copy.type}</h3>
                  <SegmentedControl
                    value={typePreference}
                    onChange={setTypePreference}
                    options={[
                      { value: 'fiction', label: copy.fiction },
                      { value: 'non-fiction', label: copy.nonFiction },
                      { value: 'any', label: copy.any }
                    ]}
                  />
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">{copy.era}</h3>
                  <SegmentedControl
                    value={eraPreference}
                    onChange={setEraPreference}
                    options={[
                      { value: 'classic', label: copy.classic },
                      { value: 'modern', label: copy.modern },
                      { value: 'any', label: copy.any }
                    ]}
                  />
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">{copy.preferredLanguage}</h3>
                  <SegmentedControl
                    value={languagePreference}
                    onChange={setLanguagePreference}
                    options={[
                      { value: 'ru', label: copy.russian },
                      { value: 'en', label: copy.english },
                      { value: 'any', label: copy.any }
                    ]}
                  />
                </section>

                <section className="space-y-3">
                  <label className="text-sm font-semibold" htmlFor="book-advisor-free-text">
                    {copy.freeTextLabel}
                  </label>
                  <textarea
                    id="book-advisor-free-text"
                    value={freeText}
                    onChange={(event) => setFreeText(event.target.value)}
                    placeholder={copy.freeTextPlaceholder}
                    className="min-h-32 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </section>

                <section className="space-y-2 rounded-2xl border border-dashed border-border bg-muted/20 p-4">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={useLibraryContext}
                      onChange={(event) => setUseLibraryContext(event.target.checked)}
                      disabled
                      className="mt-0.5 h-4 w-4 rounded border border-input"
                    />
                    <span className="space-y-1">
                      <span className="block font-medium text-foreground">{copy.libraryContext}</span>
                      <span className="block text-muted-foreground">{copy.libraryContextHint}</span>
                    </span>
                  </label>
                </section>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {loading ? copy.loading : copy.submit}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="min-h-0 overflow-y-auto pb-2">
          <div className="space-y-6">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{copy.errorTitle}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {warning ? (
              <Alert>
                <AlertTitle>{copy.warningTitle}</AlertTitle>
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            ) : null}

            {!hasRequested ? (
              <Card className="border-dashed bg-card/80">
                <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background/90 shadow-sm">
                    <BookOpenText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold tracking-tight">{copy.emptyTitle}</h2>
                    <p className="max-w-md text-sm text-muted-foreground">{copy.emptyDescription}</p>
                  </div>
                </CardContent>
              </Card>
            ) : loading ? (
              <Card className="border-dashed bg-card/80">
                <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-center">
                  <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{copy.loading}</p>
                </CardContent>
              </Card>
            ) : recommendations.length === 0 ? (
              <Card className="border-dashed bg-card/80">
                <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-center">
                  <p className="text-sm font-medium">{copy.noRecommendations}</p>
                  <p className="max-w-md text-sm text-muted-foreground">{copy.noRecommendationsDescription}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="border-white/60 bg-card/90 shadow-sm">
                  <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">{copy.recommendationsTitle}</h2>
                      <p className="text-sm text-muted-foreground">{copy.recommendationsDescription}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-border bg-background/80 px-3 py-1.5 font-medium text-muted-foreground">
                        {recommendations.length} {copy.recommendationCount}
                      </span>
                      <span className="rounded-full border border-border bg-background/80 px-3 py-1.5 font-medium text-muted-foreground">
                        {sourceLabel}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <ul className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                  {recommendations.map((recommendation) => {
                    const query = `${recommendation.title} ${recommendation.author}`.trim();
                    const confidenceLabel = getConfidenceLabel(recommendation.confidence, copy.confidence);

                    return (
                      <li key={`${recommendation.title}:${recommendation.author}`}>
                        <Card className="flex h-full flex-col border-white/60 bg-card/95 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
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
                            </div>

                            <div className="space-y-2">
                              <h3 className="text-xl font-semibold tracking-tight">{recommendation.title}</h3>
                              <p className="text-sm text-muted-foreground">{recommendation.author}</p>
                              <p className="text-sm leading-6 text-muted-foreground">{recommendation.reason}</p>
                            </div>

                            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                              <span className="text-xs text-muted-foreground">{sourceLabel}</span>
                              <Button
                                type="button"
                                onClick={() => onFindInDiscover({ query })}
                              >
                                {copy.findInDiscover}
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
