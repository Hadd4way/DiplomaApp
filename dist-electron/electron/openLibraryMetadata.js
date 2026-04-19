"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hydrateBooksWithCachedMetadata = hydrateBooksWithCachedMetadata;
exports.enrichBooksInBackground = enrichBooksInBackground;
exports.enrichBookInBackground = enrichBookInBackground;
exports.enrichDiscoverResultsWithOpenLibrary = enrichDiscoverResultsWithOpenLibrary;
const openLibraryMetadataProvider_1 = require("./openLibraryMetadataProvider");
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const inFlightEnrichment = new Map();
function normalizeMetadataKey(title, author) {
    const normalize = (value) => (value ?? '')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return `${normalize(title)}::${normalize(author)}`;
}
function parseSubjects(value) {
    if (!value) {
        return [];
    }
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    }
    catch {
        return [];
    }
}
function rowToCachedMetadata(row) {
    return {
        title: row.title,
        subtitle: row.subtitle,
        author: row.author,
        coverUrl: row.cover_url,
        description: row.description,
        subjects: parseSubjects(row.subjects_json),
        publishYear: row.publish_year,
        workId: row.work_id,
        editionId: row.edition_id,
        isbn: row.isbn,
        updatedAt: row.updated_at
    };
}
function readCachedMetadata(db, title, author) {
    const row = db
        .prepare(`SELECT cache_key, title, subtitle, author, cover_url, description, subjects_json, publish_year, work_id, edition_id, isbn, updated_at
       FROM open_library_metadata_cache
       WHERE cache_key = ?
       LIMIT 1`)
        .get(normalizeMetadataKey(title, author));
    return row ? rowToCachedMetadata(row) : null;
}
function isCacheFresh(metadata) {
    return Boolean(metadata && Date.now() - metadata.updatedAt < CACHE_TTL_MS);
}
function writeCachedMetadata(db, title, author, metadata) {
    db.prepare(`INSERT INTO open_library_metadata_cache (
      cache_key,
      title,
      subtitle,
      author,
      cover_url,
      description,
      subjects_json,
      publish_year,
      work_id,
      edition_id,
      isbn,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      author = excluded.author,
      cover_url = excluded.cover_url,
      description = excluded.description,
      subjects_json = excluded.subjects_json,
      publish_year = excluded.publish_year,
      work_id = excluded.work_id,
      edition_id = excluded.edition_id,
      isbn = excluded.isbn,
      updated_at = excluded.updated_at`).run(normalizeMetadataKey(title, author), metadata.title, metadata.subtitle, metadata.author, metadata.coverUrl, metadata.description, JSON.stringify(metadata.subjects), metadata.publishYear, metadata.workId, metadata.editionId, metadata.isbn, metadata.updatedAt);
}
function mergeBookWithMetadata(book, metadata) {
    if (!metadata) {
        return book;
    }
    return {
        ...book,
        subtitle: metadata.subtitle,
        author: metadata.author ?? book.author ?? null,
        coverUrl: metadata.coverUrl,
        description: metadata.description,
        subjects: metadata.subjects,
        publishYear: metadata.publishYear
    };
}
function mergeDiscoverResultWithMetadata(result, metadata) {
    if (!metadata) {
        return result;
    }
    return {
        ...result,
        subtitle: metadata.subtitle ?? result.subtitle ?? null,
        author: metadata.author ?? result.author,
        coverUrl: metadata.coverUrl ?? result.coverUrl,
        description: metadata.description ?? result.description ?? null,
        subjects: metadata.subjects.length > 0 ? metadata.subjects : result.subjects ?? [],
        publishYear: metadata.publishYear ?? result.publishYear ?? null
    };
}
async function fetchAndStoreMetadata(db, title, author) {
    const match = await (0, openLibraryMetadataProvider_1.findBestMatch)(title, author);
    if (!match) {
        const emptyMetadata = {
            title,
            subtitle: null,
            author: author ?? null,
            coverUrl: null,
            description: null,
            subjects: [],
            publishYear: null,
            workId: null,
            editionId: null,
            isbn: null,
            updatedAt: Date.now()
        };
        writeCachedMetadata(db, title, author ?? null, emptyMetadata);
        return emptyMetadata;
    }
    const lookup = {
        workId: match.workId,
        editionId: match.editionId,
        isbn: match.isbn,
        coverId: match.coverId
    };
    const [description, subjects, publishYear] = await Promise.all([
        (0, openLibraryMetadataProvider_1.getDescription)(lookup).catch(() => null),
        (0, openLibraryMetadataProvider_1.getSubjects)(lookup).catch(() => []),
        (0, openLibraryMetadataProvider_1.getPublishYear)(lookup).catch(() => null)
    ]);
    const metadata = {
        title: match.title,
        subtitle: match.subtitle,
        author: match.author ?? author ?? null,
        coverUrl: (0, openLibraryMetadataProvider_1.getCover)(lookup) ?? match.coverUrl,
        description: description ?? match.description,
        subjects: subjects.length > 0 ? subjects : match.subjects,
        publishYear: publishYear ?? match.publishYear,
        workId: match.workId,
        editionId: match.editionId,
        isbn: match.isbn,
        updatedAt: Date.now()
    };
    writeCachedMetadata(db, title, author ?? null, metadata);
    return metadata;
}
async function ensureMetadata(db, title, author) {
    const cached = readCachedMetadata(db, title, author);
    if (isCacheFresh(cached)) {
        return cached;
    }
    return fetchAndStoreMetadata(db, title, author);
}
function queueMetadataEnrichment(db, title, author) {
    const cacheKey = normalizeMetadataKey(title, author);
    const inFlight = inFlightEnrichment.get(cacheKey);
    if (inFlight) {
        return inFlight;
    }
    const task = ensureMetadata(db, title, author)
        .catch(() => null)
        .then(() => undefined)
        .finally(() => {
        inFlightEnrichment.delete(cacheKey);
    });
    inFlightEnrichment.set(cacheKey, task);
    return task;
}
function hydrateBooksWithCachedMetadata(db, books) {
    return books.map((book) => mergeBookWithMetadata(book, readCachedMetadata(db, book.title, book.author ?? null)));
}
function enrichBooksInBackground(db, books) {
    for (const book of books) {
        const cached = readCachedMetadata(db, book.title, book.author ?? null);
        if (!isCacheFresh(cached)) {
            void queueMetadataEnrichment(db, book.title, book.author ?? null);
        }
    }
}
function enrichBookInBackground(db, book) {
    void queueMetadataEnrichment(db, book.title, book.author ?? null);
}
async function enrichDiscoverResultsWithOpenLibrary(db, results) {
    return Promise.all(results.map(async (result) => {
        const cached = readCachedMetadata(db, result.title, result.author ?? null);
        if (isCacheFresh(cached)) {
            return mergeDiscoverResultWithMetadata(result, cached);
        }
        const metadata = await ensureMetadata(db, result.title, result.author ?? null).catch(() => null);
        return mergeDiscoverResultWithMetadata(result, metadata);
    }));
}
