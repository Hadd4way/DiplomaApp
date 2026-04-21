import {
  BookNotesSummary,
  SummarizeBookNotesRequestBody,
  SummarizeBookNotesResponse
} from "../types/summary.types";
import { requestBookNotesSummary } from "./openrouter.service";

const normalizeText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
};

const getCandidateItems = (
  payload: SummarizeBookNotesRequestBody
): string[] => {
  const items: string[] = [];

  for (const highlight of payload.highlights) {
    const text = normalizeText(highlight.text);
    const note = normalizeText(highlight.note);

    if (text) {
      items.push(text);
    }
    if (note) {
      items.push(note);
    }
  }

  for (const note of payload.notes) {
    const content = normalizeText(note.content);
    if (content) {
      items.push(content);
    }
  }

  return [...new Set(items)];
};

const fallbackSummaryText = (
  language: SummarizeBookNotesRequestBody["language"]
): string => {
  return language === "ru"
    ? "Материала пока немного, поэтому конспект получился коротким и опирается только на выбранные заметки и выделения."
    : "There is only a small amount of material here, so this summary stays brief and only reflects the selected notes and highlights.";
};

const fallbackIdeaText = (
  language: SummarizeBookNotesRequestBody["language"]
): string => {
  return language === "ru"
    ? "Выделите ещё несколько фрагментов, чтобы собрать более полный список идей."
    : "Add a few more highlights or notes to surface a richer set of ideas.";
};

const buildFallbackSummary = (
  payload: SummarizeBookNotesRequestBody
): BookNotesSummary => {
  const candidates = getCandidateItems(payload);

  return {
    summary:
      candidates.slice(0, 3).join(" ") || fallbackSummaryText(payload.language),
    keyIdeas:
      candidates.slice(0, 3).length > 0
        ? candidates.slice(0, 3)
        : [fallbackIdeaText(payload.language)]
  };
};

export const summarizeBookNotes = async (
  payload: SummarizeBookNotesRequestBody
): Promise<SummarizeBookNotesResponse> => {
  try {
    const result = await requestBookNotesSummary(payload);

    console.log("[summarize-book-notes] source=openrouter");

    return {
      ok: true,
      source: "openrouter",
      result
    };
  } catch (error: unknown) {
    const warning =
      error instanceof Error
        ? error.message
        : "OpenRouter request failed. Using fallback summary.";

    console.warn(
      `[summarize-book-notes] source=fallback reason="${warning}"`
    );

    return {
      ok: true,
      source: "fallback",
      result: buildFallbackSummary(payload)
    };
  }
};
