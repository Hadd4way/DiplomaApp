export type ReadingLength = "short" | "medium" | "long";

export interface LibraryBookContextEntry {
  title: string;
  author: string | null;
}

export interface RecommendLibraryContext {
  books: LibraryBookContextEntry[];
  recentlyOpenedBooks?: LibraryBookContextEntry[];
  commonAuthors?: string[];
}

export interface RecommendBooksRequestBody {
  genres: string[];
  moods: string[];
  length: ReadingLength;
  fiction: boolean;
  classic: boolean;
  freeText: string;
  languagePreference?: "ru" | "en" | "any";
  libraryContext?: RecommendLibraryContext;
}

export interface BookRecommendation {
  title: string;
  author: string;
  reason: string;
  confidence: number;
}

export type RecommendationSource = "openrouter" | "fallback";

export interface RecommendBooksResponse {
  ok: true;
  source: RecommendationSource;
  recommendations: BookRecommendation[];
  warning?: string;
}
