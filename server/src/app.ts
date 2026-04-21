import express from "express";
import cors from "cors";

import { recommendRouter } from "./routes/recommend.routes";
import { summaryRouter } from "./routes/summary.routes";
import { notFoundMiddleware } from "./middleware/notfound.middleware";
import { errorMiddleware } from "./middleware/error.middleware";
import { env } from "./config/env";

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "reading-ai-backend",
    environment: env.NODE_ENV,
    openrouterConfigured: env.OPENROUTER_CONFIGURED
  });
});

app.use("/api", recommendRouter);
app.use("/api", summaryRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app };
