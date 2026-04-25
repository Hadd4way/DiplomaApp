import { REQUEST_TIMEOUT_MS } from '@/lib/constants';
import { AI_BACKEND_URL, type RecommendationLibraryContext } from '@/services/recommendationApi';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatRequest = {
  messages: ChatMessage[];
  language: 'ru' | 'en';
  libraryContext?: RecommendationLibraryContext;
};

export type ChatResponse = {
  ok: true;
  source?: 'openrouter' | 'fallback';
  reply: string;
};

type ChatApiResponse = ChatResponse | { error?: string } | null;

export async function chatBooks(payload: ChatRequest): Promise<ChatResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS.summary);

  try {
    const response = await fetch(`${AI_BACKEND_URL}/api/chat-books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const data = (await response.json().catch(() => null)) as ChatApiResponse;

    if (!response.ok) {
      throw new Error((data && 'error' in data && data.error) || `Request failed with status ${response.status}`);
    }

    if (
      !data ||
      !('ok' in data) ||
      data.ok !== true ||
      typeof data.reply !== 'string'
    ) {
      throw new Error('The chat service returned an unexpected response.');
    }

    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The chat request timed out.');
    }

    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    window.clearTimeout(timeoutId);
  }
}
