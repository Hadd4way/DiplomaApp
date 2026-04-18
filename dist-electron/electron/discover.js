"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchDiscoverBooks = searchDiscoverBooks;
exports.downloadDiscoverBook = downloadDiscoverBook;
const node_crypto_1 = require("node:crypto");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const books_1 = require("./books");
function isDefined(value) {
    return value !== null && value !== undefined;
}
function decodeHtmlEntities(value) {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}
function stripHtmlToText(value) {
    return decodeHtmlEntities(value
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\r/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim());
}
function toAbsoluteUrl(url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    return new URL(url, 'https://standardebooks.org').toString();
}
function normalizeForDuplicate(value) {
    return (value ?? '')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function hasDuplicateBook(db, userId, title, author) {
    const rows = db
        .prepare(`SELECT title, author
       FROM books
       WHERE user_id = ?`)
        .all(userId);
    const normalizedTitle = normalizeForDuplicate(title);
    const normalizedAuthor = normalizeForDuplicate(author);
    return rows.some((row) => {
        const rowTitle = normalizeForDuplicate(row.title);
        const rowAuthor = normalizeForDuplicate(row.author);
        return rowTitle === normalizedTitle && rowAuthor === normalizedAuthor;
    });
}
function mapMimeTypeToFormat(mimeType) {
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
function pickGutendexDownload(formats) {
    if (!formats) {
        return null;
    }
    const preferenceOrder = [
        'application/epub+zip',
        'text/plain',
        'text/html'
    ];
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
async function searchGutenberg(query) {
    const response = await fetch(`https://gutendex.com/books?search=${encodeURIComponent(query)}`);
    if (!response.ok) {
        throw new Error(`Gutendex search failed with status ${response.status}.`);
    }
    const payload = (await response.json());
    const books = payload.results ?? [];
    return books
        .map((book) => {
        const bestDownload = pickGutendexDownload(book.formats);
        if (!bestDownload?.downloadUrl) {
            return null;
        }
        const authors = (book.authors ?? [])
            .map((author) => author.name?.trim() || null)
            .filter((author) => Boolean(author));
        const languages = (book.languages ?? []).filter(Boolean);
        return {
            id: `gutenberg:${book.id}`,
            source: 'gutenberg',
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
function extractXmlTagValue(source, tagName) {
    const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = source.match(pattern);
    return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}
function extractXmlLinks(source) {
    return [...source.matchAll(/<link\b([^>]+?)\/>/gi)].map((match) => {
        const attributeBlock = match[1] ?? '';
        const getAttribute = (name) => attributeBlock.match(new RegExp(`${name}="([^"]*)"`, 'i'))?.[1] ?? null;
        return {
            href: getAttribute('href'),
            rel: getAttribute('rel'),
            type: getAttribute('type'),
            title: getAttribute('title')
        };
    });
}
async function searchStandardEbooks(query) {
    const response = await fetch(`https://standardebooks.org/feeds/opds/all?query=${encodeURIComponent(query)}&per-page=24&page=1`);
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
        const epubLink = links.find((link) => link.type === 'application/epub+zip' && /recommended compatible epub/i.test(link.title ?? '')) ??
            links.find((link) => link.type === 'application/epub+zip') ??
            null;
        const htmlLink = links.find((link) => link.type === 'application/xhtml+xml') ?? null;
        const preferredLink = epubLink ?? htmlLink;
        if (!title || !preferredLink?.href) {
            return null;
        }
        return {
            id: `standardebooks:${extractXmlTagValue(entry, 'id') ?? title}`,
            source: 'standardebooks',
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
function sanitizeTempFilename(value) {
    return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || (0, node_crypto_1.randomUUID)();
}
function inferFormatFromUrlOrHeaders(url, contentType, contentDisposition) {
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
async function createImportableTempFile(response, result) {
    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const format = inferFormatFromUrlOrHeaders(response.url, response.headers.get('content-type'), response.headers.get('content-disposition'));
    const tempBase = node_path_1.default.join(node_os_1.default.tmpdir(), `diplomaapp-discover-${(0, node_crypto_1.randomUUID)()}-${sanitizeTempFilename(result.title)}`);
    if (format === 'epub') {
        const tempPath = `${tempBase}.epub`;
        await promises_1.default.writeFile(tempPath, fileBuffer);
        return { tempPath, cleanupPath: tempPath };
    }
    if (format === 'txt') {
        const tempPath = `${tempBase}.txt`;
        await promises_1.default.writeFile(tempPath, fileBuffer);
        return { tempPath, cleanupPath: tempPath };
    }
    if (format === 'html') {
        const html = fileBuffer.toString('utf8');
        const txtPath = `${tempBase}.txt`;
        await promises_1.default.writeFile(txtPath, stripHtmlToText(html), 'utf8');
        return { tempPath: txtPath, cleanupPath: txtPath };
    }
    throw new Error('This download format is not supported for local import yet.');
}
async function searchDiscoverBooks(payload) {
    const query = payload.query?.trim() ?? '';
    const source = payload.source ?? 'all';
    if (!query) {
        return { ok: true, results: [] };
    }
    try {
        const results = [];
        if (source === 'all' || source === 'gutenberg') {
            results.push(...(await searchGutenberg(query)));
        }
        if (source === 'all' || source === 'standardebooks') {
            results.push(...(await searchStandardEbooks(query)));
        }
        return { ok: true, results };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Failed to search open libraries.'
        };
    }
}
async function downloadDiscoverBook(db, userId, userDataPath, payload) {
    const result = payload.result;
    const downloadUrl = result?.downloadUrl?.trim();
    const title = result?.title?.trim();
    if (!downloadUrl || !title) {
        return { ok: false, error: 'This book is missing a download URL.' };
    }
    if (hasDuplicateBook(db, userId, title, result.author ?? null)) {
        return { ok: false, error: 'This book is already in your library.' };
    }
    let cleanupPath = null;
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
        const importResult = await (0, books_1.importBookFromPath)(db, userId, userDataPath, tempFile.tempPath, {
            title,
            author: result.author
        });
        if (!importResult.ok) {
            return importResult;
        }
        return {
            ok: true,
            book: importResult.book
        };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Failed to download and import this book.'
        };
    }
    finally {
        if (cleanupPath) {
            await promises_1.default.rm(cleanupPath, { force: true }).catch(() => undefined);
        }
    }
}
