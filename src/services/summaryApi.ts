export type SummaryLanguage = 'ru' | 'en';

export type SummarizeBookNotesPayload = {
  bookTitle: string;
  author: string | null;
  highlights: Array<{
    text: string | null;
    note: string | null;
  }>;
  notes: Array<{
    content: string;
  }>;
  language: SummaryLanguage;
};

export type AiSummaryResult = {
  summary: string;
  keyIdeas: string[];
};

export type SummarizeBookNotesResponse = {
  ok: true;
  source: 'openrouter' | 'fallback';
  result: AiSummaryResult;
};

const DEFAULT_BACKEND_URL = 'http://localhost:3001';
const REQUEST_TIMEOUT_MS = 20000;

const AI_BACKEND_URL = (import.meta.env.VITE_AI_BACKEND_URL?.trim() || DEFAULT_BACKEND_URL).replace(/\/+$/, '');

export async function summarizeBookNotes(payload: SummarizeBookNotesPayload): Promise<SummarizeBookNotesResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${AI_BACKEND_URL}/api/summarize-book-notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const data = (await response.json().catch(() => null)) as SummarizeBookNotesResponse | { error?: string } | null;

    if (!response.ok) {
      throw new Error((data && 'error' in data && data.error) || `Request failed with status ${response.status}`);
    }

    if (!data || !('ok' in data) || data.ok !== true || !data.result || typeof data.result.summary !== 'string') {
      throw new Error('The AI summary service returned an unexpected response.');
    }

    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The AI summary request timed out.');
    }

    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    window.clearTimeout(timeoutId);
  }
}
