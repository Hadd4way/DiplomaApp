import * as React from 'react';
import { AlertCircle, LoaderCircle, MessageSquareText, SendHorizontal, WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNetworkStatus } from '@/contexts/NetworkStatusContext';
import { cn } from '@/lib/utils';
import { chatBooks, type ChatMessage } from '@/services/chatBooksApi';
import type { RecommendationLibraryContext } from '@/services/recommendationApi';

type Props = {
  libraryContext?: RecommendationLibraryContext;
};

const CHAT_STORAGE_KEY = 'book-advisor-chat-session-v1';

type ChatSessionSnapshot = {
  messages: ChatMessage[];
  draft: string;
  lastSource: 'openrouter' | 'fallback' | null;
};

const promptChips = {
  ru: [
    'Что почитать после 1984?',
    'Посоветуй короткую книгу на вечер',
    'Что почитать для знакомства с философией?',
    'Подбери мрачную, но умную книгу'
  ],
  en: [
    'What should I read after 1984?',
    'Suggest a short book for tonight',
    'Philosophy books for beginners',
    'Recommend a dark but thoughtful book'
  ]
} as const;

const copy = {
  ru: {
    tabTitle: 'Чат',
    title: 'Книжный чат',
    description: 'Задайте вопрос о том, что почитать дальше, и получите ответ прямо в чате.',
    emptyTitle: 'Начните разговор о книгах',
    emptyDescription: 'Напишите, что вам понравилось, какое настроение ищете или с чего хотите начать.',
    placeholder: 'Напишите сообщение о книгах...',
    send: 'Отправить',
    sending: 'Отправка...',
    errorTitle: 'Не удалось получить ответ',
    errorDescription: 'Попробуйте отправить сообщение ещё раз через пару секунд.',
    assistantLabel: 'Советник',
    userLabel: 'Вы',
    chipsLabel: 'Быстрые вопросы',
    aiDisclaimer: 'ИИ может давать неточные или неполные ответы. Проверяйте важную информацию самостоятельно.',
    contextNote: 'Чат может учитывать вашу локальную библиотеку.',
    sourceOpenrouter: 'AI',
    sourceFallback: 'Резервный ответ'
  },
  en: {
    tabTitle: 'Chat',
    title: 'Book chat',
    description: 'Ask what to read next and get a focused answer right in the chat.',
    emptyTitle: 'Start a book conversation',
    emptyDescription: 'Tell the advisor what you liked, what mood you want, or where you want to begin.',
    placeholder: 'Write a message about books...',
    send: 'Send',
    sending: 'Sending...',
    errorTitle: 'Failed to get a reply',
    errorDescription: 'Please try sending your message again in a moment.',
    assistantLabel: 'Advisor',
    userLabel: 'You',
    chipsLabel: 'Prompt ideas',
    aiDisclaimer: 'AI can give inaccurate or incomplete answers. Please verify important information yourself.',
    contextNote: 'Chat can use your local library context.',
    sourceOpenrouter: 'AI',
    sourceFallback: 'Fallback reply'
  }
} as const;

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as ChatMessage;
  return (
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string'
  );
}

function loadChatSession(): ChatSessionSnapshot {
  if (typeof window === 'undefined') {
    return {
      messages: [],
      draft: '',
      lastSource: null
    };
  }

  try {
    const rawValue = window.sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!rawValue) {
      return {
        messages: [],
        draft: '',
        lastSource: null
      };
    }

    const parsed = JSON.parse(rawValue) as Partial<ChatSessionSnapshot>;
    const messages = Array.isArray(parsed.messages) ? parsed.messages.filter(isChatMessage) : [];
    const draft = typeof parsed.draft === 'string' ? parsed.draft : '';
    const lastSource = parsed.lastSource === 'openrouter' || parsed.lastSource === 'fallback' ? parsed.lastSource : null;

    return {
      messages,
      draft,
      lastSource
    };
  } catch {
    return {
      messages: [],
      draft: '',
      lastSource: null
    };
  }
}

export function BookAdvisorChat({ libraryContext }: Props) {
  const { language } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const localizedCopy = copy[language];
  const offlineMessage =
    language === 'ru'
      ? 'Книжный чат недоступен без интернета. Подключитесь к сети, чтобы отправлять сообщения.'
      : 'Book chat is unavailable offline. Reconnect to the internet to send messages.';
  const [session, setSession] = React.useState<ChatSessionSnapshot>(() => loadChatSession());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const { messages, draft, lastSource } = session;

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  const submitMessage = React.useCallback(async (rawMessage: string) => {
    const trimmed = rawMessage.trim();
    if (!trimmed || loading || !isOnline) {
      if (!isOnline) {
        setError(offlineMessage);
      }
      return;
    }

    const nextUserMessage: ChatMessage = {
      role: 'user',
      content: trimmed
    };

    const nextMessages = [...messages, nextUserMessage];
    setSession((current) => ({
      ...current,
      messages: nextMessages,
      draft: ''
    }));
    setError(null);
    setLoading(true);

    try {
      const result = await chatBooks({
        messages: nextMessages,
        language,
        libraryContext: libraryContext?.books.length ? libraryContext.books : undefined
      });

      setSession((current) => ({
        ...current,
        messages: [
          ...current.messages,
          {
            role: 'assistant',
            content: result.reply
          }
        ],
        lastSource: result.source ?? null
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : localizedCopy.errorDescription);
    } finally {
      setLoading(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [isOnline, language, libraryContext, loading, localizedCopy.errorDescription, messages, offlineMessage]);

  const handleSubmit = React.useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    await submitMessage(draft);
  }, [draft, submitMessage]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(draft);
    }
  }, [draft, submitMessage]);

  const handleChipClick = React.useCallback((value: string) => {
    setSession((current) => ({
      ...current,
      draft: value
    }));
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const canSend = draft.trim().length > 0 && !loading && isOnline;
  const sourceLabel = lastSource === 'fallback' ? localizedCopy.sourceFallback : localizedCopy.sourceOpenrouter;

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)] xl:gap-6 xl:overflow-hidden">
      <div className="min-h-0 pb-2 xl:overflow-y-auto">
        <Card className="border-white/60 bg-card/95">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{localizedCopy.title}</h2>
                {!isOnline ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    <WifiOff className="h-3.5 w-3.5" />
                    {language === 'ru' ? 'Офлайн' : 'Offline'}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{localizedCopy.description}</p>
            </div>

            <div className="rounded-[1.4rem] border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">
              {localizedCopy.aiDisclaimer}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">{localizedCopy.chipsLabel}</h3>
              <div className={isOnline ? 'flex flex-wrap gap-2.5' : 'pointer-events-none flex flex-wrap gap-2.5 opacity-60'}>
                {promptChips[language].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleChipClick(prompt)}
                    className="rounded-full border border-border bg-background/86 px-3.5 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-foreground/10 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {libraryContext?.books.length ? (
              <div className="rounded-[1.4rem] border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">
                {localizedCopy.contextNote}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex min-h-[32rem] flex-col gap-4 overflow-hidden pb-2 xl:min-h-0">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{localizedCopy.errorTitle}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!isOnline ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{language === 'ru' ? 'Чат временно недоступен' : 'Chat temporarily unavailable'}</AlertTitle>
            <AlertDescription>{offlineMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Card className={cn('flex min-h-0 flex-1 flex-col border-white/60 bg-card/95', !isOnline ? 'opacity-75' : '')}>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-background/85">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{localizedCopy.title}</p>
                  <p className="text-xs text-muted-foreground">{sourceLabel}</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {messages.length === 0 ? (
                <div className="flex h-full min-h-64 items-center justify-center">
                  <div className="max-w-md space-y-2 text-center">
                    <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-background/85">
                      <MessageSquareText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight">{localizedCopy.emptyTitle}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{localizedCopy.emptyDescription}</p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isAssistant = message.role === 'assistant';
                  return (
                    <div
                      key={`${message.role}-${index}-${message.content}`}
                      className={cn('flex', isAssistant ? 'justify-start' : 'justify-end')}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.32)]',
                          isAssistant
                            ? 'border border-border bg-background text-foreground'
                            : 'bg-primary text-primary-foreground'
                        )}
                      >
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                          {isAssistant ? localizedCopy.assistantLabel : localizedCopy.userLabel}
                        </p>
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                    </div>
                  );
                })
              )}

              {loading ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-3xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    {localizedCopy.sending}
                  </div>
                </div>
              ) : null}
            </div>

            <form className="border-t border-border/70 p-4" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => setSession((current) => ({ ...current, draft: event.target.value }))}
                  onKeyDown={handleKeyDown}
                  placeholder={localizedCopy.placeholder}
                  className="min-h-28 w-full resize-none rounded-2xl border border-input bg-background/92 px-4 py-3.5 text-sm shadow-[0_8px_24px_-20px_rgba(15,23,42,0.22)] ring-offset-background transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={loading || !isOnline}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={!canSend} className="min-w-32">
                    {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                    {loading ? localizedCopy.sending : localizedCopy.send}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
