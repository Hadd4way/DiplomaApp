import dotenv from "dotenv";

dotenv.config();

type NodeEnvironment = "development" | "production" | "test";

const DEFAULT_PORT = 3001;
const DEFAULT_OPENROUTER_MODEL = "openrouter/elephant-alpha";
const DEFAULT_OPENROUTER_TIMEOUT_MS = 20000;

const parsePort = (value: string | undefined): number => {
  if (!value) {
    return DEFAULT_PORT;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
};

const parseNodeEnv = (value: string | undefined): NodeEnvironment => {
  if (value === "production" || value === "test") {
    return value;
  }

  return "development";
};

const cleanOptionalString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const NODE_ENV = parseNodeEnv(process.env.NODE_ENV);
const OPENROUTER_API_KEY = cleanOptionalString(process.env.OPENROUTER_API_KEY);

export const env = {
  PORT: parsePort(process.env.PORT),
  NODE_ENV,
  OPENROUTER_API_KEY,
  OPENROUTER_MODEL:
    cleanOptionalString(process.env.OPENROUTER_MODEL) ??
    DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_TIMEOUT_MS: DEFAULT_OPENROUTER_TIMEOUT_MS,
  OPENROUTER_CONFIGURED: Boolean(OPENROUTER_API_KEY),
  IS_PRODUCTION: NODE_ENV === "production",
  IS_DEVELOPMENT: NODE_ENV === "development"
} as const;
