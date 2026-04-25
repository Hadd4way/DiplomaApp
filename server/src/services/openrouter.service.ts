import { env } from "../config/env";
import { ChatBooksRequestBody } from "../types/chat.types";
import {
  BookRecommendation,
  LibraryBookContextEntry,
  RecommendBooksRequestBody
} from "../types/recommend.types";
import {
  BookNotesSummary,
  SummarizeBookNotesRequestBody
} from "../types/summary.types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_RECOMMENDATIONS = 5;

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
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
  advisorComment?: unknown;
  recommendations?: unknown;
}

interface BookRecommendationResult {
  advisorComment: string;
  recommendations: BookRecommendation[];
}

interface ParsedSummaryPayload {
  summary?: unknown;
  keyIdeas?: unknown;
}

const systemPrompt = [
  "You are a book recommendation assistant.",
  `Recommend no more than ${MAX_RECOMMENDATIONS} real books that best match the user's preferences.`,
  "Prefer accurate, well-known book metadata.",
  "Use the user's existing library as a taste signal when available, and avoid recommending books they already own or read.",
  "There are two different language fields in the request.",
  "bookLanguagePreference controls which books should be recommended.",
  "responseLanguage controls only the language of advisorComment and reason text.",
  "Never use responseLanguage as the desired language of the books themselves.",
  "If bookLanguagePreference is en, strongly prefer books originally written in English or primarily known as English-language books.",
  "If bookLanguagePreference is ru, strongly prefer books originally written in Russian or primarily known as Russian-language books.",
  "If bookLanguagePreference is any, choose the best books regardless of original language.",
  "Write every recommendation reason in the requested responseLanguage only.",
  "Write the advisorComment in the requested responseLanguage only.",
  "advisorComment must be short, natural, and helpful.",
  "advisorComment must be 2 to 4 sentences maximum.",
  "advisorComment must explain the overall pattern behind the recommendation set using the user's preferences, not random facts.",
  "Avoid filler and avoid mentioning that you are an AI.",
  "Return ONLY valid JSON.",
  'The JSON must have this shape: {"advisorComment":"string","recommendations":[{"title":"string","author":"string","reason":"string","confidence":0.0}]}'
].join(" ");

const formatLibraryBooks = (books: LibraryBookContextEntry[]): string[] => {
  return books
    .slice(0, 30)
    .map((book) => {
      const title = book.title.trim();
      const author = book.author?.trim();
      return author ? `${title} by ${author}` : title;
    })
    .filter((entry) => entry.length > 0);
};

const buildUserPrompt = (payload: RecommendBooksRequestBody): string => {
  const sections = [
    "User preferences:",
    JSON.stringify(
      {
        genres: payload.genres,
        moods: payload.moods,
        length: payload.length,
        fiction: payload.fiction,
        classic: payload.classic,
        freeText: payload.freeText,
        bookLanguagePreference: payload.languagePreference ?? "any",
        responseLanguage: payload.responseLanguage ?? "en"
      },
      null,
      2
    )
  ];

  sections.push(
    "Important language rules:",
    `- Recommended books language preference: ${payload.languagePreference ?? "any"}`,
    `- Response text language: ${payload.responseLanguage ?? "en"}`,
    "- The response text language is only for advisorComment and reason fields.",
    "- Do not switch the recommended books to Russian just because the response text language is Russian.",
    "- Do not switch the recommended books to English just because the response text language is English."
  );

  const ownedBooks = payload.libraryContext?.books
    ? formatLibraryBooks(payload.libraryContext.books)
    : [];
  const recentlyOpenedBooks = payload.libraryContext?.recentlyOpenedBooks
    ? formatLibraryBooks(payload.libraryContext.recentlyOpenedBooks)
    : [];
  const commonAuthors =
    payload.libraryContext?.commonAuthors
      ?.map((author) => author.trim())
      .filter((author) => author.length > 0)
      .slice(0, 5) ?? [];

  if (ownedBooks.length > 0) {
    sections.push(
      "User already owns/reads:",
      ...ownedBooks.map((book) => `- ${book}`),
      "Use this to improve recommendations."
    );
  }

  if (recentlyOpenedBooks.length > 0) {
    sections.push(
      "Recently opened books:",
      ...recentlyOpenedBooks.map((book) => `- ${book}`)
    );
  }

  if (commonAuthors.length > 0) {
    sections.push(
      "Most common authors in the user's library:",
      ...commonAuthors.map((author) => `- ${author}`)
    );
  }

  return sections.join("\n");
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

const parseRecommendations = (
  content: string,
  fallbackComment: string
): BookRecommendationResult => {
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

  const advisorComment = cleanString(parsed.advisorComment) || fallbackComment;

  return {
    advisorComment,
    recommendations
  };
};

const buildHeaders = (): Record<string, string> => {
  return {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "X-Title": "Reading AI Backend"
  };
};

const requestOpenRouterTextCompletion = async ({
  messages,
  temperature
}: {
  messages: OpenRouterMessage[];
  temperature: number;
}): Promise<string> => {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, env.OPENROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        messages,
        temperature
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const responseText = await response.text();
      const trimmedResponseText = responseText.trim();
      const detail = trimmedResponseText
        ? ` ${trimmedResponseText.slice(0, 200)}`
        : "";

      throw new Error(
        `OpenRouter request failed with status ${response.status}.${detail}`
      );
    }

    let data: OpenRouterResponse;

    try {
      data = (await response.json()) as OpenRouterResponse;
    } catch {
      throw new Error("OpenRouter returned invalid JSON.");
    }

    const content = data.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      throw new Error("OpenRouter response did not include message content.");
    }

    return content.trim();
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

const requestOpenRouterJsonCompletion = async ({
  systemPrompt,
  userPrompt,
  temperature
}: {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
}): Promise<string> => {
  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: userPrompt
    }
  ];

  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, env.OPENROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        messages,
        response_format: { type: "json_object" },
        temperature
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const responseText = await response.text();
      const trimmedResponseText = responseText.trim();
      const detail = trimmedResponseText
        ? ` ${trimmedResponseText.slice(0, 200)}`
        : "";

      throw new Error(
        `OpenRouter request failed with status ${response.status}.${detail}`
      );
    }

    let data: OpenRouterResponse;

    try {
      data = (await response.json()) as OpenRouterResponse;
    } catch {
      throw new Error("OpenRouter returned invalid JSON.");
    }

    const content = data.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      throw new Error("OpenRouter response did not include message content.");
    }

    return content;
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

const cleanString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => cleanString(item))
    .filter((item) => item.length > 0);
};

const parseSummary = (content: string): BookNotesSummary => {
  let parsed: ParsedSummaryPayload;

  try {
    parsed = JSON.parse(content) as ParsedSummaryPayload;
  } catch {
    throw new Error("OpenRouter returned invalid JSON content.");
  }

  const summary = cleanString(parsed.summary);
  const keyIdeas = toStringArray(parsed.keyIdeas);

  if (!summary && keyIdeas.length === 0) {
    throw new Error("OpenRouter response did not contain a usable summary.");
  }

  return {
    summary,
    keyIdeas
  };
};

const summarizeSystemPrompt = [
  "You are a study assistant for a reading app.",
  "Summarize ONLY the user's provided highlights and notes.",
  "Do NOT invent facts or add knowledge that is not explicitly present in the provided text.",
  "Focus on ideas directly supported by the supplied highlights and notes.",
  "Keep the output concise but useful.",
  "Respect the requested output language exactly: ru means Russian, en means English.",
  "If the input is small, still return a useful concise result.",
  "Return ONLY valid JSON.",
  'Use this exact JSON shape: {"summary":"string","keyIdeas":["string"]}'
].join(" ");

const buildSummarizeUserPrompt = (
  payload: SummarizeBookNotesRequestBody
): string => {
  return JSON.stringify(
    {
      task: "summarize-book-notes",
      language: payload.language,
      book: {
        title: payload.bookTitle,
        author: payload.author ?? null
      },
      highlights: payload.highlights,
      notes: payload.notes
    },
    null,
    2
  );
};

const bookChatSystemPrompt = [
  "You are a book-focused assistant inside a reading app.",
  "Help only with books, reading, authors, genres, recommendations, reading plans, and choosing what to read next.",
  "If the user asks about anything off-topic, politely redirect the conversation back to books and reading.",
  "Use the requested language exactly: ru means Russian, en means English.",
  "Keep answers concise, practical, and useful.",
  "When library context is provided, use it as a taste signal and avoid suggesting books already listed there unless the user explicitly asks."
].join(" ");

const formatChatLibraryContext = (
  items: ChatBooksRequestBody["libraryContext"]
): string[] => {
  return (items ?? [])
    .slice(0, 20)
    .map((item) => {
      const title = item.title.trim();
      const author = item.author?.trim();
      return author ? `${title} by ${author}` : title;
    })
    .filter((item) => item.length > 0);
};

const buildBookChatMessages = (
  payload: ChatBooksRequestBody
): OpenRouterMessage[] => {
  const instructions = [
    `Reply language: ${payload.language}`,
    "Topic restriction: books and reading only."
  ];

  const libraryEntries = formatChatLibraryContext(payload.libraryContext);

  if (libraryEntries.length > 0) {
    instructions.push(
      "Library context:",
      ...libraryEntries.map((entry) => `- ${entry}`)
    );
  }

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `${bookChatSystemPrompt}\n${instructions.join("\n")}`
    }
  ];

  for (const message of payload.messages) {
    messages.push({
      role: message.role,
      content: message.content
    });
  }

  return messages;
};

export const requestBookRecommendations = async (
  payload: RecommendBooksRequestBody
): Promise<BookRecommendationResult> => {
  const content = await requestOpenRouterJsonCompletion({
    systemPrompt,
    userPrompt: buildUserPrompt(payload),
    temperature: 0.7
  });

  const fallbackComment =
    payload.responseLanguage === "ru"
      ? "Подборка собрана вокруг ваших текущих предпочтений, чтобы сохранить единое настроение и тип чтения."
      : "This selection is built around your current preferences so the books feel consistent in tone and reading style.";

  return parseRecommendations(content, fallbackComment);
};

export const requestBookNotesSummary = async (
  payload: SummarizeBookNotesRequestBody
): Promise<BookNotesSummary> => {
  const content = await requestOpenRouterJsonCompletion({
    systemPrompt: summarizeSystemPrompt,
    userPrompt: buildSummarizeUserPrompt(payload),
    temperature: 0.3
  });

  return parseSummary(content);
};

export const requestBookChatReply = async (
  payload: ChatBooksRequestBody
): Promise<string> => {
  const content = await requestOpenRouterTextCompletion({
    messages: buildBookChatMessages(payload),
    temperature: 0.5
  });

  return content;
};
