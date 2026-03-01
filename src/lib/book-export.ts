import type { Book, Highlight, Note } from '../../shared/ipc';

function escapeMarkdownText(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

function groupByPage<T extends { page: number }>(items: T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const existing = groups.get(item.page);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.page, [item]);
    }
  }
  return groups;
}

export function toMarkdown(bookTitle: string, notes: Note[], highlights: Highlight[]): string {
  const lines: string[] = [];
  lines.push(`# ${bookTitle}`);
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Highlights');

  const highlightsByPage = groupByPage(highlights);
  const highlightPages = [...highlightsByPage.keys()].sort((a, b) => a - b);
  if (highlightPages.length === 0) {
    lines.push('- No highlights');
  } else {
    for (const page of highlightPages) {
      const pageHighlights = highlightsByPage.get(page) ?? [];
      lines.push(`### Page ${page}`);
      lines.push(`- Page ${page} - ${pageHighlights.length} highlight blocks`);
      lines.push('');
    }
  }

  lines.push('## Notes');
  const notesByPage = groupByPage(notes);
  const notePages = [...notesByPage.keys()].sort((a, b) => a - b);
  if (notePages.length === 0) {
    lines.push('- No notes');
  } else {
    for (const page of notePages) {
      const pageNotes = notesByPage.get(page) ?? [];
      lines.push(`### Page ${page}`);
      for (const note of pageNotes) {
        lines.push(`- ${escapeMarkdownText(note.content)}`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export function toJSON(book: Book, notes: Note[], highlights: Highlight[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      book,
      notes,
      highlights
    },
    null,
    2
  );
}
