import { Router } from "express";

import { chatBooksController } from "../controllers/chat.controller";

const chatRouter = Router();

chatRouter.post("/chat-books", chatBooksController);

export { chatRouter };
