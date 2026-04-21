import { Router } from "express";

import { summarizeBookNotesController } from "../controllers/summary.controller";

const summaryRouter = Router();

summaryRouter.post("/summarize-book-notes", summarizeBookNotesController);

export { summaryRouter };
