import type { Book, Highlight, Note } from '../../shared/ipc';

function normalizeText(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\r\n/g, '\n').trim();
}

function groupByLocation<T extends { page: number | null; cfiRange?: string | null }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.page === null ? `cfi:${item.cfiRange ?? 'unknown'}` : `page:${item.page}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
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

function formatLocationHeading(key: string): string {
  if (key.startsWith('page:')) {
    return `Page ${key.slice(5)}`;
  }
  const cfi = key.slice(4);
  if (cfi === 'unknown') {
    return 'Flow Location';
  }
  if (cfi.startsWith('fb2-')) {
    return 'FB2 Location';
  }
  return `Flow Location (${cfi})`;
}

export function toMarkdown(bookTitle: string, notes: Note[], highlights: Highlight[]): string {
  const lines: string[] = [];
  lines.push(`# ${bookTitle}`);
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push(`Total highlights: ${highlights.length}`);
  lines.push(`Total notes: ${notes.length}`);
  lines.push('');
  lines.push('## Highlights');

  const highlightsByLocation = groupByLocation(highlights);
  const highlightLocations = [...highlightsByLocation.keys()].sort((a, b) => a.localeCompare(b));
  if (highlightLocations.length === 0) {
    lines.push('- No highlights');
  } else {
    for (const location of highlightLocations) {
      lines.push(`### ${formatLocationHeading(location)}`);
      const pageHighlights = highlightsByLocation.get(location) ?? [];
      for (const highlight of pageHighlights) {
        const text = normalizeText(highlight.text);
        const note = normalizeText(highlight.note);
        lines.push(`> ${text || '(highlight without text)'}`);
        if (note) {
          lines.push(`Note: ${note}`);
        }
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
        cfiRange: highlight.cfiRange,
        text: highlight.text,
        note: highlight.note,
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
