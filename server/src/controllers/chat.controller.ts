import { NextFunction, Request, Response } from "express";

import { chatBooks, validateChatBooksPayload } from "../services/chat.service";
import {
  ChatBooksRequestBody,
  ChatBooksResponse
} from "../types/chat.types";

export const chatBooksController = async (
  req: Request<unknown, ChatBooksResponse, ChatBooksRequestBody>,
  res: Response<ChatBooksResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const validation = validateChatBooksPayload(req.body);

    if (validation.error) {
      res.status(400).json({
        ok: true,
        source: "fallback",
        reply: validation.error
      });
      return;
    }

    const result = await chatBooks(validation.payload);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
