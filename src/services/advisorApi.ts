export type AdvisorLength = 'short' | 'medium' | 'long';
export type AdvisorLanguagePreference = 'ru' | 'en' | 'any';

export type AdvisorLibraryBook = {
  title: string;
  author: string | null;
};

export type AdvisorLibraryContext = {
  books: AdvisorLibraryBook[];
  recentlyOpenedBooks?: AdvisorLibraryBook[];
  commonAuthors?: string[];
};

export type AdvisorRequestPayload = {
  genres: string[];
  moods: string[];
  length: AdvisorLength;
  fiction: boolean;
  classic: boolean;
  freeText: string;
  languagePreference?: AdvisorLanguagePreference;
  responseLanguage?: 'ru' | 'en';
  libraryContext?: AdvisorLibraryContext;
};

export type AdvisorRecommendation = {
  title: string;
  author: string;
  reason: string;
  confidence?: number;
};

export type AdvisorResponse = {
  ok: true;
  source?: 'openrouter' | 'fallback' | string;
  warning?: string;
  advisorComment: string;
  recommendations: AdvisorRecommendation[];
};

const DEFAULT_BACKEND_URL = 'https://diplomaapp-production.up.railway.app';
const REQUEST_TIMEOUT_MS = 15000;

export const AI_BACKEND_URL = (import.meta.env.VITE_AI_BACKEND_URL?.trim() || DEFAULT_BACKEND_URL).replace(/\/+$/, '');

export async function recommendBooks(payload: AdvisorRequestPayload): Promise<AdvisorResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${AI_BACKEND_URL}/api/recommend-books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const data = (await response.json().catch(() => null)) as AdvisorResponse | { error?: string } | null;

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

    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The recommendation request timed out.');
    }

    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    window.clearTimeout(timeoutId);
  }
}
