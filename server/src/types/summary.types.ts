export interface SummaryHighlightInput {
  text: string | null;
  note: string | null;
}

export interface SummaryNoteInput {
  content: string;
}

export type SummaryLanguage = "ru" | "en";
export type SummarySource = "openrouter" | "fallback";

export interface SummarizeBookNotesRequestBody {
  bookTitle: string;
  author: string | null;
  highlights: SummaryHighlightInput[];
  notes: SummaryNoteInput[];
  language: SummaryLanguage;
}

export interface BookNotesSummary {
  summary: string;
  keyIdeas: string[];
}

export interface SummarizeBookNotesResponse {
  ok: true;
  source: SummarySource;
  result: BookNotesSummary;
}
