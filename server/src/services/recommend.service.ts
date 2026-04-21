import {
  BookRecommendation,
  RecommendBooksRequestBody,
  RecommendBooksResponse
} from "../types/recommend.types";
import { requestBookRecommendations } from "./openrouter.service";

const mockRecommendations: BookRecommendation[] = [
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

export const recommendBooks = (
  payload: RecommendBooksRequestBody
): Promise<RecommendBooksResponse> => {
  return requestBookRecommendations(payload)
    .then((recommendations) => {
      console.log("[recommend-books] source=openrouter");

      return {
        ok: true,
        source: "openrouter",
        recommendations
      };
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
        recommendations: mockRecommendations,
        warning
      };
    });
};
