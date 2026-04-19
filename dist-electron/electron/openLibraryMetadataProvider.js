"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openLibraryMetadataProvider = void 0;
exports.findBestMatch = findBestMatch;
exports.getCover = getCover;
exports.getDescription = getDescription;
exports.getSubjects = getSubjects;
exports.getPublishYear = getPublishYear;
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';
const OPEN_LIBRARY_SEARCH_URL = `${OPEN_LIBRARY_BASE_URL}/search.json`;
const OPEN_LIBRARY_USER_AGENT = 'DiplomaApp/1.0 (Open Library Metadata)';
const workDetailsCache = new Map();
const editionDetailsCache = new Map();
function normalizeText(value) {
    return (value ?? '')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function toAbsoluteOpenLibraryUrl(pathname) {
    return new URL(pathname, OPEN_LIBRARY_BASE_URL).toString();
}
function extractOlid(value) {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    const match = trimmed.match(/(OL\d+[A-Z])/i);
    return match?.[1]?.toUpperCase() ?? null;
}
function extractWorkId(value) {
    const olid = extractOlid(value);
    if (olid?.endsWith('W')) {
        return olid;
    }
    return null;
}
function extractEditionId(value) {
    const olid = extractOlid(value);
    if (olid?.endsWith('M')) {
        return olid;
    }
    return null;
}
function parseDescription(value) {
    if (typeof value === 'string') {
        return value.trim() || null;
    }
    if (value && typeof value.value === 'string') {
        return value.value.trim() || null;
    }
    return null;
}
function parseYear(value) {
    if (!value) {
        return null;
    }
    const match = value.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    if (!match) {
        return null;
    }
    const year = Number(match[1]);
    return Number.isFinite(year) ? year : null;
}
function dedupeSubjects(subjects) {
    const seen = new Set();
    const items = [];
    for (const subject of subjects) {
        const value = subject?.trim();
        if (!value) {
            continue;
        }
        const key = normalizeText(value);
        if (!key || seen.has(key)) {
            continue;
        }
        seen.add(key);
        items.push(value);
    }
    return items;
}
function buildBookCoverUrl(key, value, size = 'L') {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    return `https://covers.openlibrary.org/b/${key}/${encodeURIComponent(String(value))}-${size}.jpg?default=false`;
}
function scoreMatch(doc, title, author) {
    const normalizedRequestedTitle = normalizeText(title);
    const normalizedRequestedAuthor = normalizeText(author);
    const normalizedDocTitle = normalizeText(doc.title);
    const normalizedDocSubtitle = normalizeText(doc.subtitle);
    const normalizedDocAuthors = (doc.author_name ?? []).map((item) => normalizeText(item));
    let score = 0;
    if (normalizedDocTitle === normalizedRequestedTitle) {
        score += 120;
    }
    else if (normalizedDocTitle.startsWith(normalizedRequestedTitle) ||
        normalizedRequestedTitle.startsWith(normalizedDocTitle)) {
        score += 70;
    }
    else if (normalizedDocTitle.includes(normalizedRequestedTitle) ||
        normalizedRequestedTitle.includes(normalizedDocTitle)) {
        score += 45;
    }
    if (normalizedDocSubtitle) {
        score += 5;
    }
    if (normalizedRequestedAuthor) {
        if (normalizedDocAuthors.some((item) => item === normalizedRequestedAuthor)) {
            score += 90;
        }
        else if (normalizedDocAuthors.some((item) => item.includes(normalizedRequestedAuthor) || normalizedRequestedAuthor.includes(item))) {
            score += 45;
        }
    }
    if (typeof doc.first_publish_year === 'number') {
        score += 2;
    }
    if (typeof doc.cover_i === 'number' || doc.cover_edition_key || (doc.isbn ?? []).length > 0) {
        score += 3;
    }
    return score;
}
async function fetchOpenLibraryJson(url) {
    const response = await fetch(url, {
        headers: {
            'user-agent': OPEN_LIBRARY_USER_AGENT
        }
    });
    if (!response.ok) {
        return null;
    }
    return (await response.json());
}
function fetchWorkDetails(workId) {
    const normalizedWorkId = extractWorkId(workId);
    if (!normalizedWorkId) {
        return Promise.resolve(null);
    }
    const cacheKey = normalizedWorkId;
    const existing = workDetailsCache.get(cacheKey);
    if (existing) {
        return existing;
    }
    const request = fetchOpenLibraryJson(toAbsoluteOpenLibraryUrl(`/works/${normalizedWorkId}.json`)).catch(() => null);
    workDetailsCache.set(cacheKey, request);
    return request;
}
function fetchEditionDetails(editionId) {
    const normalizedEditionId = extractEditionId(editionId);
    if (!normalizedEditionId) {
        return Promise.resolve(null);
    }
    const cacheKey = normalizedEditionId;
    const existing = editionDetailsCache.get(cacheKey);
    if (existing) {
        return existing;
    }
    const request = fetchOpenLibraryJson(toAbsoluteOpenLibraryUrl(`/books/${normalizedEditionId}.json`)).catch(() => null);
    editionDetailsCache.set(cacheKey, request);
    return request;
}
function toMatchFromDoc(doc) {
    const workId = extractWorkId(doc.key);
    const editionId = extractEditionId(doc.cover_edition_key) ?? extractEditionId(doc.edition_key?.[0]);
    const isbn = doc.isbn?.find((item) => item?.trim())?.trim() ?? null;
    const coverId = typeof doc.cover_i === 'number' ? doc.cover_i : null;
    const coverUrl = buildBookCoverUrl('olid', editionId) ??
        buildBookCoverUrl('isbn', isbn) ??
        buildBookCoverUrl('id', coverId);
    return {
        title: doc.title?.trim() || 'Untitled',
        subtitle: doc.subtitle?.trim() || null,
        author: doc.author_name?.find((item) => item?.trim())?.trim() ?? null,
        workId,
        editionId,
        isbn,
        coverId,
        coverUrl,
        description: null,
        subjects: dedupeSubjects(doc.subject ?? []),
        publishYear: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null
    };
}
async function findBestMatch(title, author) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
        return null;
    }
    const url = new URL(OPEN_LIBRARY_SEARCH_URL);
    url.searchParams.set('title', trimmedTitle);
    url.searchParams.set('fields', ['key', 'title', 'subtitle', 'author_name', 'cover_i', 'cover_edition_key', 'edition_key', 'isbn', 'first_publish_year', 'subject'].join(','));
    url.searchParams.set('limit', '10');
    const trimmedAuthor = author?.trim();
    if (trimmedAuthor) {
        url.searchParams.set('author', trimmedAuthor);
    }
    const payload = await fetchOpenLibraryJson(url.toString()).catch(() => null);
    const docs = payload?.docs ?? [];
    if (docs.length === 0) {
        return null;
    }
    const bestDoc = [...docs]
        .sort((left, right) => scoreMatch(right, trimmedTitle, trimmedAuthor) - scoreMatch(left, trimmedTitle, trimmedAuthor))[0];
    return bestDoc ? toMatchFromDoc(bestDoc) : null;
}
function getCover(lookup) {
    return (buildBookCoverUrl('olid', extractEditionId(lookup.editionId)) ??
        buildBookCoverUrl('isbn', lookup.isbn?.trim() || null) ??
        buildBookCoverUrl('id', lookup.coverId ?? null));
}
async function getDescription(lookup) {
    const [workDetails, editionDetails] = await Promise.all([
        fetchWorkDetails(lookup.workId),
        fetchEditionDetails(lookup.editionId)
    ]);
    return parseDescription(workDetails?.description) ?? parseDescription(editionDetails?.description) ?? null;
}
async function getSubjects(lookup) {
    const [workDetails, editionDetails] = await Promise.all([
        fetchWorkDetails(lookup.workId),
        fetchEditionDetails(lookup.editionId)
    ]);
    return dedupeSubjects([...(workDetails?.subjects ?? []), ...(editionDetails?.subjects ?? [])]);
}
async function getPublishYear(lookup) {
    const [workDetails, editionDetails] = await Promise.all([
        fetchWorkDetails(lookup.workId),
        fetchEditionDetails(lookup.editionId)
    ]);
    return parseYear(workDetails?.first_publish_date) ?? parseYear(editionDetails?.publish_date) ?? null;
}
exports.openLibraryMetadataProvider = {
    findBestMatch,
    getCover,
    getDescription,
    getSubjects,
    getPublishYear
};
