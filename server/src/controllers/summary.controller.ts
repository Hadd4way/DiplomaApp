import { NextFunction, Request, Response } from "express";

import {
  SummarizeBookNotesRequestBody,
  SummarizeBookNotesResponse
} from "../types/summary.types";
import { summarizeBookNotes } from "../services/summary.service";

export const summarizeBookNotesController = async (
  req: Request<
    unknown,
    SummarizeBookNotesResponse,
    SummarizeBookNotesRequestBody
  >,
  res: Response<SummarizeBookNotesResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await summarizeBookNotes(req.body);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
