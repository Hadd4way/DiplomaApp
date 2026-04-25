export type ChatLanguage = "ru" | "en";
export type ChatSource = "openrouter" | "fallback";
export type ChatMessageRole = "user" | "assistant";

export interface ChatLibraryContextEntry {
  title: string;
  author?: string | null;
}

export interface ChatMessageInput {
  role: ChatMessageRole;
  content: string;
}

export interface ChatBooksRequestBody {
  messages: ChatMessageInput[];
  language: ChatLanguage;
  libraryContext?: ChatLibraryContextEntry[];
}

export interface ChatBooksResponse {
  ok: true;
  source: ChatSource;
  reply: string;
}
