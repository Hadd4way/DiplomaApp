"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.standardEbooksProvider = void 0;
const STANDARD_EBOOKS_BASE_URL = 'https://standardebooks.org';
const STANDARD_EBOOKS_SEARCH_PATH = '/ebooks';
const STANDARD_EBOOKS_USER_AGENT = 'DiplomaApp/1.0 (Discover Books)';
function decodeHtmlEntities(value) {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&#160;|&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function stripTags(value) {
    return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' '));
}
function toAbsoluteUrl(value) {
    if (!value) {
        return null;
    }
    try {
        return new URL(value, STANDARD_EBOOKS_BASE_URL).toString();
    }
    catch {
        return null;
    }
}
function ensureDownloadSourceUrl(value) {
    if (!value) {
        return null;
    }
    try {
        const url = new URL(value);
        if (url.hostname === 'standardebooks.org' && /\.epub$/i.test(url.pathname) && !url.searchParams.has('source')) {
            url.searchParams.set('source', 'download');
        }
        return url.toString();
    }
    catch {
        return value;
    }
}
function createEpubFormat(url) {
    return {
        kind: 'epub',
        mimeType: 'application/epub+zip',
        url
    };
}
function parseSearchEntries(html) {
    const sectionMatch = html.match(/<ol class="ebooks-list list">([\s\S]*?)<\/ol>/i);
    if (!sectionMatch) {
        return [];
    }
    const blocks = Array.from(sectionMatch[1].matchAll(/<li\b(?=[^>]*typeof="schema:Book")[\s\S]*?<\/li>\s*(?=(?:<li\b(?=[^>]*typeof="schema:Book"))|$)/gi), (match) => match[0]);
    return blocks
        .map((block) => {
        if (/class="[^"]*\b(?:not-pd|in-progress)\b/i.test(block)) {
            return null;
        }
        const path = block.match(/\babout="([^"]+)"/i)?.[1]?.trim() ?? null;
        const title = stripTags(block.match(/<span[^>]*property="schema:name"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
        const author = stripTags(block.match(/<p class="author">([\s\S]*?)<\/p>/i)?.[1] ?? '') || null;
        const coverUrl = toAbsoluteUrl(block.match(/<img[^>]+src="([^"]+)"/i)?.[1] ??
            block.match(/<source[^>]+srcset="([^" ,]+)(?:\s+\d+x)?/i)?.[1] ??
            null);
        if (!path || !title) {
            return null;
        }
        return {
            path,
            title,
            author,
            coverUrl
        };
    })
        .filter((entry) => Boolean(entry));
}
function parseMetaContent(html, key) {
    return (html.match(new RegExp(`<meta[^>]+property="${key}"[^>]+content="([^"]*)"`, 'i'))?.[1] ??
        html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${key}"`, 'i'))?.[1] ??
        html.match(new RegExp(`<meta[^>]+name="${key}"[^>]+content="([^"]*)"`, 'i'))?.[1] ??
        html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+name="${key}"`, 'i'))?.[1] ??
        null);
}
function parseCompatibleEpubUrl(html) {
    const compatibleAnchorMatch = html.match(/<a[^>]+href="([^"]+\.epub[^"]*)"[^>]*>\s*(?:<[^>]+>\s*)*Compatible epub\b/i);
    if (compatibleAnchorMatch?.[1]) {
        return ensureDownloadSourceUrl(toAbsoluteUrl(compatibleAnchorMatch[1]));
    }
    const nearbyHeadingMatch = html.match(/Download for ereaders[\s\S]*?<a[^>]+href="([^"]+\.epub[^"]*)"[^>]*>[\s\S]*?Compatible epub/i);
    if (nearbyHeadingMatch?.[1]) {
        return ensureDownloadSourceUrl(toAbsoluteUrl(nearbyHeadingMatch[1]));
    }
    const genericEpubLinks = Array.from(html.matchAll(/href="([^"]+\.epub[^"]*)"/gi), (match) => match[1]).map((value) => value.trim());
    const compatibleCandidate = genericEpubLinks.find((value) => !/advanced|kepub/i.test(value) && !/thumbnail/i.test(value));
    return ensureDownloadSourceUrl(toAbsoluteUrl(compatibleCandidate ?? null));
}
function getDetailDescription(html) {
    const description = parseMetaContent(html, 'description') ?? parseMetaContent(html, 'og:description');
    return description ? decodeHtmlEntities(description) : null;
}
async function fetchDetail(entry) {
    const response = await fetch(toAbsoluteUrl(entry.path), {
        headers: {
            'user-agent': STANDARD_EBOOKS_USER_AGENT
        }
    });
    if (!response.ok) {
        return null;
    }
    const html = await response.text();
    const epubUrl = parseCompatibleEpubUrl(html);
    if (!epubUrl) {
        return null;
    }
    return {
        id: `standardebooks:${entry.path.replace(/^\/+/, '')}`,
        source: 'standardebooks',
        title: entry.title,
        author: entry.author,
        languages: ['en'],
        coverUrl: entry.coverUrl,
        description: getDetailDescription(html),
        downloadCount: null,
        formats: [createEpubFormat(epubUrl)]
    };
}
exports.standardEbooksProvider = {
    async search(query, options = {}) {
        const url = new URL(STANDARD_EBOOKS_SEARCH_PATH, STANDARD_EBOOKS_BASE_URL);
        url.searchParams.set('query', query);
        url.searchParams.set('view', 'list');
        url.searchParams.set('per-page', '24');
        if (typeof options.page === 'number' && Number.isFinite(options.page) && options.page > 1) {
            url.searchParams.set('page', String(Math.floor(options.page)));
        }
        const response = await fetch(url, {
            headers: {
                'user-agent': STANDARD_EBOOKS_USER_AGENT
            }
        });
        if (!response.ok) {
            throw new Error(`Standard Ebooks search failed with status ${response.status}.`);
        }
        const html = await response.text();
        const entries = parseSearchEntries(html);
        const results = await Promise.all(entries.map((entry) => fetchDetail(entry)));
        return results.filter((result) => Boolean(result));
    }
};
