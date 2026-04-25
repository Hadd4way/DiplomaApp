import {
  ChatBooksRequestBody,
  ChatBooksResponse,
  ChatLanguage,
  ChatLibraryContextEntry,
  ChatMessageInput
} from "../types/chat.types";
import { requestBookChatReply } from "./openrouter.service";

const MAX_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_LIBRARY_CONTEXT_ITEMS = 20;
const MAX_LIBRARY_TITLE_LENGTH = 200;
const MAX_LIBRARY_AUTHOR_LENGTH = 120;

const fallbackReplies: Record<ChatLanguage, string> = {
  ru: "Я могу помочь только с книгами, чтением, авторами, жанрами, рекомендациями и планами чтения. Спросите, что почитать дальше, с чего начать тему или какую книгу выбрать под ваше настроение.",
  en: "I can only help with books, reading, authors, genres, recommendations, and reading plans. Ask what to read next, where to start with a topic, or which book fits your mood."
};

interface ValidationResult {
  payload: ChatBooksRequestBody;
  error?: string;
}

const normalizeWhitespace = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const sanitizeMessage = (
  message: ChatMessageInput
): ChatMessageInput | null => {
  if (!message || typeof message !== "object") {
    return null;
  }

  if (message.role !== "user" && message.role !== "assistant") {
    return null;
  }

  if (typeof message.content !== "string") {
    return null;
  }

  const content = normalizeWhitespace(message.content);

  if (!content || content.length > MAX_MESSAGE_LENGTH) {
    return null;
  }

  return {
    role: message.role,
    content
  };
};

const sanitizeLibraryEntry = (
  item: ChatLibraryContextEntry
): ChatLibraryContextEntry | null => {
  if (!item || typeof item !== "object" || typeof item.title !== "string") {
    return null;
  }

  const title = normalizeWhitespace(item.title);

  if (!title || title.length > MAX_LIBRARY_TITLE_LENGTH) {
    return null;
  }

  const author =
    typeof item.author === "string" ? normalizeWhitespace(item.author) : null;

  if (author && author.length > MAX_LIBRARY_AUTHOR_LENGTH) {
    return null;
  }

  return {
    title,
    author: author || null
  };
};

export const validateChatBooksPayload = (
  body: unknown
): ValidationResult => {
  if (!body || typeof body !== "object") {
    return {
      payload: {
        messages: [],
        language: "en"
      },
      error: "Request body must be a JSON object."
    };
  }

  const candidate = body as Partial<ChatBooksRequestBody>;

  if (candidate.language !== "ru" && candidate.language !== "en") {
    return {
      payload: {
        messages: [],
        language: "en"
      },
      error: 'language must be either "ru" or "en".'
    };
  }

  if (!Array.isArray(candidate.messages) || candidate.messages.length === 0) {
    return {
      payload: {
        messages: [],
        language: candidate.language
      },
      error: "messages must be a non-empty array."
    };
  }

  const sanitizedMessages = candidate.messages
    .slice(-MAX_MESSAGES)
    .map((message) => sanitizeMessage(message as ChatMessageInput));

  if (sanitizedMessages.some((message) => message === null)) {
    return {
      payload: {
        messages: [],
        language: candidate.language
      },
      error: `Each message must have role "user" or "assistant" and non-empty content up to ${MAX_MESSAGE_LENGTH} characters.`
    };
  }

  const messages = sanitizedMessages as ChatMessageInput[];

  if (messages[messages.length - 1]?.role !== "user") {
    return {
      payload: {
        messages,
        language: candidate.language
      },
      error: 'The last message must be from role "user".'
    };
  }

  let libraryContext: ChatLibraryContextEntry[] | undefined;

  if (candidate.libraryContext !== undefined) {
    if (!Array.isArray(candidate.libraryContext)) {
      return {
        payload: {
          messages,
          language: candidate.language
        },
        error: "libraryContext must be an array when provided."
      };
    }

    const sanitizedLibraryContext = candidate.libraryContext
      .slice(0, MAX_LIBRARY_CONTEXT_ITEMS)
      .map((item) => sanitizeLibraryEntry(item as ChatLibraryContextEntry));

    if (sanitizedLibraryContext.some((item) => item === null)) {
      return {
        payload: {
          messages,
          language: candidate.language
        },
        error:
          "Each libraryContext item must include a non-empty title and an optional short author."
      };
    }

    libraryContext = sanitizedLibraryContext as ChatLibraryContextEntry[];
  }

  return {
    payload: {
      messages,
      language: candidate.language,
      libraryContext
    }
  };
};

export const chatBooks = async (
  payload: ChatBooksRequestBody
): Promise<ChatBooksResponse> => {
  try {
    const reply = await requestBookChatReply(payload);

    console.log("[chat-books] source=openrouter");

    return {
      ok: true,
      source: "openrouter",
      reply
    };
  } catch (error: unknown) {
    const warning =
      error instanceof Error
        ? error.message
        : "OpenRouter request failed. Using fallback reply.";

    console.warn(`[chat-books] source=fallback reason="${warning}"`);

    return {
      ok: true,
      source: "fallback",
      reply: fallbackReplies[payload.language] ?? fallbackReplies.en
    };
  }
};
