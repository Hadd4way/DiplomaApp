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
const gutendexProvider_1 = require("./discover/providers/gutendexProvider");
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
function normalizeForDuplicate(value) {
    return (value ?? '')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function sanitizeTempFilename(value) {
    return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || (0, node_crypto_1.randomUUID)();
}
function getPreferredFormat(result) {
    return (result.formats.find((format) => format.kind === 'epub') ??
        result.formats.find((format) => format.kind === 'txt') ??
        result.formats.find((format) => format.kind === 'html') ??
        null);
}
function toImportedBookFormat(result) {
    const preferredFormat = getPreferredFormat(result);
    if (!preferredFormat) {
        return null;
    }
    if (preferredFormat.kind === 'epub') {
        return 'epub';
    }
    if (preferredFormat.kind === 'txt' || preferredFormat.kind === 'html') {
        return 'txt';
    }
    return null;
}
function hasDuplicateBook(db, userId, title, author, format) {
    const rows = db
        .prepare(`SELECT title, author, format
       FROM books
       WHERE user_id = ?`)
        .all(userId);
    const normalizedTitle = normalizeForDuplicate(title);
    const normalizedAuthor = normalizeForDuplicate(author);
    return rows.some((row) => {
        return (row.format === format &&
            normalizeForDuplicate(row.title) === normalizedTitle &&
            normalizeForDuplicate(row.author) === normalizedAuthor);
    });
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
    const normalizedContentType = (contentType ?? '').toLocaleLowerCase();
    if (normalizedContentType.includes('application/epub+zip')) {
        return 'epub';
    }
    if (normalizedContentType.includes('text/plain')) {
        return 'txt';
    }
    if (normalizedContentType.includes('text/html') || normalizedContentType.includes('application/xhtml+xml')) {
        return 'html';
    }
    return 'other';
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
    if (!query) {
        return { ok: true, results: [] };
    }
    try {
        const results = await gutendexProvider_1.gutendexProvider.search(query, {
            language: payload.language,
            page: payload.page
        });
        return { ok: true, results };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Failed to search Project Gutenberg.'
        };
    }
}
async function downloadDiscoverBook(db, userId, userDataPath, payload) {
    const result = payload.result;
    const title = result?.title?.trim();
    const preferredFormat = result ? getPreferredFormat(result) : null;
    const importedFormat = result ? toImportedBookFormat(result) : null;
    if (!title || !result || !preferredFormat?.url || !importedFormat) {
        return { ok: false, error: 'This book does not have a supported downloadable format.' };
    }
    const duplicateDetected = hasDuplicateBook(db, userId, title, result.author ?? null, importedFormat);
    let cleanupPath = null;
    try {
        const response = await fetch(preferredFormat.url, {
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
            book: importResult.book,
            duplicateWarning: duplicateDetected ? 'A similar local book already exists, so this may be a duplicate import.' : null
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
