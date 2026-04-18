function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

export type TxtSearchBlock = {
  id: string;
  chapterIndex: number;
  chapterTitle: string;
  text: string;
};

export type TxtChapter = {
  id: string;
  title: string;
  html: string;
  text: string;
};

export type TxtDocument = {
  title: string;
  author: string | null;
  coverImage: string | null;
  chapters: TxtChapter[];
  searchBlocks: TxtSearchBlock[];
};

export function parseTxtDocument(content: string, fallbackTitle: string): TxtDocument {
  const title = fallbackTitle.trim() || 'Untitled TXT';
  const normalizedContent = normalizeNewlines(content).replace(/^\uFEFF/, '').trim();
  const rawParagraphs = normalizedContent
    ? normalizedContent.split(/\n\s*\n+/).map((paragraph) => paragraph.trim()).filter((paragraph) => paragraph.length > 0)
    : [];

  const searchBlocks: TxtSearchBlock[] = [];
  const htmlParts = rawParagraphs.map((paragraph, index) => {
    const blockId = `txt-block-0-${index}`;
    searchBlocks.push({
      id: blockId,
      chapterIndex: 0,
      chapterTitle: title,
      text: normalizeWhitespace(paragraph)
    });
    return `<p class="txt-paragraph fb2-paragraph" data-flow-block-id="${blockId}">${escapeHtml(paragraph)}</p>`;
  });

  const chapterText = normalizeWhitespace(searchBlocks.map((block) => block.text).join(' '));

  return {
    title,
    author: null,
    coverImage: null,
    chapters: [
      {
        id: 'txt-chapter-0',
        title,
        html: htmlParts.join(''),
        text: chapterText
      }
    ],
    searchBlocks
  };
}
