import { AI_BACKEND_DEFAULT_URL, REQUEST_TIMEOUT_MS } from '@/lib/constants';
import { assertOnline } from '@/lib/network';
import { SimpleCache } from '@/lib/simple-cache';

export type RecommendationLength = 'short' | 'medium' | 'long';
export type RecommendationLanguagePreference = 'ru' | 'en' | 'any';

export type RecommendationLibraryBook = {
  title: string;
  author: string | null;
};

export type RecommendationLibraryContext = {
  books: RecommendationLibraryBook[];
  recentlyOpenedBooks?: RecommendationLibraryBook[];
  commonAuthors?: string[];
};

export type RecommendationRequestPayload = {
  genres: string[];
  moods: string[];
  length: RecommendationLength;
  fiction: boolean;
  classic: boolean;
  freeText: string;
  languagePreference?: RecommendationLanguagePreference;
  responseLanguage?: 'ru' | 'en';
  libraryContext?: RecommendationLibraryContext;
};

export type Recommendation = {
  title: string;
  author: string;
  reason: string;
  confidence?: number;
};

export type RecommendationResponse = {
  ok: true;
  source?: 'openrouter' | 'fallback' | string;
  warning?: string;
  summary: string;
  recommendations: Recommendation[];
};

type RecommendationApiResponse = {
  ok: true;
  source?: 'openrouter' | 'fallback' | string;
  warning?: string;
  advisorComment: string;
  recommendations: Recommendation[];
};

const recommendationResponseCache = new SimpleCache<string, RecommendationResponse>(5 * 60 * 1000, 20);

export const AI_BACKEND_URL = (import.meta.env.VITE_AI_BACKEND_URL?.trim() || AI_BACKEND_DEFAULT_URL).replace(/\/+$/, '');

function getCacheKey(payload: RecommendationRequestPayload): string {
  return JSON.stringify(payload);
}

export async function recommendBooks(payload: RecommendationRequestPayload): Promise<RecommendationResponse> {
  assertOnline();

  const cacheKey = getCacheKey(payload);
  const cached = recommendationResponseCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS.recommendations);

  try {
    const response = await fetch(`${AI_BACKEND_URL}/api/recommend-books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const data = (await response.json().catch(() => null)) as RecommendationApiResponse | { error?: string } | null;

    if (!response.ok) {
      throw new Error((data && 'error' in data && data.error) || `Request failed with status ${response.status}`);
    }

    if (
      !data ||
      !('ok' in data) ||
      data.ok !== true ||
      typeof data.advisorComment !== 'string' ||
      !Array.isArray(data.recommendations)
    ) {
      throw new Error('The recommendation service returned an unexpected response.');
    }

    return recommendationResponseCache.set(cacheKey, {
      ok: true,
      source: data.source,
      warning: data.warning,
      summary: data.advisorComment,
      recommendations: data.recommendations
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The recommendation request timed out.');
    }

    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    window.clearTimeout(timeoutId);
  }
}
