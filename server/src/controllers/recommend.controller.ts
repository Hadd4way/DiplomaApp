import { Request, Response, NextFunction } from "express";

import {
  RecommendBooksRequestBody,
  RecommendBooksResponse
} from "../types/recommend.types";
import { recommendBooks } from "../services/recommend.service";

export const recommendBooksController = async (
  req: Request<unknown, RecommendBooksResponse, RecommendBooksRequestBody>,
  res: Response<RecommendBooksResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await recommendBooks(req.body);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
