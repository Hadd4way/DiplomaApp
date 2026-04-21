import { env } from "../config/env";
import {
  BookRecommendation,
  RecommendBooksRequestBody
} from "../types/recommend.types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_RECOMMENDATIONS = 5;

interface OpenRouterMessage {
  role: "system" | "user";
  content: string;
}

interface OpenRouterChoice {
  message?: {
    content?: string;
  };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
}

interface ParsedRecommendationPayload {
  recommendations?: unknown;
}

const systemPrompt = [
  "You are a book recommendation assistant.",
  `Recommend no more than ${MAX_RECOMMENDATIONS} real books that best match the user's preferences.`,
  "Prefer accurate, well-known book metadata.",
  "Return ONLY valid JSON.",
  'The JSON must have this shape: {"recommendations":[{"title":"string","author":"string","reason":"string","confidence":0.0}]}'
].join(" ");

const buildUserPrompt = (payload: RecommendBooksRequestBody): string => {
  return JSON.stringify(
    {
      genres: payload.genres,
      moods: payload.moods,
      length: payload.length,
      fiction: payload.fiction,
      classic: payload.classic,
      freeText: payload.freeText
    },
    null,
    2
  );
};

const clampConfidence = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
};

const toRecommendation = (item: unknown): BookRecommendation | null => {
  if (!item || typeof item !== "object") {
    return null;
  }

  const candidate = item as Record<string, unknown>;
  const title =
    typeof candidate.title === "string" ? candidate.title.trim() : "";
  const author =
    typeof candidate.author === "string" ? candidate.author.trim() : "";
  const reason =
    typeof candidate.reason === "string" ? candidate.reason.trim() : "";
  const rawConfidence = candidate.confidence;
  const confidence =
    typeof rawConfidence === "number"
      ? clampConfidence(rawConfidence)
      : typeof rawConfidence === "string"
        ? clampConfidence(Number(rawConfidence))
        : 0.5;

  if (!title || !author || !reason) {
    return null;
  }

  return {
    title,
    author,
    reason,
    confidence
  };
};

const parseRecommendations = (content: string): BookRecommendation[] => {
  let parsed: ParsedRecommendationPayload;

  try {
    parsed = JSON.parse(content) as ParsedRecommendationPayload;
  } catch {
    throw new Error("OpenRouter returned invalid JSON content.");
  }

  if (!Array.isArray(parsed.recommendations)) {
    throw new Error("OpenRouter response is missing a recommendations array.");
  }

  const recommendations = parsed.recommendations
    .map(toRecommendation)
    .filter((item): item is BookRecommendation => item !== null)
    .slice(0, MAX_RECOMMENDATIONS);

  if (recommendations.length === 0) {
    throw new Error("OpenRouter response did not contain valid recommendations.");
  }

  return recommendations;
};

const buildHeaders = (): Record<string, string> => {
  return {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3001",
    "X-Title": "Reading AI Backend"
  };
};

export const requestBookRecommendations = async (
  payload: RecommendBooksRequestBody
): Promise<BookRecommendation[]> => {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing. Using fallback recommendations.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, env.OPENROUTER_TIMEOUT_MS);

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: buildUserPrompt(payload)
    }
  ];

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.7
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        `OpenRouter request failed with status ${response.status}.`
      );
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      throw new Error("OpenRouter response did not include message content.");
    }

    return parseRecommendations(content);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenRouter request timed out after 20 seconds.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("OpenRouter request failed unexpectedly.");
  } finally {
    clearTimeout(timeoutId);
  }
};
