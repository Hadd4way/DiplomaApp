import type Database from 'better-sqlite3';
import type {
  Book,
  DiscoverBookResult,
  RecommendationEntry,
  RecommendationProfileSummary,
  RecommendationsForBookRequest,
  RecommendationsForBookResult,
  RecommendationsHomeResult
} from '../shared/ipc';
import { listBooks } from './books';

type ReadingSignalRow = {
  book_id: string;
  open_count: number;
  last_opened_at: number | null;
};

type RankedCandidate = {
  book: Book;
  score: number;
  reasons: Set<RecommendationEntry['reasons'][number]>;
  matchedAuthors: Set<string>;
  matchedSubjects: Set<string>;
};

function normalizeValue(value: string | null | undefined) {
  return (value ?? '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string | null | undefined) {
  return normalizeValue(value)
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function getSubjectTokens(book: Book) {
  return Array.from(
    new Set(
      (book.subjects ?? [])
        .flatMap((subject) => tokenize(subject))
        .filter(Boolean)
    )
  );
}

function getAuthorKey(book: Pick<Book, 'author'>) {
  return normalizeValue(book.author);
}

function getReadingSignals(db: Database.Database, userId: string) {
  return db
    .prepare(
      `SELECT
         b.id AS book_id,
         COALESCE(rs.open_count, 0) AS open_count,
         rs.last_opened_at
       FROM books AS b
       LEFT JOIN reading_stats AS rs ON rs.book_id = b.id
       WHERE b.user_id = ?`
    )
    .all(userId) as ReadingSignalRow[];
}

function buildProfile(books: Book[], signals: ReadingSignalRow[]) {
  const recentSignals = [...signals]
    .filter((signal) => signal.last_opened_at !== null)
    .sort((left, right) => (right.last_opened_at ?? 0) - (left.last_opened_at ?? 0))
    .slice(0, 5);

  const signalByBookId = new Map(signals.map((signal) => [signal.book_id, signal]));
  const authorWeights = new Map<string, number>();
  const subjectWeights = new Map<string, number>();

  for (const book of books) {
    const signal = signalByBookId.get(book.id);
    const weight = 1 + (signal?.open_count ?? 0) * 2 + (signal?.last_opened_at ? 3 : 0);
    const authorKey = getAuthorKey(book);
    if (authorKey) {
      authorWeights.set(authorKey, (authorWeights.get(authorKey) ?? 0) + weight);
    }

    for (const subject of getSubjectTokens(book)) {
      subjectWeights.set(subject, (subjectWeights.get(subject) ?? 0) + weight);
    }
  }

  return {
    recentBookIds: recentSignals.map((signal) => signal.book_id),
    authorWeights,
    subjectWeights,
    signalByBookId
  };
}

function toSummary(books: Book[], profile: ReturnType<typeof buildProfile>): RecommendationProfileSummary {
  const bookById = new Map(books.map((book) => [book.id, book]));

  const topAuthors = [...profile.authorWeights.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([author]) => {
      const matchingBook = books.find((book) => getAuthorKey(book) === author);
      return matchingBook?.author ?? author;
    })
    .filter(Boolean) as string[];

  const topSubjects = [...profile.subjectWeights.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([subject]) => subject)
    .filter(Boolean);

  return {
    topAuthors,
    topSubjects,
    recentBookIds: profile.recentBookIds.filter((bookId) => bookById.has(bookId))
  };
}

function finalizeCandidate(candidate: RankedCandidate): RecommendationEntry {
  return {
    book: candidate.book,
    score: candidate.score,
    reasons: [...candidate.reasons],
    matchedAuthors: [...candidate.matchedAuthors],
    matchedSubjects: [...candidate.matchedSubjects]
  };
}

function getTitleOverlap(left: Book, right: Book) {
  const leftTokens = new Set(tokenize(left.title));
  const rightTokens = new Set(tokenize(right.title));
  return [...leftTokens].filter((token) => rightTokens.has(token));
}

function rankHomeRecommendations(books: Book[], profile: ReturnType<typeof buildProfile>) {
  const recentBookIds = new Set(profile.recentBookIds.slice(0, 3));

  return books
    .filter((book) => !recentBookIds.has(book.id))
    .map((book) => {
      const candidate: RankedCandidate = {
        book,
        score: 0,
        reasons: new Set(),
        matchedAuthors: new Set(),
        matchedSubjects: new Set()
      };

      const authorKey = getAuthorKey(book);
      if (authorKey) {
        const authorWeight = profile.authorWeights.get(authorKey) ?? 0;
        if (authorWeight > 0) {
          candidate.score += authorWeight * 4;
          candidate.reasons.add('matching-author');
          candidate.matchedAuthors.add(book.author ?? authorKey);
        }
      }

      for (const subject of getSubjectTokens(book)) {
        const subjectWeight = profile.subjectWeights.get(subject) ?? 0;
        if (subjectWeight > 0) {
          candidate.score += subjectWeight * 1.8;
          candidate.reasons.add('matching-genre');
          candidate.matchedSubjects.add(subject);
        }
      }

      const signal = profile.signalByBookId.get(book.id);
      if ((signal?.open_count ?? 0) > 0) {
        candidate.score += Math.min((signal?.open_count ?? 0) * 2, 8);
        candidate.reasons.add('continue-reading');
      } else {
        candidate.score += 6;
        candidate.reasons.add('rediscover');
      }

      if (profile.recentBookIds.length > 0) {
        candidate.score += 4;
        candidate.reasons.add('recently-opened-signal');
      }

      candidate.score += Math.max(0, 5 - Math.floor((Date.now() - book.createdAt) / (1000 * 60 * 60 * 24 * 30)));

      return candidate;
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.book.createdAt - left.book.createdAt;
    })
    .slice(0, 6)
    .map(finalizeCandidate);
}

function rankSimilarBooks(books: Book[], targetBook: Book, profile: ReturnType<typeof buildProfile>) {
  const targetAuthor = getAuthorKey(targetBook);
  const targetSubjects = new Set(getSubjectTokens(targetBook));
  const recentBookIds = new Set(profile.recentBookIds);

  return books
    .filter((book) => book.id !== targetBook.id)
    .map((book) => {
      const candidate: RankedCandidate = {
        book,
        score: 0,
        reasons: new Set(),
        matchedAuthors: new Set(),
        matchedSubjects: new Set()
      };

      const authorKey = getAuthorKey(book);
      if (targetAuthor && authorKey && targetAuthor === authorKey) {
        candidate.score += 50;
        candidate.reasons.add('matching-author');
        candidate.reasons.add('author-collection');
        candidate.matchedAuthors.add(book.author ?? authorKey);
      }

      for (const subject of getSubjectTokens(book)) {
        if (targetSubjects.has(subject)) {
          candidate.score += 14;
          candidate.reasons.add('matching-genre');
          candidate.matchedSubjects.add(subject);
        }
      }

      const overlappingTokens = getTitleOverlap(book, targetBook);
      if (overlappingTokens.length > 0) {
        candidate.score += overlappingTokens.length * 4;
        candidate.reasons.add('similar-title');
      }

      if (recentBookIds.has(book.id)) {
        candidate.score += 3;
        candidate.reasons.add('recently-opened-signal');
      }

      return candidate;
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.book.title.localeCompare(right.book.title);
    })
    .slice(0, 6)
    .map(finalizeCandidate);
}

function rankMoreByAuthor(books: Book[], targetBook: Book, profile: ReturnType<typeof buildProfile>) {
  const targetAuthor = getAuthorKey(targetBook);
  if (!targetAuthor) {
    return [];
  }

  return books
    .filter((book) => book.id !== targetBook.id && getAuthorKey(book) === targetAuthor)
    .map((book) => {
      const signal = profile.signalByBookId.get(book.id);
      return finalizeCandidate({
        book,
        score: 100 + (signal?.open_count ?? 0) * 3 + (signal?.last_opened_at ? 5 : 0),
        reasons: new Set(['author-collection', 'matching-author']),
        matchedAuthors: new Set([book.author ?? targetAuthor]),
        matchedSubjects: new Set()
      });
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.book.title.localeCompare(right.book.title);
    })
    .slice(0, 6);
}

export function getHomeRecommendations(db: Database.Database, userId: string): RecommendationsHomeResult {
  const booksResult = listBooks(db, userId);
  if (!booksResult.ok) {
    return booksResult;
  }

  const signals = getReadingSignals(db, userId);
  const profile = buildProfile(booksResult.books, signals);

  return {
    ok: true,
    recommendations: rankHomeRecommendations(booksResult.books, profile),
    profile: toSummary(booksResult.books, profile)
  };
}

export function getRecommendationsForBook(
  db: Database.Database,
  userId: string,
  payload: RecommendationsForBookRequest
): RecommendationsForBookResult {
  const bookId = payload.bookId?.trim();
  if (!bookId) {
    return { ok: false, error: 'Book not found.' };
  }

  const booksResult = listBooks(db, userId);
  if (!booksResult.ok) {
    return booksResult;
  }

  const targetBook = booksResult.books.find((book) => book.id === bookId);
  if (!targetBook) {
    return { ok: false, error: 'Book not found.' };
  }

  const signals = getReadingSignals(db, userId);
  const profile = buildProfile(booksResult.books, signals);

  return {
    ok: true,
    bookId,
    similarBooks: rankSimilarBooks(booksResult.books, targetBook, profile),
    moreByAuthor: rankMoreByAuthor(booksResult.books, targetBook, profile)
  };
}

function scoreDiscoverResultAgainstQuery(query: string, result: DiscoverBookResult) {
  const normalizedQuery = normalizeValue(query);
  const queryTokens = new Set(tokenize(query));
  const normalizedTitle = normalizeValue(result.title);
  const normalizedAuthor = normalizeValue(result.author);
  let score = 0;

  if (normalizedTitle === normalizedQuery) {
    score += 120;
  } else if (normalizedTitle.startsWith(normalizedQuery) && normalizedQuery) {
    score += 55;
  }

  if (normalizedAuthor === normalizedQuery && normalizedQuery) {
    score += 60;
  }

  for (const token of queryTokens) {
    if (normalizedTitle.includes(token)) {
      score += 18;
    }
    if (normalizedAuthor.includes(token)) {
      score += 14;
    }
    if ((result.subjects ?? []).some((subject) => normalizeValue(subject).includes(token))) {
      score += 9;
    }
  }

  return score;
}

function getSourcePriorityBoost(source: DiscoverBookResult['source']) {
  return source === 'standardebooks' ? 8 : 4;
}

export function rankDiscoverResultsForUser(
  db: Database.Database,
  userId: string,
  query: string,
  results: DiscoverBookResult[]
) {
  const booksResult = listBooks(db, userId);
  const books = booksResult.ok ? booksResult.books : [];
  const profile = buildProfile(books, getReadingSignals(db, userId));

  return [...results].sort((left, right) => {
    const scoreLeft = scoreDiscoverResultAgainstQuery(query, left) + scoreDiscoverResultForProfile(left, profile);
    const scoreRight = scoreDiscoverResultAgainstQuery(query, right) + scoreDiscoverResultForProfile(right, profile);

    if (scoreRight !== scoreLeft) {
      return scoreRight - scoreLeft;
    }

    if (left.source !== right.source) {
      return getSourcePriorityBoost(right.source) - getSourcePriorityBoost(left.source);
    }

    return (right.downloadCount ?? 0) - (left.downloadCount ?? 0);
  });
}

function scoreDiscoverResultForProfile(result: DiscoverBookResult, profile: ReturnType<typeof buildProfile>) {
  let score = getSourcePriorityBoost(result.source);
  const authorKey = normalizeValue(result.author);
  if (authorKey) {
    score += (profile.authorWeights.get(authorKey) ?? 0) * 3;
  }

  for (const subject of (result.subjects ?? []).flatMap((entry) => tokenize(entry))) {
    score += (profile.subjectWeights.get(subject) ?? 0) * 1.2;
  }

  if (typeof result.downloadCount === 'number' && result.downloadCount > 0) {
    score += Math.min(18, Math.log10(result.downloadCount + 1) * 6);
  }

  if (result.description || (result.subjects ?? []).length > 0 || result.publishYear) {
    score += 6;
  }

  return score;
}
