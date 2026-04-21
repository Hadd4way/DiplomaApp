import { Router } from "express";

import { recommendBooksController } from "../controllers/recommend.controller";

const recommendRouter = Router();

recommendRouter.post("/recommend-books", recommendBooksController);

export { recommendRouter };
