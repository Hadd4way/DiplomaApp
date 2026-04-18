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

function localNameOf(node: Node | null | undefined): string {
  if (!node) {
    return '';
  }
  const value = (node as Element).localName ?? node.nodeName;
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function elementChildren(node: Element, name?: string): Element[] {
  return Array.from(node.childNodes).filter((child): child is Element => {
    if (!(child instanceof Element)) {
      return false;
    }
    return !name || localNameOf(child) === name;
  });
}

function firstElement(node: Element, name: string): Element | null {
  return elementChildren(node, name)[0] ?? null;
}

function textContent(node: Node | null | undefined): string {
  return normalizeWhitespace(node?.textContent ?? '');
}

function getAttr(node: Element, ...names: string[]): string | null {
  for (const name of names) {
    const value = node.getAttribute(name);
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

type Fb2SearchBlock = {
  id: string;
  chapterIndex: number;
  chapterTitle: string;
  text: string;
};

export type Fb2Chapter = {
  id: string;
  title: string;
  html: string;
  text: string;
};

export type Fb2Document = {
  title: string;
  author: string | null;
  coverImage: string | null;
  chapters: Fb2Chapter[];
  searchBlocks: Fb2SearchBlock[];
};

type RenderContext = {
  chapterIndex: number;
  searchBlocks: Fb2SearchBlock[];
  blockCounter: number;
};

function nextBlockId(context: RenderContext): string {
  const id = `fb2-block-${context.chapterIndex}-${context.blockCounter}`;
  context.blockCounter += 1;
  return id;
}

function renderInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? '');
  }
  if (!(node instanceof Element)) {
    return '';
  }

  const children = Array.from(node.childNodes).map(renderInline).join('');
  switch (localNameOf(node)) {
    case 'strong':
      return `<strong>${children}</strong>`;
    case 'emphasis':
      return `<em>${children}</em>`;
    case 'strikethrough':
      return `<s>${children}</s>`;
    case 'sub':
      return `<sub>${children}</sub>`;
    case 'sup':
      return `<sup>${children}</sup>`;
    case 'code':
      return `<code>${children}</code>`;
    case 'a': {
      const href = getAttr(node, 'l:href', 'xlink:href', 'href');
      const safeHref = href && /^(https?:|mailto:|#)/i.test(href) ? href : '#';
      return `<a href="${escapeHtml(safeHref)}">${children}</a>`;
    }
    default:
      return children;
  }
}

function renderParagraphLike(node: Element, tagName: string, className: string, context: RenderContext, chapterTitle: string): string {
  const html = Array.from(node.childNodes).map(renderInline).join('').trim();
  const text = textContent(node);
  if (!html && !text) {
    return '';
  }

  const blockId = nextBlockId(context);
  if (text) {
    context.searchBlocks.push({
      id: blockId,
      chapterIndex: context.chapterIndex,
      chapterTitle,
      text
    });
  }

  return `<${tagName} class="${className}" data-fb2-block-id="${blockId}">${html || '&nbsp;'}</${tagName}>`;
}

function renderSection(section: Element, context: RenderContext, chapterTitle: string, sectionDepth = 0): string {
  const parts: string[] = [];

  for (const child of Array.from(section.childNodes)) {
    if (!(child instanceof Element)) {
      continue;
    }

    const name = localNameOf(child);
    if (name === 'title') {
      const titleText = textContent(child) || chapterTitle;
      const level = Math.min(6, sectionDepth + 2);
      parts.push(`<h${level} class="fb2-section-title">${escapeHtml(titleText)}</h${level}>`);
      continue;
    }
    if (name === 'epigraph') {
      const inner = elementChildren(child)
        .map((item) => {
          const itemName = localNameOf(item);
          if (itemName === 'text-author') {
            return renderParagraphLike(item, 'footer', 'fb2-epigraph-author', context, chapterTitle);
          }
          return renderParagraphLike(item, 'p', 'fb2-epigraph-paragraph', context, chapterTitle);
        })
        .join('');
      if (inner) {
        parts.push(`<blockquote class="fb2-epigraph">${inner}</blockquote>`);
      }
      continue;
    }
    if (name === 'poem') {
      const titleNode = firstElement(child, 'title');
      const titleHtml = titleNode ? `<div class="fb2-poem-title">${escapeHtml(textContent(titleNode))}</div>` : '';
      const stanzas = elementChildren(child, 'stanza')
        .map((stanza) => {
          const lines = elementChildren(stanza)
            .map((line) => {
              const lineName = localNameOf(line);
              if (lineName === 'v') {
                return renderParagraphLike(line, 'p', 'fb2-poem-line', context, chapterTitle);
              }
              if (lineName === 'subtitle') {
                return renderParagraphLike(line, 'p', 'fb2-poem-subtitle', context, chapterTitle);
              }
              return '';
            })
            .join('');
          return lines ? `<div class="fb2-stanza">${lines}</div>` : '';
        })
        .join('');
      const authorNode = firstElement(child, 'text-author');
      const authorHtml = authorNode ? renderParagraphLike(authorNode, 'footer', 'fb2-poem-author', context, chapterTitle) : '';
      const poemBody = `${titleHtml}${stanzas}${authorHtml}`;
      if (poemBody) {
        parts.push(`<section class="fb2-poem">${poemBody}</section>`);
      }
      continue;
    }
    if (name === 'cite') {
      const inner = elementChildren(child)
        .map((item) => renderParagraphLike(item, 'p', 'fb2-cite-paragraph', context, chapterTitle))
        .join('');
      if (inner) {
        parts.push(`<blockquote class="fb2-cite">${inner}</blockquote>`);
      }
      continue;
    }
    if (name === 'subtitle') {
      parts.push(renderParagraphLike(child, 'h3', 'fb2-subtitle', context, chapterTitle));
      continue;
    }
    if (name === 'text-author') {
      parts.push(renderParagraphLike(child, 'footer', 'fb2-text-author', context, chapterTitle));
      continue;
    }
    if (name === 'empty-line') {
      parts.push('<div class="fb2-empty-line" aria-hidden="true"></div>');
      continue;
    }
    if (name === 'image') {
      const href = getAttr(child, 'l:href', 'xlink:href', 'href');
      if (href && !href.startsWith('#')) {
        parts.push(`<img class="fb2-inline-image" src="${escapeHtml(href)}" alt="" />`);
      }
      continue;
    }
    if (name === 'p') {
      parts.push(renderParagraphLike(child, 'p', 'fb2-paragraph', context, chapterTitle));
      continue;
    }
    if (name === 'section') {
      parts.push(
        `<section class="fb2-nested-section">${renderSection(child, context, chapterTitle, sectionDepth + 1)}</section>`
      );
      continue;
    }
  }

  return parts.join('');
}

function buildChapter(section: Element, chapterIndex: number): { title: string; html: string; text: string; searchBlocks: Fb2SearchBlock[] } {
  const titleNode = firstElement(section, 'title');
  const title = textContent(titleNode) || `Chapter ${chapterIndex + 1}`;
  const context: RenderContext = {
    chapterIndex,
    searchBlocks: [],
    blockCounter: 0
  };
  const html = renderSection(section, context, title);
  const text = normalizeWhitespace(context.searchBlocks.map((block) => block.text).join(' '));

  return {
    title,
    html,
    text,
    searchBlocks: context.searchBlocks
  };
}

function extractMetadata(root: Element): { title: string; author: string | null; coverId: string | null } {
  const titleInfo = Array.from(root.getElementsByTagName('*')).find((node) => localNameOf(node) === 'title-info') ?? null;
  if (!titleInfo) {
    return { title: 'Untitled FB2', author: null, coverId: null };
  }

  const bookTitle = textContent(firstElement(titleInfo, 'book-title')) || 'Untitled FB2';
  const authorNode = firstElement(titleInfo, 'author');
  const authorParts = authorNode
    ? ['first-name', 'middle-name', 'last-name']
        .map((name) => textContent(firstElement(authorNode, name)))
        .filter((part) => part.length > 0)
    : [];
  const authorNickname = authorNode ? textContent(firstElement(authorNode, 'nickname')) : '';
  const coverImageNode = titleInfo ? Array.from(titleInfo.getElementsByTagName('*')).find((node) => localNameOf(node) === 'image') ?? null : null;
  const coverHref = coverImageNode ? getAttr(coverImageNode, 'l:href', 'xlink:href', 'href') : null;

  return {
    title: bookTitle,
    author: authorParts.join(' ').trim() || authorNickname || null,
    coverId: coverHref ? coverHref.replace(/^#/, '') : null
  };
}

function buildCoverImage(root: Element, coverId: string | null): string | null {
  if (!coverId) {
    return null;
  }

  const binaryNode =
    Array.from(root.getElementsByTagName('*')).find(
      (node) => localNameOf(node) === 'binary' && getAttr(node, 'id') === coverId
    ) ?? null;
  if (!binaryNode) {
    return null;
  }

  const contentType = getAttr(binaryNode, 'content-type') || 'image/jpeg';
  const payload = normalizeWhitespace(binaryNode.textContent ?? '').replace(/\s+/g, '');
  if (!payload) {
    return null;
  }
  return `data:${contentType};base64,${payload}`;
}

export function parseFb2Document(xml: string): Fb2Document {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(xml, 'application/xml');
  const parserError = documentNode.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Failed to parse FB2 document.');
  }

  const root = documentNode.documentElement;
  const metadata = extractMetadata(root);
  const bodies = Array.from(root.childNodes).filter(
    (node): node is Element => node instanceof Element && localNameOf(node) === 'body'
  );
  const chapterSections = bodies.flatMap((body) => {
    const sections = elementChildren(body, 'section');
    if (sections.length > 0) {
      return sections;
    }
    return [body];
  });

  const builtChapters = chapterSections.map((section, index) => buildChapter(section, index));
  const chapters = builtChapters.map((chapter, index) => ({
    id: `fb2-chapter-${index}`,
    title: chapter.title,
    html: chapter.html,
    text: chapter.text
  }));
  const searchBlocks = builtChapters.flatMap((chapter) => chapter.searchBlocks);

  return {
    title: metadata.title,
    author: metadata.author,
    coverImage: buildCoverImage(root, metadata.coverId),
    chapters: chapters.length > 0 ? chapters : [{ id: 'fb2-chapter-0', title: metadata.title, html: '', text: '' }],
    searchBlocks
  };
}
