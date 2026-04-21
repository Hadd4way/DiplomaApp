import type { AiSummaryResult } from '@/services/summaryApi';

export function aiSummaryToText(bookTitle: string, result: AiSummaryResult, language: 'ru' | 'en'): string {
  const lines: string[] = [];
  const labels =
    language === 'ru'
      ? {
          summary: 'Краткий конспект',
          ideas: 'Ключевые идеи',
          empty: 'Нет данных'
        }
      : {
          summary: 'Summary',
          ideas: 'Key Ideas',
          empty: 'No data'
        };

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

  return `${lines.join('\n').trimEnd()}\n`;
}
