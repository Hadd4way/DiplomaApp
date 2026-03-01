import type { Book, Highlight, Note } from '../../shared/ipc';

function normalizeText(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }
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
  lines.push(`Total highlights: ${highlights.length}`);
  lines.push(`Total notes: ${notes.length}`);
  lines.push('');
  lines.push('## Highlights');

  const highlightsByPage = groupByPage(highlights);
  const highlightPages = [...highlightsByPage.keys()].sort((a, b) => a - b);
  if (highlightPages.length === 0) {
    lines.push('- No highlights');
  } else {
    for (const page of highlightPages) {
      lines.push(`### Page ${page}`);
      const pageHighlights = highlightsByPage.get(page) ?? [];
      for (const highlight of pageHighlights) {
        const text = normalizeText(highlight.text);
        lines.push(`> ${text || '(highlight without text)'}`);
        lines.push('');
      }
    }
  }

  lines.push('## Notes');
  const notesByPage = groupByPage(notes);
  const notePages = [...notesByPage.keys()].sort((a, b) => a - b);
  if (notePages.length === 0) {
    lines.push('- No notes');
  } else {
    for (const page of notePages) {
      lines.push(`### Page ${page}`);
      const pageNotes = notesByPage.get(page) ?? [];
      for (const note of pageNotes) {
        lines.push(`- ${normalizeText(note.content)}`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export function toJSON(book: Book, notes: Note[], highlights: Highlight[]): string {
  return JSON.stringify(
    {
      book,
      exportedAt: new Date().toISOString(),
      highlights: highlights.map((highlight) => ({
        page: highlight.page,
        text: highlight.text,
        rects: highlight.rects,
        createdAt: highlight.createdAt
      })),
      notes: notes.map((note) => ({
        page: note.page,
        content: note.content,
        createdAt: note.createdAt
      }))
    },
    null,
    2
  );
}
