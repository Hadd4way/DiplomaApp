import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';
import type {
  Book,
  DiscoverBookFormat,
  DiscoverBookResult,
  DiscoverBookSource,
  DiscoverDownloadRequest,
  DiscoverDownloadResult,
  DiscoverSearchRequest,
  DiscoverSearchResult
} from '../shared/ipc';
import { importBookFromPath } from './books';

type GutendexBook = {
  id: number;
  title: string;
  authors?: Array<{ name?: string | null }>;
  languages?: string[];
  formats?: Record<string, string>;
};

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function stripHtmlToText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  );
}

function toAbsoluteUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  return new URL(url, 'https://standardebooks.org').toString();
}

function normalizeForDuplicate(value: string | null | undefined) {
  return (value ?? '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasDuplicateBook(db: Database.Database, userId: string, title: string, author: string | null) {
  const rows = db
    .prepare(
      `SELECT title, author
       FROM books
       WHERE user_id = ?`
    )
    .all(userId) as Array<{ title: string; author: string | null }>;

  const normalizedTitle = normalizeForDuplicate(title);
  const normalizedAuthor = normalizeForDuplicate(author);

  return rows.some((row) => {
    const rowTitle = normalizeForDuplicate(row.title);
    const rowAuthor = normalizeForDuplicate(row.author);
    return rowTitle === normalizedTitle && rowAuthor === normalizedAuthor;
  });
}

function mapMimeTypeToFormat(mimeType: string | null): DiscoverBookFormat {
  const value = (mimeType ?? '').toLocaleLowerCase();
  if (value.includes('application/epub+zip')) {
    return 'epub';
  }
  if (value.includes('text/plain')) {
    return 'txt';
  }
  if (value.includes('text/html') || value.includes('application/xhtml+xml')) {
    return 'html';
  }
  return 'other';
}

function pickGutendexDownload(formats: Record<string, string> | undefined) {
  if (!formats) {
    return null;
  }

  const preferenceOrder = [
    'application/epub+zip',
    'text/plain',
    'text/html'
  ] as const;

  for (const preferredMime of preferenceOrder) {
    const entry = Object.entries(formats).find(([mimeType, downloadUrl]) => {
      if (!downloadUrl || downloadUrl.endsWith('.zip')) {
        return false;
      }

      return mimeType.toLocaleLowerCase().startsWith(preferredMime);
    });

    if (entry) {
      return {
        downloadUrl: entry[1],
        format: mapMimeTypeToFormat(entry[0])
      };
    }
  }

  return null;
}

async function searchGutenberg(query: string): Promise<DiscoverBookResult[]> {
  const response = await fetch(`https://gutendex.com/books?search=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error(`Gutendex search failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as { results?: GutendexBook[] };
  const books = payload.results ?? [];

  return books
    .map((book) => {
      const bestDownload = pickGutendexDownload(book.formats);
      if (!bestDownload?.downloadUrl) {
        return null;
      }

      const authors = (book.authors ?? [])
        .map((author) => author.name?.trim() || null)
        .filter((author): author is string => Boolean(author));
      const languages = (book.languages ?? []).filter(Boolean);

      return {
        id: `gutenberg:${book.id}`,
        source: 'gutenberg' as const,
        title: book.title?.trim() || 'Untitled',
        author: authors.length > 0 ? authors.join(', ') : null,
        language: languages.length > 0 ? languages.join(', ') : null,
        coverUrl: book.formats?.['image/jpeg'] ?? null,
        downloadUrl: bestDownload.downloadUrl,
        format: bestDownload.format
      };
    })
    .filter(isDefined);
}

function extractXmlTagValue(source: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = source.match(pattern);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

function extractXmlLinks(source: string) {
  return [...source.matchAll(/<link\b([^>]+?)\/>/gi)].map((match) => {
    const attributeBlock = match[1] ?? '';
    const getAttribute = (name: string) =>
      attributeBlock.match(new RegExp(`${name}="([^"]*)"`, 'i'))?.[1] ?? null;

    return {
      href: getAttribute('href'),
      rel: getAttribute('rel'),
      type: getAttribute('type'),
      title: getAttribute('title')
    };
  });
}

async function searchStandardEbooks(query: string): Promise<DiscoverBookResult[]> {
  const response = await fetch(
    `https://standardebooks.org/feeds/opds/all?query=${encodeURIComponent(query)}&per-page=24&page=1`
  );
  if (!response.ok) {
    throw new Error(`Standard Ebooks search failed with status ${response.status}.`);
  }

  const xml = await response.text();
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) ?? [];

  return entries
    .map((entry) => {
      const title = extractXmlTagValue(entry, 'title');
      const authorMatch = entry.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i);
      const author = authorMatch?.[1] ? decodeHtmlEntities(authorMatch[1].trim()) : null;
      const language = extractXmlTagValue(entry, 'dc:language');
      const links = extractXmlLinks(entry);
      const coverUrl = links.find((link) => link.rel === 'http://opds-spec.org/image')?.href ?? null;
      const epubLink =
        links.find((link) => link.type === 'application/epub+zip' && /recommended compatible epub/i.test(link.title ?? '')) ??
        links.find((link) => link.type === 'application/epub+zip') ??
        null;
      const htmlLink = links.find((link) => link.type === 'application/xhtml+xml') ?? null;
      const preferredLink = epubLink ?? htmlLink;

      if (!title || !preferredLink?.href) {
        return null;
      }

      return {
        id: `standardebooks:${extractXmlTagValue(entry, 'id') ?? title}`,
        source: 'standardebooks' as const,
        title,
        author,
        language,
        coverUrl: coverUrl ? toAbsoluteUrl(coverUrl) : null,
        downloadUrl: toAbsoluteUrl(preferredLink.href),
        format: mapMimeTypeToFormat(preferredLink.type)
      };
    })
    .filter(isDefined);
}

function sanitizeTempFilename(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || randomUUID();
}

function inferFormatFromUrlOrHeaders(url: string, contentType: string | null, contentDisposition: string | null): DiscoverBookFormat {
  const dispositionFilename = contentDisposition?.match(/filename\*?=(?:UTF-8'')?\"?([^\";]+)/i)?.[1] ?? null;
  const filename = dispositionFilename ? decodeURIComponent(dispositionFilename) : null;
  const candidate = (filename ?? new URL(url).pathname).toLocaleLowerCase();

  if (candidate.endsWith('.epub')) {
    return 'epub';
  }
  if (candidate.endsWith('.txt')) {
    return 'txt';
  }
  if (candidate.endsWith('.html') || candidate.endsWith('.htm') || candidate.endsWith('.xhtml')) {
    return 'html';
  }

  return mapMimeTypeToFormat(contentType);
}

async function createImportableTempFile(
  response: Response,
  result: DiscoverBookResult
): Promise<{ tempPath: string; cleanupPath: string }> {
  const arrayBuffer = await response.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const format = inferFormatFromUrlOrHeaders(
    response.url,
    response.headers.get('content-type'),
    response.headers.get('content-disposition')
  );
  const tempBase = path.join(os.tmpdir(), `diplomaapp-discover-${randomUUID()}-${sanitizeTempFilename(result.title)}`);

  if (format === 'epub') {
    const tempPath = `${tempBase}.epub`;
    await fs.writeFile(tempPath, fileBuffer);
    return { tempPath, cleanupPath: tempPath };
  }

  if (format === 'txt') {
    const tempPath = `${tempBase}.txt`;
    await fs.writeFile(tempPath, fileBuffer);
    return { tempPath, cleanupPath: tempPath };
  }

  if (format === 'html') {
    const html = fileBuffer.toString('utf8');
    const txtPath = `${tempBase}.txt`;
    await fs.writeFile(txtPath, stripHtmlToText(html), 'utf8');
    return { tempPath: txtPath, cleanupPath: txtPath };
  }

  throw new Error('This download format is not supported for local import yet.');
}

export async function searchDiscoverBooks(payload: DiscoverSearchRequest): Promise<DiscoverSearchResult> {
  const query = payload.query?.trim() ?? '';
  const source = payload.source ?? 'all';

  if (!query) {
    return { ok: true, results: [] };
  }

  try {
    const results: DiscoverBookResult[] = [];

    if (source === 'all' || source === 'gutenberg') {
      results.push(...(await searchGutenberg(query)));
    }

    if (source === 'all' || source === 'standardebooks') {
      results.push(...(await searchStandardEbooks(query)));
    }

    return { ok: true, results };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to search open libraries.'
    };
  }
}

export async function downloadDiscoverBook(
  db: Database.Database,
  userId: string,
  userDataPath: string,
  payload: DiscoverDownloadRequest
): Promise<DiscoverDownloadResult> {
  const result = payload.result;
  const downloadUrl = result?.downloadUrl?.trim();
  const title = result?.title?.trim();

  if (!downloadUrl || !title) {
    return { ok: false, error: 'This book is missing a download URL.' };
  }

  if (hasDuplicateBook(db, userId, title, result.author ?? null)) {
    return { ok: false, error: 'This book is already in your library.' };
  }

  let cleanupPath: string | null = null;

  try {
    const response = await fetch(downloadUrl, {
      headers: {
        'user-agent': 'DiplomaApp/1.0 (Discover Books MVP)'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      return { ok: false, error: `Download failed with status ${response.status}.` };
    }

    const tempFile = await createImportableTempFile(response, result);
    cleanupPath = tempFile.cleanupPath;

    const importResult = await importBookFromPath(db, userId, userDataPath, tempFile.tempPath, {
      title,
      author: result.author
    });

    if (!importResult.ok) {
      return importResult;
    }

    return {
      ok: true,
      book: importResult.book as Book
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to download and import this book.'
    };
  } finally {
    if (cleanupPath) {
      await fs.rm(cleanupPath, { force: true }).catch(() => undefined);
    }
  }
}
