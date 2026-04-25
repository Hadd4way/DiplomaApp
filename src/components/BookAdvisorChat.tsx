import * as React from 'react';
import { AlertCircle, LoaderCircle, MessageSquareText, SendHorizontal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { chatBooks, type ChatMessage } from '@/services/chatBooksApi';
import type { RecommendationLibraryContext } from '@/services/recommendationApi';

type Props = {
  libraryContext?: RecommendationLibraryContext;
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
    contextNote: 'Chat can use your local library context.',
    sourceOpenrouter: 'AI',
    sourceFallback: 'Fallback reply'
  }
} as const;

export function BookAdvisorChat({ libraryContext }: Props) {
  const { language } = useLanguage();
  const localizedCopy = copy[language];
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastSource, setLastSource] = React.useState<'openrouter' | 'fallback' | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const submitMessage = React.useCallback(async (rawMessage: string) => {
    const trimmed = rawMessage.trim();
    if (!trimmed || loading) {
      return;
    }

    const nextUserMessage: ChatMessage = {
      role: 'user',
      content: trimmed
    };

    const nextMessages = [...messages, nextUserMessage];
    setMessages(nextMessages);
    setDraft('');
    setError(null);
    setLoading(true);

    try {
      const result = await chatBooks({
        messages: nextMessages,
        language,
        libraryContext: libraryContext?.books.length ? libraryContext : undefined
      });

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: result.reply
        }
      ]);
      setLastSource(result.source ?? null);
    } catch {
      setError(localizedCopy.errorDescription);
    } finally {
      setLoading(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [language, libraryContext, loading, localizedCopy.errorDescription, messages]);

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
    setDraft(value);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const canSend = draft.trim().length > 0 && !loading;
  const sourceLabel = lastSource === 'fallback' ? localizedCopy.sourceFallback : localizedCopy.sourceOpenrouter;

  return (
    <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <div className="min-h-0 overflow-y-auto pb-2">
        <Card className="border-white/60 bg-card/95">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">{localizedCopy.title}</h2>
              <p className="text-sm text-muted-foreground">{localizedCopy.description}</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">{localizedCopy.chipsLabel}</h3>
              <div className="flex flex-wrap gap-2.5">
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

      <div className="flex min-h-0 flex-col gap-4 overflow-hidden pb-2">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{localizedCopy.errorTitle}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="flex min-h-0 flex-1 flex-col border-white/60 bg-card/95">
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
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={localizedCopy.placeholder}
                  className="min-h-28 w-full resize-none rounded-2xl border border-input bg-background/92 px-4 py-3.5 text-sm shadow-[0_8px_24px_-20px_rgba(15,23,42,0.22)] ring-offset-background transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={loading}
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
