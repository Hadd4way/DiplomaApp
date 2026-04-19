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
const ipc_1 = require("../shared/ipc");
const books_1 = require("./books");
const gutendexProvider_1 = require("./discover/providers/gutendexProvider");
const standardEbooksProvider_1 = require("./discover/providers/standardEbooksProvider");
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
function normalizeSearchValue(value) {
    return (value ?? '')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function getSourcePriority(source) {
    return source === 'standardebooks' ? 0 : 1;
}
function rankDiscoverResults(query, results) {
    const normalizedQuery = normalizeSearchValue(query);
    return [...results].sort((left, right) => {
        const leftExactTitle = normalizeSearchValue(left.title) === normalizedQuery;
        const rightExactTitle = normalizeSearchValue(right.title) === normalizedQuery;
        if (leftExactTitle !== rightExactTitle) {
            return leftExactTitle ? -1 : 1;
        }
        if (leftExactTitle && rightExactTitle && left.source !== right.source) {
            return getSourcePriority(left.source) - getSourcePriority(right.source);
        }
        if (left.source !== right.source) {
            return getSourcePriority(left.source) - getSourcePriority(right.source);
        }
        if (left.source === 'gutenberg' && right.source === 'gutenberg') {
            return (right.downloadCount ?? -1) - (left.downloadCount ?? -1);
        }
        return left.title.localeCompare(right.title);
    });
}
function emitDownloadProgress(target, event) {
    if (!target || target.isDestroyed()) {
        return;
    }
    target.send(ipc_1.IPC_CHANNELS.discoverDownloadProgress, event);
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
function extractHtmlDownloadRedirectUrl(html, baseUrl) {
    const metaRefreshUrl = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"'>]+)["']/i)?.[1] ??
        html.match(/<meta[^>]+content=["'][^"']*url=([^"'>]+)["'][^>]+http-equiv=["']refresh["']/i)?.[1] ??
        null;
    const contentUrl = html.match(/property=["']schema:contentUrl["'][^>]+href=["']([^"']+)["']/i)?.[1] ??
        html.match(/href=["']([^"']+)["'][^>]+property=["']schema:contentUrl["']/i)?.[1] ??
        null;
    const candidate = metaRefreshUrl ?? contentUrl;
    if (!candidate) {
        return null;
    }
    try {
        const resolved = new URL(candidate, baseUrl);
        if (/\.epub$/i.test(resolved.pathname) && !resolved.searchParams.has('source')) {
            resolved.searchParams.set('source', 'download');
        }
        return resolved.toString();
    }
    catch {
        return null;
    }
}
async function fetchDiscoverDownloadResponse(result, url, redirectDepth = 0) {
    if (redirectDepth > 2) {
        throw new Error('Too many intermediate download pages while fetching this book.');
    }
    const response = await fetch(url, {
        headers: {
            'user-agent': 'DiplomaApp/1.0 (Discover Books MVP)'
        },
        redirect: 'follow'
    });
    if (!response.ok) {
        return response;
    }
    const contentType = response.headers.get('content-type')?.toLocaleLowerCase() ?? '';
    const looksLikeHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
    if (!looksLikeHtml) {
        return response;
    }
    const html = await response.text();
    if (result.source !== 'standardebooks') {
        return new Response(html, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    }
    const redirectedUrl = extractHtmlDownloadRedirectUrl(html, response.url);
    if (!redirectedUrl || redirectedUrl === response.url) {
        return new Response(html, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    }
    return fetchDiscoverDownloadResponse(result, redirectedUrl, redirectDepth + 1);
}
async function createImportableTempFile(response, result, onProgress) {
    const totalBytesHeader = response.headers.get('content-length');
    const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : null;
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('The network response body is unavailable for this download.');
    }
    const chunks = [];
    let bytesReceived = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        if (!value) {
            continue;
        }
        const chunk = Buffer.from(value);
        chunks.push(chunk);
        bytesReceived += chunk.length;
        onProgress?.({
            resultId: result.id,
            state: 'downloading',
            bytesReceived,
            totalBytes,
            progressPercent: totalBytes && totalBytes > 0 ? Math.round((bytesReceived / totalBytes) * 100) : null,
            message: totalBytes ? 'Downloading book file...' : 'Downloading book file...'
        });
    }
    const fileBuffer = Buffer.concat(chunks);
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
        const options = {
            language: payload.language,
            page: payload.page,
            source: payload.source
        };
        if (payload.source === 'gutenberg') {
            const results = await gutendexProvider_1.gutendexProvider.search(query, options);
            return { ok: true, results: rankDiscoverResults(query, results) };
        }
        if (payload.source === 'standardebooks') {
            const results = await standardEbooksProvider_1.standardEbooksProvider.search(query, options);
            return { ok: true, results: rankDiscoverResults(query, results) };
        }
        const [gutenbergResults, standardEbooksResults] = await Promise.allSettled([
            gutendexProvider_1.gutendexProvider.search(query, options),
            standardEbooksProvider_1.standardEbooksProvider.search(query, options)
        ]);
        const successfulResults = [
            gutenbergResults.status === 'fulfilled' ? gutenbergResults.value : [],
            standardEbooksResults.status === 'fulfilled' ? standardEbooksResults.value : []
        ].flat();
        if (successfulResults.length > 0) {
            return {
                ok: true,
                results: rankDiscoverResults(query, successfulResults)
            };
        }
        const failureMessages = [gutenbergResults, standardEbooksResults]
            .filter((result) => result.status === 'rejected')
            .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)))
            .filter(Boolean);
        return {
            ok: false,
            error: failureMessages[0] ?? 'Failed to search discover providers.'
        };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Failed to search discover providers.'
        };
    }
}
async function downloadDiscoverBook(db, userId, userDataPath, payload, progressTarget) {
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
        emitDownloadProgress(progressTarget ?? null, {
            resultId: result.id,
            state: 'downloading',
            bytesReceived: 0,
            totalBytes: null,
            progressPercent: 0,
            message: 'Starting download...'
        });
        const response = await fetchDiscoverDownloadResponse(result, preferredFormat.url);
        if (!response.ok) {
            emitDownloadProgress(progressTarget ?? null, {
                resultId: result.id,
                state: 'failed',
                bytesReceived: null,
                totalBytes: null,
                progressPercent: null,
                message: `Download failed with status ${response.status}.`
            });
            return { ok: false, error: `Download failed with status ${response.status}.` };
        }
        const tempFile = await createImportableTempFile(response, result, (event) => emitDownloadProgress(progressTarget ?? null, event));
        cleanupPath = tempFile.cleanupPath;
        emitDownloadProgress(progressTarget ?? null, {
            resultId: result.id,
            state: 'importing',
            bytesReceived: null,
            totalBytes: null,
            progressPercent: 100,
            message: 'Importing into your local library...'
        });
        const importResult = await (0, books_1.importBookFromPath)(db, userId, userDataPath, tempFile.tempPath, {
            title,
            author: result.author
        });
        if (!importResult.ok) {
            emitDownloadProgress(progressTarget ?? null, {
                resultId: result.id,
                state: 'failed',
                bytesReceived: null,
                totalBytes: null,
                progressPercent: null,
                message: importResult.error
            });
            return importResult;
        }
        emitDownloadProgress(progressTarget ?? null, {
            resultId: result.id,
            state: 'completed',
            bytesReceived: null,
            totalBytes: null,
            progressPercent: 100,
            message: 'Downloaded successfully.'
        });
        return {
            ok: true,
            book: importResult.book,
            duplicateWarning: duplicateDetected ? 'A similar local book already exists, so this may be a duplicate import.' : null
        };
    }
    catch (error) {
        emitDownloadProgress(progressTarget ?? null, {
            resultId: result.id,
            state: 'failed',
            bytesReceived: null,
            totalBytes: null,
            progressPercent: null,
            message: error instanceof Error ? error.message : 'Failed to download and import this book.'
        });
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
