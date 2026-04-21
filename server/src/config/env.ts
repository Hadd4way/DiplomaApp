import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT) || 3001,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || "openrouter/elephant-alpha",
  OPENROUTER_TIMEOUT_MS: 20000,
  NODE_ENV: process.env.NODE_ENV || "development"
};
