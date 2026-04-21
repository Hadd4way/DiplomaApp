import type { AiSummaryResult } from '@/services/summaryApi';

function getLabels(language: 'ru' | 'en') {
  return language === 'ru'
    ? {
        summary: 'Краткий конспект',
        ideas: 'Ключевые идеи',
        studyNotes: 'Учебные заметки',
        flashcards: 'Флэшкарточки',
        empty: 'Нет данных'
      }
    : {
        summary: 'Summary',
        ideas: 'Key Ideas',
        studyNotes: 'Study Notes',
        flashcards: 'Flashcards',
        empty: 'No data'
      };
}

export function aiSummaryToMarkdown(bookTitle: string, result: AiSummaryResult, language: 'ru' | 'en'): string {
  const lines: string[] = [];
  const labels = getLabels(language);

  lines.push(`# ${bookTitle}`);
  lines.push('');
  lines.push(`## ${labels.summary}`);
  lines.push(result.summary || labels.empty);
  lines.push('');
  lines.push(`## ${labels.ideas}`);
  if (result.keyIdeas.length === 0) {
    lines.push(`- ${labels.empty}`);
  } else {
    for (const item of result.keyIdeas) {
      lines.push(`- ${item}`);
    }
  }

  lines.push('');
  lines.push(`## ${labels.studyNotes}`);
  if (result.studyNotes.length === 0) {
    lines.push(`- ${labels.empty}`);
  } else {
    for (const item of result.studyNotes) {
      lines.push(`- ${item}`);
    }
  }

  lines.push('');
  lines.push(`## ${labels.flashcards}`);
  if (result.flashcards.length === 0) {
    lines.push(`- ${labels.empty}`);
  } else {
    for (const card of result.flashcards) {
      lines.push(`- Q: ${card.question}`);
      lines.push(`  A: ${card.answer}`);
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export function aiSummaryToText(bookTitle: string, result: AiSummaryResult, language: 'ru' | 'en'): string {
  return aiSummaryToMarkdown(bookTitle, result, language);
}
