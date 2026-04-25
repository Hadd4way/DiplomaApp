import * as React from 'react';
import type { AiSummaryEntry, Book } from '../../shared/ipc';
import { BookOpen, Brain, Clock3, Copy, FileDown, Highlighter, MessageSquare, Search, Sparkles, Trash2 } from 'lucide-react';
import { AiSummaryDialog } from '@/components/AiSummaryDialog';
import { NoteEditorDialog } from '@/components/NoteEditorDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScreenEmptyState, ScreenErrorState } from '@/components/ScreenState';
import { SkeletonGrid } from '@/components/Skeletons';
import { useLanguage } from '@/contexts/LanguageContext';
import { aiSummaryToMarkdown, aiSummaryToText } from '@/lib/ai-summary';
import { LIST_BATCH_SIZE } from '@/lib/constants';
import { useIncrementalList } from '@/lib/useIncrementalList';
import { summarizeBookNotes, type AiSummaryResult } from '@/services/summaryApi';
import { cn } from '@/lib/utils';

type KnowledgeHubAnnotationItem = {
  id: string;
  bookId: string;
  bookTitle: string;
  type: 'highlight' | 'note';
  text: string | null;
  note: string | null;
  page?: number | null;
  cfiRange?: string | null;
  createdAt: number;
};

type KnowledgeHubAiSummaryItem = AiSummaryEntry & {
  type: 'ai_summary';
  text: string;
  note: null;
};

export type KnowledgeHubItem = KnowledgeHubAnnotationItem | KnowledgeHubAiSummaryItem;

type Props = {
  books: Book[];
  onOpenItem: (item: KnowledgeHubItem) => void;
};

type SortOption = 'newest' | 'oldest' | 'book-title';
type TypeFilter = 'all' | 'highlight' | 'note' | 'ai_summary';
type RecentFilter = 'all' | '7d' | '30d';

function getRecentThreshold(filter: RecentFilter): number | null {
  const now = Date.now();
  if (filter === '7d') {
    return now - 7 * 24 * 60 * 60 * 1000;
  }
  if (filter === '30d') {
    return now - 30 * 24 * 60 * 60 * 1000;
  }
  return null;
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function badgeClasses(type: KnowledgeHubItem['type']): string {
  if (type === 'highlight') {
    return 'border-amber-200 bg-amber-100 text-amber-900';
  }
  if (type === 'note') {
    return 'border-sky-200 bg-sky-100 text-sky-900';
  }
  return 'border-violet-200 bg-violet-100 text-violet-900';
}

function getBadgeLabel(language: 'ru' | 'en', type: KnowledgeHubItem['type']): string {
  if (type === 'highlight') {
    return language === 'ru' ? 'Выделение' : 'Highlight';
  }
  if (type === 'note') {
    return language === 'ru' ? 'Заметка' : 'Note';
  }
  return 'AI Summary';
}

function getAiSummaryLabels(language: 'ru' | 'en') {
  return language === 'ru'
    ? {
        title: 'AI Summary',
        summary: 'Краткий конспект',
        keyIdeas: 'Ключевые идеи',
        studyNotes: 'Учебные заметки',
        flashcards: 'Флэшкарточки',
        question: 'Вопрос',
        answer: 'Ответ',
        open: 'Открыть',
        copy: 'Копировать',
        exportMarkdown: 'Экспорт markdown',
        exportMarkdownTitle: 'Экспорт Markdown',
        loading: 'Загрузка AI-конспекта...',
        notFound: 'AI-конспект не найден.',
        copied: 'AI-конспект скопирован.',
        exportFailed: 'Не удалось экспортировать AI-конспект.',
        empty: 'Пока пусто.'
      }
    : {
        title: 'AI Summary',
        summary: 'Summary',
        keyIdeas: 'Key Ideas',
        studyNotes: 'Study Notes',
        flashcards: 'Flashcards',
        question: 'Question',
        answer: 'Answer',
        open: 'Open',
        copy: 'Copy',
        exportMarkdown: 'Export markdown',
        exportMarkdownTitle: 'Export Markdown',
        loading: 'Loading AI summary...',
        notFound: 'AI summary not found.',
        copied: 'AI summary copied.',
        exportFailed: 'Failed to export AI summary.',
        empty: 'Nothing here yet.'
      };
}

function toSummaryResult(item: KnowledgeHubAiSummaryItem): AiSummaryResult {
  return {
    summary: item.summary,
    keyIdeas: item.keyIdeas,
    studyNotes: item.studyNotes,
    flashcards: item.flashcards
  };
}

function getAiSummaryPreview(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : '';
}

export function KnowledgeHubScreen({ books, onOpenItem }: Props) {
  const { language, t } = useLanguage();
  const aiSummaryLabels = React.useMemo(() => getAiSummaryLabels(language), [language]);
  const [items, setItems] = React.useState<KnowledgeHubItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [queryInput, setQueryInput] = React.useState('');
  const deferredQuery = React.useDeferredValue(queryInput.trim().toLowerCase());
  const [selectedBookId, setSelectedBookId] = React.useState('all');
  const [selectedType, setSelectedType] = React.useState<TypeFilter>('all');
  const [selectedRecent, setSelectedRecent] = React.useState<RecentFilter>('all');
  const [sortBy, setSortBy] = React.useState<SortOption>('newest');
  const [deleteTarget, setDeleteTarget] = React.useState<KnowledgeHubItem | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<KnowledgeHubAnnotationItem | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [summarySavingToHub, setSummarySavingToHub] = React.useState(false);
  const [summaryError, setSummaryError] = React.useState<string | null>(null);
  const [summaryActionError, setSummaryActionError] = React.useState<string | null>(null);
  const [summaryActionMessage, setSummaryActionMessage] = React.useState<string | null>(null);
  const [summarySource, setSummarySource] = React.useState<'openrouter' | 'fallback' | null>(null);
  const [summaryResult, setSummaryResult] = React.useState<AiSummaryResult | null>(null);
  const [detailTarget, setDetailTarget] = React.useState<KnowledgeHubAiSummaryItem | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [detailActionError, setDetailActionError] = React.useState<string | null>(null);
  const [detailActionMessage, setDetailActionMessage] = React.useState<string | null>(null);
  const dateFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    [language]
  );

  const formatDate = React.useCallback(
    (timestamp: number): string => {
      if (!Number.isFinite(timestamp)) {
        return '';
      }
      return dateFormatter.format(new Date(timestamp));
    },
    [dateFormatter]
  );

  const loadItems = React.useCallback(async () => {
    if (!window.api) {
      setError('Renderer API is unavailable. Open this app via Electron.');
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const notesPromise = window.api.notes.list({ bookId: null, q: null });
      const summariesPromise = window.api.aiSummaries.list();
      const highlightPromises = books.map(async (book) => {
        if (book.format === 'pdf') {
          const result = await window.api!.highlights.list({ bookId: book.id });
          return { book, result };
        }

        const result = await window.api!.epubHighlights.list({ bookId: book.id });
        return { book, result };
      });

      const [notesResult, summariesResult, ...highlightResults] = await Promise.all([
        notesPromise,
        summariesPromise,
        ...highlightPromises
      ]);

      if (!notesResult.ok) {
        setError(notesResult.error);
      } else if (!summariesResult.ok) {
        setError(summariesResult.error);
      }

      const nextItems: KnowledgeHubItem[] = [];
      if (notesResult.ok) {
        for (const note of notesResult.notes) {
          const bookTitle = books.find((book) => book.id === note.bookId)?.title ?? t.hub.unknownBook;
          nextItems.push({
            id: note.id,
            bookId: note.bookId,
            bookTitle,
            type: 'note',
            text: null,
            note: normalizeText(note.content),
            page: note.page,
            cfiRange: null,
            createdAt: note.createdAt
          });
        }
      }

      for (const entry of highlightResults) {
        if (!entry?.result?.ok) {
          continue;
        }
        for (const highlight of entry.result.highlights) {
          nextItems.push({
            id: highlight.id,
            bookId: highlight.bookId,
            bookTitle: entry.book.title,
            type: 'highlight',
            text: normalizeText(highlight.text),
            note: normalizeText(highlight.note),
            page: highlight.page,
            cfiRange: highlight.cfiRange,
            createdAt: highlight.createdAt
          });
        }
      }

      if (summariesResult.ok) {
        for (const entry of summariesResult.entries) {
          nextItems.push({
            ...entry,
            type: 'ai_summary',
            text: getAiSummaryPreview(entry.summary),
            note: null
          });
        }
      }

      setItems(nextItems);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [books, t.hub.unknownBook]);

  React.useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const recentThreshold = React.useMemo(() => getRecentThreshold(selectedRecent), [selectedRecent]);

  const filteredItems = React.useMemo(() => {
    const filtered = items.filter((item) => {
      if (selectedBookId !== 'all') {
        if (item.type === 'ai_summary') {
          if (item.bookId !== selectedBookId) {
            return false;
          }
        } else if (item.bookId !== selectedBookId) {
          return false;
        }
      }

      if (selectedType !== 'all' && item.type !== selectedType) {
        return false;
      }
      if (recentThreshold !== null && item.createdAt < recentThreshold) {
        return false;
      }
      if (!deferredQuery) {
        return true;
      }

      const haystack =
        item.type === 'ai_summary'
          ? [item.bookTitle, item.author ?? '', item.summary, item.keyIdeas.join(' '), item.studyNotes.join(' ')].join(' ').toLowerCase()
          : [item.bookTitle, item.text ?? '', item.note ?? ''].join(' ').toLowerCase();

      return haystack.includes(deferredQuery);
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'oldest') {
        return a.createdAt - b.createdAt;
      }
      if (sortBy === 'book-title') {
        const titleCompare = a.bookTitle.localeCompare(b.bookTitle, language === 'ru' ? 'ru-RU' : 'en-US');
        if (titleCompare !== 0) {
          return titleCompare;
        }
        return b.createdAt - a.createdAt;
      }
      return b.createdAt - a.createdAt;
    });
  }, [deferredQuery, items, language, recentThreshold, selectedBookId, selectedType, sortBy]);
  const { visibleItems: visibleFilteredItems, hasMore, showMore } = useIncrementalList(
    filteredItems,
    LIST_BATCH_SIZE.knowledgeHub
  );

  const selectedBook = React.useMemo(
    () => books.find((book) => book.id === selectedBookId) ?? null,
    [books, selectedBookId]
  );

  const summaryItems = React.useMemo(
    () =>
      selectedBookId === 'all'
        ? []
        : filteredItems.filter(
            (item): item is KnowledgeHubAnnotationItem => item.type !== 'ai_summary' && item.bookId === selectedBookId
          ),
    [filteredItems, selectedBookId]
  );

  const canGenerateSummary = selectedBook !== null && summaryItems.length > 0;

  const summaryText = React.useMemo(() => {
    if (!selectedBook || !summaryResult) {
      return '';
    }
    return aiSummaryToText(selectedBook.title, summaryResult, language);
  }, [language, selectedBook, summaryResult]);

  const summaryMarkdown = React.useMemo(() => {
    if (!selectedBook || !summaryResult) {
      return '';
    }
    return aiSummaryToMarkdown(selectedBook.title, summaryResult, language);
  }, [language, selectedBook, summaryResult]);

  const summary = React.useMemo(() => {
    const notesCount = items.filter((item) => item.type === 'note').length;
    const highlightsCount = items.filter((item) => item.type === 'highlight').length;
    const aiSummariesCount = items.filter((item) => item.type === 'ai_summary').length;
    return {
      total: items.length,
      notes: notesCount,
      highlights: highlightsCount,
      aiSummaries: aiSummariesCount,
      books: new Set(items.map((item) => (item.type === 'ai_summary' ? item.bookId ?? `summary:${item.id}` : item.bookId))).size
    };
  }, [items]);

  const handleDelete = React.useCallback(async () => {
    if (!window.api || !deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    setError(null);
    try {
      let result:
        | Awaited<ReturnType<typeof window.api.notes.delete>>
        | Awaited<ReturnType<typeof window.api.highlights.delete>>
        | Awaited<ReturnType<typeof window.api.aiSummaries.delete>>;

      if (deleteTarget.type === 'note') {
        result = await window.api.notes.delete({ noteId: deleteTarget.id });
      } else if (deleteTarget.type === 'highlight') {
        result = await window.api.highlights.delete({ highlightId: deleteTarget.id });
      } else {
        result = await window.api.aiSummaries.delete({ id: deleteTarget.id });
      }

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDetailTarget((current) => (current?.id === deleteTarget.id ? null : current));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget]);

  const openEditDialog = React.useCallback((item: KnowledgeHubAnnotationItem) => {
    setEditTarget(item);
    setEditValue(item.note ?? '');
    setEditError(null);
  }, []);

  const handleSaveEdit = React.useCallback(async () => {
    if (!window.api || !editTarget) {
      return;
    }

    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      setEditError(editTarget.type === 'note' ? t.hub.noteRequired : t.hub.noteTextRequired);
      return;
    }

    setEditLoading(true);
    setEditError(null);
    try {
      if (editTarget.type === 'note') {
        const result = await window.api.notes.update({ noteId: editTarget.id, content: trimmedValue });
        if (!result.ok) {
          setEditError(result.error);
          return;
        }
        setItems((prev) =>
          prev.map((item) =>
            item.id === editTarget.id && item.type === 'note'
              ? {
                  ...item,
                  note: normalizeText(result.note.content),
                  page: result.note.page,
                  createdAt: result.note.createdAt
                }
              : item
          )
        );
      } else {
        const result = await window.api.highlights.updateNote({ highlightId: editTarget.id, note: trimmedValue });
        if (!result.ok) {
          setEditError(result.error);
          return;
        }
        setItems((prev) =>
          prev.map((item) =>
            item.id === editTarget.id && item.type === 'highlight'
              ? {
                  ...item,
                  note: normalizeText(result.highlight.note),
                  text: normalizeText(result.highlight.text),
                  page: result.highlight.page,
                  cfiRange: result.highlight.cfiRange,
                  createdAt: result.highlight.createdAt
                }
              : item
          )
        );
      }

      setEditTarget(null);
      setEditValue('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setEditError(message);
    } finally {
      setEditLoading(false);
    }
  }, [editTarget, editValue, t.hub.noteRequired, t.hub.noteTextRequired]);

  const handleGenerateSummary = React.useCallback(async () => {
    if (!selectedBook) {
      return;
    }

    setSummaryOpen(true);
    setSummaryLoading(true);
    setSummaryError(null);
    setSummaryActionError(null);
    setSummaryActionMessage(null);

    try {
      const response = await summarizeBookNotes({
        bookTitle: selectedBook.title,
        author: selectedBook.author ?? null,
        highlights: summaryItems
          .filter((item) => item.type === 'highlight')
          .map((item) => ({
            text: item.text,
            note: item.note
          })),
        notes: summaryItems
          .filter((item) => item.type === 'note')
          .map((item) => ({
            content: item.note ?? ''
          })),
        language
      });

      setSummarySource(response.source);
      setSummaryResult(response.result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSummaryError(message);
      setSummaryResult(null);
      setSummarySource(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [language, selectedBook, summaryItems]);

  const handleCopySummary = React.useCallback(async () => {
    if (!summaryText) {
      return;
    }

    setSummaryActionError(null);
    setSummaryActionMessage(null);
    try {
      await navigator.clipboard.writeText(summaryText);
      setSummaryActionMessage(language === 'ru' ? 'AI-конспект скопирован.' : 'AI summary copied.');
    } catch (err) {
      setSummaryActionError(err instanceof Error ? err.message : String(err));
    }
  }, [language, summaryText]);

  const handleSaveSummaryToNotes = React.useCallback(async () => {
    if (!window.api || !selectedBook || !summaryText) {
      return;
    }

    setSummaryActionError(null);
    setSummaryActionMessage(null);
    try {
      const result = await window.api.notes.create({
        bookId: selectedBook.id,
        page: 1,
        content: summaryText
      });

      if (!result.ok) {
        setSummaryActionError(result.error);
        return;
      }

      setSummaryActionMessage(language === 'ru' ? 'AI-конспект сохранён в заметки.' : 'AI summary saved to notes.');
    } catch (err) {
      setSummaryActionError(err instanceof Error ? err.message : String(err));
    }
  }, [language, selectedBook, summaryText]);

  const handleSaveSummaryToHub = React.useCallback(async () => {
    if (!window.api?.aiSummaries || !selectedBook || !summaryResult) {
      return;
    }

    setSummarySavingToHub(true);
    setSummaryActionError(null);
    setSummaryActionMessage(null);
    try {
      const result = await window.api.aiSummaries.save({
        bookId: selectedBook.id,
        bookTitle: selectedBook.title,
        author: selectedBook.author ?? null,
        language,
        summary: summaryResult.summary,
        keyIdeas: summaryResult.keyIdeas,
        studyNotes: summaryResult.studyNotes,
        flashcards: summaryResult.flashcards
      });

      if (!result.ok) {
        setSummaryActionError(result.error);
        return;
      }

      const savedItem: KnowledgeHubAiSummaryItem = {
        ...result.entry,
        type: 'ai_summary',
        text: getAiSummaryPreview(result.entry.summary),
        note: null
      };

      setItems((prev) => [savedItem, ...prev.filter((item) => item.id !== savedItem.id)]);
      setSummaryActionMessage(language === 'ru' ? 'AI-конспект сохранён' : 'AI summary saved');
    } catch (err) {
      setSummaryActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSummarySavingToHub(false);
    }
  }, [language, selectedBook, summaryResult]);

  const handleExportSummary = React.useCallback(async () => {
    if (!window.api?.export || !selectedBook || !summaryMarkdown) {
      return;
    }

    setSummaryActionError(null);
    setSummaryActionMessage(null);
    try {
      const result = await window.api.export.saveFile({
        suggestedName: `${selectedBook.title} ai-summary.md`,
        ext: 'md',
        content: summaryMarkdown
      });

      if (!result.ok) {
        if ('cancelled' in result && result.cancelled) {
          return;
        }
        setSummaryActionError('error' in result ? result.error : language === 'ru' ? 'Не удалось экспортировать конспект.' : 'Failed to export summary.');
        return;
      }

      setSummaryActionMessage(language === 'ru' ? 'Markdown сохранён.' : 'Markdown exported.');
    } catch (err) {
      setSummaryActionError(err instanceof Error ? err.message : String(err));
    }
  }, [language, selectedBook, summaryMarkdown]);

  const openAiSummaryDetail = React.useCallback(async (item: KnowledgeHubAiSummaryItem) => {
    if (!window.api?.aiSummaries) {
      return;
    }

    setDetailError(null);
    setDetailActionError(null);
    setDetailActionMessage(null);
    setDetailLoading(true);
    try {
      const result = await window.api.aiSummaries.get({ id: item.id });
      if (!result.ok) {
        setDetailError(result.error);
        setDetailTarget(item);
        return;
      }

      if (!result.entry) {
        setDetailError(aiSummaryLabels.notFound);
        setDetailTarget(item);
        return;
      }

      setDetailTarget({
        ...result.entry,
        type: 'ai_summary',
        text: getAiSummaryPreview(result.entry.summary),
        note: null
      });
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : String(err));
      setDetailTarget(item);
    } finally {
      setDetailLoading(false);
    }
  }, [aiSummaryLabels.notFound]);

  const handleCopyDetail = React.useCallback(async () => {
    if (!detailTarget) {
      return;
    }

    setDetailActionError(null);
    setDetailActionMessage(null);
    try {
      await navigator.clipboard.writeText(aiSummaryToText(detailTarget.bookTitle, toSummaryResult(detailTarget), detailTarget.language));
      setDetailActionMessage(aiSummaryLabels.copied);
    } catch (err) {
      setDetailActionError(err instanceof Error ? err.message : String(err));
    }
  }, [aiSummaryLabels.copied, detailTarget]);

  const handleExportDetail = React.useCallback(async () => {
    if (!window.api?.export || !detailTarget) {
      return;
    }

    setDetailActionError(null);
    setDetailActionMessage(null);
    try {
      const result = await window.api.export.saveFile({
        suggestedName: `${detailTarget.bookTitle} ai-summary.md`,
        ext: 'md',
        content: aiSummaryToMarkdown(detailTarget.bookTitle, toSummaryResult(detailTarget), detailTarget.language)
      });

      if (!result.ok) {
        if ('cancelled' in result && result.cancelled) {
          return;
        }
        setDetailActionError('error' in result ? result.error : aiSummaryLabels.exportFailed);
        return;
      }

      setDetailActionMessage(language === 'ru' ? 'Markdown сохранён.' : 'Markdown exported.');
    } catch (err) {
      setDetailActionError(err instanceof Error ? err.message : String(err));
    }
  }, [aiSummaryLabels.exportFailed, detailTarget, language]);

  const handleDeleteDetail = React.useCallback(() => {
    if (!detailTarget) {
      return;
    }
    setDeleteTarget(detailTarget);
  }, [detailTarget]);

  React.useEffect(() => {
    setSummaryResult(null);
    setSummarySource(null);
    setSummaryError(null);
    setSummaryActionError(null);
    setSummaryActionMessage(null);
    setSummaryOpen(false);
  }, [selectedBookId, selectedType, selectedRecent, deferredQuery, sortBy]);

  const summaryHint =
    selectedBookId === 'all'
      ? language === 'ru'
        ? 'Сначала выберите книгу, чтобы отправить только её заметки и выделения.'
        : 'Choose a book first so only that book\'s notes and highlights are sent.'
      : summaryItems.length === 0
        ? language === 'ru'
          ? 'Для текущего выбора пока нет заметок или выделений.'
          : 'There are no notes or highlights in the current selection yet.'
        : language === 'ru'
          ? `Будут использованы ${summaryItems.length} элементов из текущего выбора.`
          : `${summaryItems.length} items from the current selection will be used.`;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto pr-2">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-8">
          <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_32%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.95)_52%,_rgba(8,47,73,0.92))] p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_center,_rgba(125,211,252,0.20),_transparent_68%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-100">
                  <Brain className="h-3.5 w-3.5" />
                  {t.hub.secondBrain}
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight">{t.hub.title}</h2>
                  <p className="max-w-xl text-sm leading-6 text-slate-300">{t.hub.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  [t.hub.items, summary.total],
                  [t.hub.highlights, summary.highlights],
                  [t.hub.notes, summary.notes],
                  [aiSummaryLabels.title, summary.aiSummaries],
                  [t.hub.books, summary.books]
                ].map(([label, value]) => (
                  <Card key={label} className="border-white/10 bg-white/10 text-white shadow-none backdrop-blur">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
                      <p className="mt-2 text-2xl font-semibold">{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.7fr))]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder={language === 'ru' ? 'Поиск по заметкам, выделениям и AI-конспектам...' : 'Search across highlights, notes, and AI summaries...'} className="pl-9" />
                </div>
                <select value={selectedBookId} onChange={(event) => setSelectedBookId(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="all">{t.hub.allBooks}</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
                <select value={selectedType} onChange={(event) => setSelectedType(event.target.value as TypeFilter)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="all">{t.hub.allTypes}</option>
                  <option value="highlight">{t.hub.highlights}</option>
                  <option value="note">{t.hub.notes}</option>
                  <option value="ai_summary">{aiSummaryLabels.title}</option>
                </select>
                <select value={selectedRecent} onChange={(event) => setSelectedRecent(event.target.value as RecentFilter)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="all">{t.hub.allTime}</option>
                  <option value="7d">{t.hub.recent7}</option>
                  <option value="30d">{t.hub.recent30}</option>
                </select>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="newest">{t.hub.newest}</option>
                  <option value="oldest">{t.hub.oldest}</option>
                  <option value="book-title">{t.hub.bookTitleSort}</option>
                </select>
                <Button type="button" variant="outline" onClick={() => void loadItems()} disabled={loading}>
                  {t.hub.refresh}
                </Button>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {language === 'ru' ? 'AI-конспект по текущему выбору' : 'AI summary for the current selection'}
                  </p>
                  <p className="text-sm text-slate-500">{summaryHint}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void handleExportSummary()} disabled={!summaryMarkdown || summaryLoading}>
                    <FileDown className="mr-2 h-4 w-4" />
                    {aiSummaryLabels.exportMarkdownTitle}
                  </Button>
                  <Button type="button" onClick={() => void handleGenerateSummary()} disabled={!canGenerateSummary || summaryLoading}>
                    {language === 'ru' ? 'Сделать AI-конспект' : 'Generate AI Summary'}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  {filteredItems.length} {t.hub.surfaced}
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {t.hub.sortedBy} {sortBy === 'book-title' ? t.hub.bookTitleSort : sortBy === 'newest' ? t.hub.newest : t.hub.oldest}
                </div>
              </div>
            </div>
          </section>

          {error ? <ScreenErrorState title={language === 'ru' ? 'Ошибка' : 'Error'} description={error} onRetry={() => void loadItems()} /> : null}

          <section className="grid gap-4">
            {loading ? (
              <SkeletonGrid count={4} />
            ) : null}

            {!loading && filteredItems.length === 0 ? (
              <ScreenEmptyState
                title={t.hub.quietTitle}
                description={t.hub.quietDescription}
                icon={<Brain className="h-6 w-6 text-muted-foreground" />}
              />
            ) : null}

            {visibleFilteredItems.map((item) => (
              <Card
                key={`${item.type}:${item.id}`}
                className={cn(
                  'overflow-hidden rounded-[24px] border-slate-200 bg-white/95 shadow-[0_16px_40px_rgba(15,23,42,0.06)]',
                  item.type === 'ai_summary' ? 'cursor-pointer transition hover:border-violet-200 hover:shadow-[0_20px_48px_rgba(76,29,149,0.10)]' : ''
                )}
                onClick={item.type === 'ai_summary' ? () => void openAiSummaryDetail(item) : undefined}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-slate-900">{item.bookTitle}</p>
                        <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide', badgeClasses(item.type))}>
                          {getBadgeLabel(language, item.type)}
                        </span>
                        {item.type === 'ai_summary' && item.author ? <span className="text-sm text-slate-500">{item.author}</span> : null}
                        <span className="text-xs text-slate-400">{formatDate(item.createdAt)}</span>
                      </div>

                      {item.type === 'ai_summary' ? (
                        <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-900">
                            <Brain className="h-3.5 w-3.5" />
                            {aiSummaryLabels.title}
                          </div>
                          <p
                            className="overflow-hidden text-sm leading-6 text-slate-800"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical'
                            }}
                          >
                            {item.summary}
                          </p>
                        </div>
                      ) : (
                        <>
                          {item.text ? (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
                                <Highlighter className="h-3.5 w-3.5" />
                                {t.hub.highlightedText}
                              </div>
                              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{item.text}</p>
                            </div>
                          ) : null}

                          <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                              <MessageSquare className="h-3.5 w-3.5" />
                              {t.hub.noteText}
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.note ?? t.hub.noNoteYet}</p>
                          </div>
                        </>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {item.type !== 'ai_summary' && typeof item.page === 'number' ? <span>{t.hub.page} {item.page}</span> : null}
                        {item.type !== 'ai_summary' && item.cfiRange ? <span className="truncate">{t.hub.locationReady}</span> : null}
                        {item.type === 'ai_summary' ? <span>{item.language.toUpperCase()}</span> : null}
                      </div>
                    </div>

                    <div
                      className="flex shrink-0 flex-row gap-2 lg:w-[190px] lg:flex-col"
                      onClick={item.type === 'ai_summary' ? (event) => event.stopPropagation() : undefined}
                    >
                      {item.type === 'ai_summary' ? (
                        <>
                          <Button type="button" onClick={() => void openAiSummaryDetail(item)} className="flex-1 lg:w-full">
                            <Brain className="mr-2 h-4 w-4" />
                            {aiSummaryLabels.open}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setDeleteTarget(item)} className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 lg:w-full">
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t.hub.delete}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button type="button" onClick={() => onOpenItem(item)} className="flex-1 lg:w-full">
                            <BookOpen className="mr-2 h-4 w-4" />
                            {t.hub.openInBook}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => openEditDialog(item)} className="flex-1 lg:w-full">
                            {t.hub.editNote}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setDeleteTarget(item)} className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 lg:w-full">
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t.hub.delete}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loading && hasMore ? (
              <div className="flex justify-center pt-2">
                <Button type="button" variant="outline" onClick={showMore}>
                  Show more
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => (open ? undefined : setDeleteTarget(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.hub.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'highlight'
                ? t.hub.deleteHighlightDescription
                : deleteTarget?.type === 'note'
                  ? t.hub.deleteNoteDescription
                  : language === 'ru'
                    ? 'Этот AI-конспект будет удалён из базы знаний.'
                    : 'This AI summary will be removed from the Knowledge Hub.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>{t.hub.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={deleteLoading}>
              {t.hub.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NoteEditorDialog
        open={Boolean(editTarget)}
        title={editTarget?.type === 'highlight' ? t.hub.editHighlightNote : t.hub.editNoteTitle}
        subtitle={editTarget ? `${editTarget.bookTitle}${typeof editTarget.page === 'number' ? ` - ${t.hub.page.toLowerCase()} ${editTarget.page}` : ''}` : undefined}
        value={editValue}
        onValueChange={setEditValue}
        error={editError}
        saving={editLoading}
        onCancel={() => {
          setEditTarget(null);
          setEditValue('');
          setEditError(null);
        }}
        onSave={() => void handleSaveEdit()}
      />

      <AiSummaryDialog
        open={summaryOpen}
        loading={summaryLoading}
        savingToHub={summarySavingToHub}
        result={summaryResult}
        source={summarySource}
        error={summaryError}
        language={language}
        bookTitle={selectedBook?.title ?? null}
        actionMessage={summaryActionMessage}
        actionError={summaryActionError}
        onClose={() => setSummaryOpen(false)}
        onCopy={() => void handleCopySummary()}
        onSaveToNotes={() => void handleSaveSummaryToNotes()}
        onSaveToHub={() => void handleSaveSummaryToHub()}
        onRegenerate={() => void handleGenerateSummary()}
      />

      <AlertDialog
        open={Boolean(detailTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailTarget(null);
            setDetailError(null);
            setDetailActionError(null);
            setDetailActionMessage(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-4xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {detailTarget?.bookTitle}
              {detailTarget?.author ? ` - ${detailTarget.author}` : ''}
            </AlertDialogTitle>
          </AlertDialogHeader>

          {detailLoading ? <p className="text-sm text-slate-500">{aiSummaryLabels.loading}</p> : null}
          {detailError ? <p className="text-sm text-destructive">{detailError}</p> : null}

          {detailTarget ? (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide', badgeClasses('ai_summary'))}>
                  {aiSummaryLabels.title}
                </span>
                <span>{formatDate(detailTarget.createdAt)}</span>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">{aiSummaryLabels.summary}</h3>
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{detailTarget.summary}</p>
                  </CardContent>
                </Card>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">{aiSummaryLabels.keyIdeas}</h3>
                <div className="space-y-2">
                  {detailTarget.keyIdeas.length === 0 ? (
                    <p className="text-sm text-slate-500">{aiSummaryLabels.empty}</p>
                  ) : (
                    detailTarget.keyIdeas.map((item, index) => (
                      <div key={`${index}:${item}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {item}
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">{aiSummaryLabels.studyNotes}</h3>
                <div className="space-y-2">
                  {detailTarget.studyNotes.length === 0 ? (
                    <p className="text-sm text-slate-500">{aiSummaryLabels.empty}</p>
                  ) : (
                    detailTarget.studyNotes.map((item, index) => (
                      <div key={`${index}:${item}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {item}
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">{aiSummaryLabels.flashcards}</h3>
                <div className="space-y-3">
                  {detailTarget.flashcards.length === 0 ? (
                    <p className="text-sm text-slate-500">{aiSummaryLabels.empty}</p>
                  ) : (
                    detailTarget.flashcards.map((card, index) => (
                      <Card key={`${index}:${card.question}`} className="border-slate-200">
                        <CardContent className="space-y-2 p-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{aiSummaryLabels.question}</p>
                            <p className="mt-1 text-sm text-slate-800">{card.question}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{aiSummaryLabels.answer}</p>
                            <p className="mt-1 text-sm text-slate-700">{card.answer}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </section>

              {detailActionError ? <p className="text-sm text-destructive">{detailActionError}</p> : null}
              {detailActionMessage ? <p className="text-sm text-emerald-700">{detailActionMessage}</p> : null}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => void handleCopyDetail()} disabled={!detailTarget}>
              <Copy className="mr-2 h-4 w-4" />
              {aiSummaryLabels.copy}
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleExportDetail()} disabled={!detailTarget}>
              <FileDown className="mr-2 h-4 w-4" />
              {aiSummaryLabels.exportMarkdown}
            </Button>
            <Button type="button" variant="outline" onClick={handleDeleteDetail} disabled={!detailTarget} className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800">
              <Trash2 className="mr-2 h-4 w-4" />
              {t.hub.delete}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
