# Reading AI Backend

## Local run

Install dependencies:

```bash
npm install
```

Start in development:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Start the compiled server:

```bash
npm run start
```

## Required environment variables

Copy `.env.example` to `.env` and set:

- `PORT` - optional locally, Railway provides this in production
- `NODE_ENV` - `development` or `production`
- `OPENROUTER_API_KEY` - required for live OpenRouter responses
- `OPENROUTER_MODEL` - optional model override, defaults to `openrouter/elephant-alpha`

## Health check

Use:

```bash
GET /health
```

Example local URL:

```bash
http://localhost:3001/health
```
