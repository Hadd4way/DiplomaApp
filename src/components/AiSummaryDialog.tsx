import * as React from 'react';
import { Brain, Copy, RefreshCcw, Save, X } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReaderSettings } from '@/contexts/ReaderSettingsContext';
import { getReaderButtonStyles, getReaderThemePalette } from '@/lib/reader-theme';
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

function StringList({
  items,
  empty,
  panelBg,
  borderColor,
  textColor,
  mutedText
}: {
  items: string[];
  empty: string;
  panelBg: string;
  borderColor: string;
  textColor: string;
  mutedText: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm" style={{ color: mutedText }}>{empty}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={`${index}:${item}`}
          className="rounded-xl border px-3 py-2 text-sm"
          style={{
            borderColor,
            backgroundColor: panelBg,
            color: textColor
          }}
        >
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
  const { settings } = useReaderSettings();
  const palette = getReaderThemePalette(settings);

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => (nextOpen ? undefined : onClose())}>
      <AlertDialogContent
        className="max-w-4xl"
        style={{
          background: `linear-gradient(180deg, ${palette.chromeBg} 0%, ${palette.panelBg} 100%)`,
          borderColor: palette.chromeBorder,
          color: palette.chromeText
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.close}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
          style={getReaderButtonStyles(settings)}
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
          <div
            className="rounded-2xl border px-4 py-10 text-center text-sm"
            style={{
              borderColor: palette.chromeBorder,
              backgroundColor: palette.panelHoverBg,
              color: palette.mutedText
            }}
          >
            {copy.loading}
          </div>
        ) : null}

        {!loading && error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && result ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: palette.mutedText }}>
              <span
                className="rounded-full border px-3 py-1"
                style={{
                  borderColor: palette.chromeBorder,
                  backgroundColor: palette.panelHoverBg,
                  color: palette.mutedText
                }}
              >
                {source === 'fallback' ? copy.sourceFallback : copy.sourceAi}
              </span>
            </div>

            <Tabs defaultValue="summary" className="w-full">
              <TabsList
                className="grid h-auto w-full grid-cols-2 gap-1 p-1"
                style={{
                  backgroundColor: palette.panelHoverBg,
                  color: palette.mutedText
                }}
              >
                <TabsTrigger
                  value="summary"
                  style={{ color: palette.chromeText }}
                  className="data-[state=active]:shadow-none"
                >
                  {copy.summary}
                </TabsTrigger>
                <TabsTrigger
                  value="ideas"
                  style={{ color: palette.chromeText }}
                  className="data-[state=active]:shadow-none"
                >
                  {copy.keyIdeas}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary">
                <Card
                  className="border"
                  style={{
                    borderColor: palette.chromeBorder,
                    backgroundColor: palette.panelBg,
                    color: palette.chromeText
                  }}
                >
                  <CardContent className="p-4">
                    <p className="whitespace-pre-wrap text-sm leading-7" style={{ color: result.summary ? palette.chromeText : palette.mutedText }}>
                      {result.summary || copy.empty}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ideas">
                <StringList
                  items={result.keyIdeas}
                  empty={copy.empty}
                  panelBg={palette.panelHoverBg}
                  borderColor={palette.chromeBorder}
                  textColor={palette.chromeText}
                  mutedText={palette.mutedText}
                />
              </TabsContent>
            </Tabs>

            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
            {actionMessage ? <p className="text-sm" style={{ color: palette.accentText }}>{actionMessage}</p> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCopy} disabled={loading || !result} style={getReaderButtonStyles(settings)}>
            <Copy className="mr-2 h-4 w-4" />
            {copy.copy}
          </Button>
          <Button type="button" variant="outline" onClick={onSaveToHub} disabled={loading || !result || savingToHub} style={getReaderButtonStyles(settings)}>
            <Save className="mr-2 h-4 w-4" />
            {copy.saveToHub}
          </Button>
          <Button type="button" onClick={onRegenerate} disabled={loading} style={getReaderButtonStyles(settings, true)}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {copy.regenerate}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
