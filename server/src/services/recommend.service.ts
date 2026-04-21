import {
  BookRecommendation,
  RecommendBooksRequestBody,
  RecommendBooksResponse
} from "../types/recommend.types";
import { requestBookRecommendations } from "./openrouter.service";

const englishFallbackRecommendations: BookRecommendation[] = [
  {
    title: "1984",
    author: "George Orwell",
    reason: "Matches dystopian intellectual dark preferences",
    confidence: 0.95
  },
  {
    title: "Brave New World",
    author: "Aldous Huxley",
    reason: "Classic dystopian philosophical fiction",
    confidence: 0.91
  }
];

const russianFallbackRecommendations: BookRecommendation[] = [
  {
    title: "Мастер и Маргарита",
    author: "Михаил Булгаков",
    reason: "Подходит под интеллектуальную, мрачноватую и классическую читательскую настройку",
    confidence: 0.94
  },
  {
    title: "Пикник на обочине",
    author: "Аркадий и Борис Стругацкие",
    reason: "Сочетает атмосферность, философский подтекст и сильную жанровую идею",
    confidence: 0.9
  }
];

const getFallbackRecommendations = (
  payload: RecommendBooksRequestBody
): BookRecommendation[] => {
  if (payload.languagePreference === "ru") {
    return russianFallbackRecommendations;
  }

  return englishFallbackRecommendations;
};

const buildFallbackAdvisorComment = (
  payload: RecommendBooksRequestBody
): string => {
  const responseLanguage = payload.responseLanguage ?? "en";
  const traits: string[] = [];

  if (payload.moods.length > 0) {
    traits.push(...payload.moods.slice(0, 2).map((item) => item.toLowerCase()));
  }

  if (payload.genres.length > 0) {
    traits.push(...payload.genres.slice(0, 2).map((item) => item.toLowerCase()));
  }

  if (payload.classic) {
    traits.push(responseLanguage === "ru" ? "классическую направленность" : "classic leanings");
  }

  if (payload.fiction) {
    traits.push(responseLanguage === "ru" ? "художественную литературу" : "fiction");
  }

  const uniqueTraits = [...new Set(traits)].slice(0, 3);

  if (responseLanguage === "ru") {
    const preferenceSummary =
      uniqueTraits.length > 0
        ? uniqueTraits.join(", ")
        : "общий читательский профиль";

    return `Подборка опирается на ваши предпочтения: ${preferenceSummary}. Я постарался собрать книги с близким настроением и подходом, чтобы список ощущался цельным, а не случайным.`;
  }

  const preferenceSummary =
    uniqueTraits.length > 0
      ? uniqueTraits.join(", ")
      : "your overall reading profile";

  return `This selection is based on your preferences for ${preferenceSummary}. I kept the set focused so the books feel consistent in tone and reading experience rather than random.`;
};

export const recommendBooks = (
  payload: RecommendBooksRequestBody
): Promise<RecommendBooksResponse> => {
  return requestBookRecommendations(payload)
    .then((result) => {
      console.log("[recommend-books] source=openrouter");

      const response: RecommendBooksResponse = {
        ok: true,
        source: "openrouter",
        advisorComment: result.advisorComment,
        recommendations: result.recommendations
      };

      return response;
    })
    .catch((error: unknown) => {
      const warning =
        error instanceof Error
          ? error.message
          : "OpenRouter request failed. Using fallback recommendations.";

      console.warn(`[recommend-books] source=fallback reason="${warning}"`);

      return {
        ok: true,
        source: "fallback",
        advisorComment: buildFallbackAdvisorComment(payload),
        recommendations: getFallbackRecommendations(payload),
        warning
      };
    });
};
