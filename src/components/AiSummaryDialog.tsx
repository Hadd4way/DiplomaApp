import * as React from 'react';
import { Brain, Copy, RefreshCcw, Save, X } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AiSummaryResult } from '@/services/summaryApi';

type Props = {
  open: boolean;
  loading: boolean;
  savingToHub?: boolean;
  result: AiSummaryResult | null;
  source: 'openrouter' | 'fallback' | null;
  error: string | null;
  language: 'ru' | 'en';
  bookTitle: string | null;
  actionMessage: string | null;
  actionError: string | null;
  onClose: () => void;
  onCopy: () => void;
  onSaveToHub: () => void;
  onRegenerate: () => void;
};

function getCopy(language: 'ru' | 'en') {
  return language === 'ru'
    ? {
        title: 'AI-конспект',
        loading: 'Готовим конспект по выбранным заметкам и выделениям...',
        summary: 'Краткий конспект',
        keyIdeas: 'Ключевые идеи',
        copy: 'Копировать',
        saveToHub: 'Сохранить в базу знаний',
        regenerate: 'Перегенерировать',
        close: 'Закрыть',
        empty: 'Пока пусто.',
        sourceAi: 'Источник: OpenRouter',
        sourceFallback: 'Источник: local fallback'
      }
    : {
        title: 'AI Summary',
        loading: 'Building a summary from the selected notes and highlights...',
        summary: 'Summary',
        keyIdeas: 'Key Ideas',
        copy: 'Copy',
        saveToHub: 'Save to Knowledge Hub',
        regenerate: 'Regenerate',
        close: 'Close',
        empty: 'Nothing here yet.',
        sourceAi: 'Source: OpenRouter',
        sourceFallback: 'Source: local fallback'
      };
}

function StringList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{empty}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${index}:${item}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function AiSummaryDialog({
  open,
  loading,
  savingToHub = false,
  result,
  source,
  error,
  language,
  bookTitle,
  actionMessage,
  actionError,
  onClose,
  onCopy,
  onSaveToHub,
  onRegenerate
}: Props) {
  const copy = getCopy(language);

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => (nextOpen ? undefined : onClose())}>
      <AlertDialogContent className="max-w-4xl">
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.close}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>

        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 pr-12">
            <Brain className="h-5 w-5" />
            {copy.title}
            {bookTitle ? ` - ${bookTitle}` : ''}
          </AlertDialogTitle>
        </AlertDialogHeader>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
            {copy.loading}
          </div>
        ) : null}

        {!loading && error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && result ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                {source === 'fallback' ? copy.sourceFallback : copy.sourceAi}
              </span>
            </div>

            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-slate-100 p-1">
                <TabsTrigger value="summary">{copy.summary}</TabsTrigger>
                <TabsTrigger value="ideas">{copy.keyIdeas}</TabsTrigger>
              </TabsList>

              <TabsContent value="summary">
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{result.summary || copy.empty}</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ideas">
                <StringList items={result.keyIdeas} empty={copy.empty} />
              </TabsContent>
            </Tabs>

            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
            {actionMessage ? <p className="text-sm text-emerald-700">{actionMessage}</p> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCopy} disabled={loading || !result}>
            <Copy className="mr-2 h-4 w-4" />
            {copy.copy}
          </Button>
          <Button type="button" variant="outline" onClick={onSaveToHub} disabled={loading || !result || savingToHub}>
            <Save className="mr-2 h-4 w-4" />
            {copy.saveToHub}
          </Button>
          <Button type="button" onClick={onRegenerate} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {copy.regenerate}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
