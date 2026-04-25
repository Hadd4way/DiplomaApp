export const AI_BACKEND_DEFAULT_URL = 'https://diplomaapp-production.up.railway.app';

export const REQUEST_TIMEOUT_MS = {
  advisor: 15000,
  summary: 20000
} as const;

export const DEBOUNCE_MS = {
  search: 180,
  librarySearch: 120,
  settingsWrite: 300
} as const;

export const READER_PANEL_WIDTH = {
  default: 320,
  settings: 320,
  offset: 12,
  stackedOffset: 344
} as const;

export const LIST_BATCH_SIZE = {
  library: 24,
  discover: 18,
  knowledgeHub: 20,
  wishlist: 20,
  advisor: 12
} as const;

export const FORMAT_BADGE_LABELS = {
  pdf: 'PDF',
  epub: 'EPUB',
  fb2: 'FB2',
  txt: 'TXT',
  html: 'HTML'
} as const;

export const DISCOVER_PROVIDER_LABELS = {
  gutenberg: 'Project Gutenberg',
  standardebooks: 'Standard Ebooks'
} as const;
