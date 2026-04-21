export type ReadingLength = "short" | "medium" | "long";

export interface RecommendBooksRequestBody {
  genres: string[];
  moods: string[];
  length: ReadingLength;
  fiction: boolean;
  classic: boolean;
  freeText: string;
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
