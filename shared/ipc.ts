export const IPC_CHANNELS = {
  ping: 'app:ping',
  discoverSearch: 'discover:search',
  discoverDownload: 'discover:download',
  discoverDownloadProgress: 'discover:download-progress',
  recommendationsHome: 'recommendations:home',
  recommendationsForBook: 'recommendations:for-book',
  wishlistList: 'wishlist:list',
  wishlistSave: 'wishlist:save',
  wishlistRemove: 'wishlist:remove',
  wishlistUpdate: 'wishlist:update',
  booksList: 'books:list',
  booksAddSample: 'books:add-sample',
  booksImport: 'books:import',
  booksReveal: 'books:reveal',
  booksDelete: 'books:delete',
  booksGetPdfData: 'books:get-pdf-data',
  booksGetEpubData: 'books:get-epub-data',
  booksGetFb2Data: 'books:get-fb2-data',
  booksGetTxtData: 'books:get-txt-data',
  notesCreate: 'notes:create',
  notesList: 'notes:list',
  notesDelete: 'notes:delete',
  notesUpdate: 'notes:update',
  highlightsList: 'highlights:list',
  highlightsCreateMerged: 'highlights:create-merged',
  highlightsDelete: 'highlights:delete',
  highlightsInsertRaw: 'highlights:insert-raw',
  highlightsUpdateNote: 'highlights:update-note',
  epubHighlightsList: 'epub-highlights:list',
  epubHighlightsCreate: 'epub-highlights:create',
  bookmarksList: 'bookmarks:list',
  bookmarksToggle: 'bookmarks:toggle',
  bookmarksRemove: 'bookmarks:remove',
  epubBookmarksList: 'epub-bookmarks:list',
  epubBookmarksToggle: 'epub-bookmarks:toggle',
  exportGetBookData: 'export:get-book-data',
  exportSaveFile: 'export:save-file',
  epubProgressGet: 'epub-progress:get',
  epubProgressSet: 'epub-progress:set',
  flowProgressGet: 'flow-progress:get',
  flowProgressSet: 'flow-progress:set',
  readerSettingsGet: 'reader-settings:get',
  readerSettingsUpdate: 'reader-settings:update',
  progressGetLastPage: 'progress:get-last-page',
  progressSetLastPage: 'progress:set-last-page',
  statsMarkOpened: 'stats:mark-opened',
  statsGetRecentBooks: 'stats:get-recent-books',
  aiSummariesSave: 'ai-summaries:save',
  aiSummariesList: 'ai-summaries:list',
  aiSummariesGet: 'ai-summaries:get',
  aiSummariesDelete: 'ai-summaries:delete'
} as const;

export type PingResponse = {
  ok: true;
  message: string;
  versions: {
    electron: string;
    node: string;
    chrome: string;
  };
};

export type BookFormat = 'pdf' | 'epub' | 'fb2' | 'txt';
export type DiscoverBookSource = 'gutenberg' | 'standardebooks';
export type DiscoverSourceFilter = 'all' | DiscoverBookSource;
export type DiscoverBookFormat = 'epub' | 'txt' | 'html' | 'other';

export type Book = {
  id: string;
  title: string;
  subtitle?: string | null;
  author?: string | null;
  coverUrl?: string | null;
  description?: string | null;
  subjects?: string[];
  publishYear?: number | null;
  format: BookFormat;
  filePath?: string | null;
  createdAt: number;
};

export type Note = {
  id: string;
  bookId: string;
  page: number;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export type HighlightRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Highlight = {
  id: string;
  bookId: string;
  page: number | null;
  rects: HighlightRect[];
  cfiRange: string | null;
  text: string | null;
  note: string | null;
  createdAt: number;
  updatedAt: number;
};

export type DiscoverBookResult = {
  id: string;
  source: DiscoverBookSource;
  title: string;
  subtitle?: string | null;
  author: string | null;
  languages: string[];
  coverUrl: string | null;
  description?: string | null;
  subjects?: string[];
  publishYear?: number | null;
  downloadCount: number | null;
  formats: Array<{
    kind: DiscoverBookFormat;
    mimeType: string;
    url: string;
  }>;
};

export type DiscoverBookFormatDescriptor = DiscoverBookResult['formats'][number];

export type DiscoverDownloadState = 'idle' | 'downloading' | 'importing' | 'completed' | 'failed';

export type DiscoverDownloadProgressEvent = {
  resultId: string;
  state: DiscoverDownloadState;
  bytesReceived: number | null;
  totalBytes: number | null;
  progressPercent: number | null;
  message: string | null;
};

export type Bookmark = {
  id: string;
  bookId: string;
  page: number;
  createdAt: number;
};

export type EpubBookmark = {
  id: string;
  bookId: string;
  cfi: string;
  label: string | null;
  createdAt: number;
};

export type ReaderTheme = 'light' | 'sepia' | 'dark';
export type EpubMarginSize = 'small' | 'medium' | 'large';
export type EpubFontFamily = 'serif' | 'sans' | 'georgia' | 'openDyslexic';
export type PdfZoomPreset = 'fitWidth' | 'fitPage' | 'actualSize';
export type TextSizePreset = 'normal' | 'large' | 'extraLarge';

export type ReaderSettings = {
  theme: ReaderTheme;
  epubFontSize: number;
  epubLineHeight: number;
  epubMargins: EpubMarginSize;
  epubFontFamily: EpubFontFamily;
  pdfBackground: ReaderTheme;
  pdfZoomPreset: PdfZoomPreset;
  dyslexiaFriendlyMode: boolean;
  highContrastMode: boolean;
  textSizePreset: TextSizePreset;
  reduceMotion: boolean;
};

export const READER_SETTINGS_DEFAULTS: ReaderSettings = {
  theme: 'light',
  epubFontSize: 100,
  epubLineHeight: 1.6,
  epubMargins: 'medium',
  epubFontFamily: 'serif',
  pdfBackground: 'light',
  pdfZoomPreset: 'fitWidth',
  dyslexiaFriendlyMode: false,
  highContrastMode: false,
  textSizePreset: 'normal',
  reduceMotion: false
};

export type ReaderSettingsPatch = {
  theme?: ReaderTheme;
  epubFontSize?: number;
  epubLineHeight?: number;
  epubMargins?: EpubMarginSize;
  epubFontFamily?: EpubFontFamily;
  pdfBackground?: ReaderTheme;
  pdfZoomPreset?: PdfZoomPreset;
  dyslexiaFriendlyMode?: boolean;
  highContrastMode?: boolean;
  textSizePreset?: TextSizePreset;
  reduceMotion?: boolean;
};

export type RecentBookEntry = {
  bookId: string;
  title: string;
  format: BookFormat;
  lastOpenedAt: number | null;
};

export type RecommendationReason =
  | 'matching-author'
  | 'matching-genre'
  | 'continue-reading'
  | 'rediscover'
  | 'recently-opened-signal'
  | 'author-collection'
  | 'similar-title';

export type RecommendationEntry = {
  book: Book;
  score: number;
  reasons: RecommendationReason[];
  matchedAuthors: string[];
  matchedSubjects: string[];
};

export type RecommendationProfileSummary = {
  topAuthors: string[];
  topSubjects: string[];
  recentBookIds: string[];
};

export type WishlistItem = {
  id: string;
  title: string;
  author: string | null;
  reason: string;
  confidence: number | null;
  createdAt: number;
  readLater: boolean;
};

export type AiSummaryFlashcard = {
  question: string;
  answer: string;
};

export type AiSummaryEntry = {
  id: string;
  bookId: string | null;
  bookTitle: string;
  author: string | null;
  language: 'ru' | 'en';
  summary: string;
  keyIdeas: string[];
  studyNotes: string[];
  flashcards: AiSummaryFlashcard[];
  createdAt: number;
  updatedAt: number;
};

export type ErrorResult = { ok: false; error: string };
export type BooksListResult = { ok: true; books: Book[] } | ErrorResult;
export type BooksAddSampleResult = { ok: true; book: Book } | ErrorResult;
export type BooksImportResult = { ok: true; book: Book } | ErrorResult;
export type DiscoverSearchResult = { ok: true; results: DiscoverBookResult[] } | ErrorResult;
export type DiscoverDownloadResult =
  | { ok: true; book: Book; duplicateWarning: string | null }
  | ErrorResult;
export type BooksRevealResult = { ok: true } | ErrorResult;
export type BooksDeleteResult = { ok: true } | ErrorResult;
export type BooksGetPdfDataResult = { ok: true; base64: string; title: string } | ErrorResult;
export type BooksGetEpubDataResult = { ok: true; base64: string; title: string } | ErrorResult;
export type BooksGetFb2DataResult = { ok: true; content: string; title: string } | ErrorResult;
export type BooksGetTxtDataResult = { ok: true; content: string; title: string } | ErrorResult;
export type NotesCreateResult = { ok: true; note: Note } | ErrorResult;
export type NotesListResult = { ok: true; notes: Note[] } | ErrorResult;
export type NotesDeleteResult = { ok: true } | ErrorResult;
export type NotesUpdateResult = { ok: true; note: Note } | ErrorResult;
export type HighlightsListResult = { ok: true; highlights: Highlight[] } | ErrorResult;
export type HighlightsCreateMergedResult = { ok: true; highlight: Highlight } | ErrorResult;
export type HighlightsDeleteResult = { ok: true } | ErrorResult;
export type HighlightsInsertRawResult = { ok: true; highlight: Highlight } | ErrorResult;
export type HighlightsUpdateNoteResult = { ok: true; highlight: Highlight } | ErrorResult;
export type EpubHighlightsListResult = { ok: true; highlights: Highlight[] } | ErrorResult;
export type EpubHighlightsCreateResult = { ok: true; highlight: Highlight } | ErrorResult;
export type BookmarksListResult = { ok: true; bookmarks: Bookmark[] } | ErrorResult;
export type BookmarksToggleResult = { ok: true; bookmarked: boolean } | ErrorResult;
export type BookmarksRemoveResult = { ok: true } | ErrorResult;
export type EpubBookmarksListResult = { ok: true; bookmarks: EpubBookmark[] } | ErrorResult;
export type EpubBookmarksToggleResult =
  | { ok: true; bookmarked: boolean; bookmark?: EpubBookmark }
  | ErrorResult;
export type ExportGetBookDataResult =
  | {
      ok: true;
      data: {
        book: Book;
        notes: Note[];
        highlights: Highlight[];
      };
    }
  | ErrorResult;
export type ExportSaveFileResult =
  | { ok: true; path: string }
  | { ok: false; cancelled: true }
  | ErrorResult;
export type EpubProgressGetResult = { ok: true; cfi: string | null } | ErrorResult;
export type EpubProgressSetResult = { ok: true } | ErrorResult;
export type FlowProgressGetResult =
  | {
      ok: true;
      progress: {
        chapterIndex: number | null;
        scrollRatio: number | null;
      };
    }
  | ErrorResult;
export type FlowProgressSetResult = { ok: true } | ErrorResult;
export type ReaderSettingsGetResult = { ok: true; settings: ReaderSettings } | ErrorResult;
export type ReaderSettingsUpdateResult = { ok: true; settings: ReaderSettings } | ErrorResult;
export type StatsMarkOpenedResult = { ok: true } | ErrorResult;
export type StatsGetRecentBooksResult = { ok: true; books: RecentBookEntry[] } | ErrorResult;
export type RecommendationsHomeResult =
  | {
      ok: true;
      recommendations: RecommendationEntry[];
      profile: RecommendationProfileSummary;
    }
  | ErrorResult;
export type RecommendationsForBookResult =
  | {
      ok: true;
      bookId: string;
      similarBooks: RecommendationEntry[];
      moreByAuthor: RecommendationEntry[];
    }
  | ErrorResult;
export type WishlistListResult = { ok: true; items: WishlistItem[] } | ErrorResult;
export type WishlistSaveResult = { ok: true; item: WishlistItem; alreadySaved: boolean } | ErrorResult;
export type WishlistRemoveResult = { ok: true } | ErrorResult;
export type WishlistUpdateResult = { ok: true; item: WishlistItem } | ErrorResult;
export type AiSummariesSaveResult = { ok: true; entry: AiSummaryEntry } | ErrorResult;
export type AiSummariesListResult = { ok: true; entries: AiSummaryEntry[] } | ErrorResult;
export type AiSummariesGetResult = { ok: true; entry: AiSummaryEntry | null } | ErrorResult;
export type AiSummariesDeleteResult = { ok: true } | ErrorResult;

export type BooksRevealRequest = {
  bookId: string;
};

export type DiscoverSearchRequest = {
  query: string;
  source?: DiscoverSourceFilter | null;
  language?: string | null;
  page?: number | null;
};

export type DiscoverDownloadRequest = {
  result?: DiscoverBookResult;
  resultId?: string | null;
};

export type BooksDeleteRequest = {
  bookId: string;
};

export type BooksGetPdfDataRequest = {
  bookId: string;
};

export type BooksGetEpubDataRequest = {
  bookId: string;
};

export type BooksGetFb2DataRequest = {
  bookId: string;
};

export type BooksGetTxtDataRequest = {
  bookId: string;
};

export type NotesCreateRequest = {
  bookId: string;
  page: number;
  content: string;
};

export type NotesListRequest = {
  bookId?: string | null;
  q?: string | null;
};

export type NotesDeleteRequest = {
  noteId: string;
};

export type NotesUpdateRequest = {
  noteId: string;
  content: string;
};

export type HighlightsListRequest = {
  bookId: string;
  page?: number | null;
};

export type HighlightsCreateMergedRequest = {
  bookId: string;
  page: number;
  rects: HighlightRect[];
  text: string | null;
};

export type HighlightsDeleteRequest = {
  highlightId: string;
};

export type HighlightsInsertRawRequest = {
  bookId: string;
  page?: number | null;
  rects?: HighlightRect[] | null;
  cfiRange?: string | null;
  text: string | null;
  note?: string | null;
};

export type HighlightsUpdateNoteRequest = {
  highlightId: string;
  note: string | null;
};

export type EpubHighlightsListRequest = {
  bookId: string;
};

export type EpubHighlightsCreateRequest = {
  bookId: string;
  cfiRange: string;
  text: string | null;
};

export type BookmarksListRequest = {
  bookId: string;
};

export type BookmarksToggleRequest = {
  bookId: string;
  page: number;
};

export type BookmarksRemoveRequest = {
  bookId: string;
  page: number;
};

export type EpubBookmarksListRequest = {
  bookId: string;
};

export type EpubBookmarksToggleRequest = {
  bookId: string;
  cfi: string;
  label: string | null;
};

export type ExportGetBookDataRequest = {
  bookId: string;
};

export type ExportSaveFileRequest = {
  suggestedName: string;
  ext: 'md' | 'json';
  content: string;
};

export type EpubProgressGetRequest = {
  bookId: string;
};

export type EpubProgressSetRequest = {
  bookId: string;
  cfi: string;
};

export type FlowProgressGetRequest = {
  bookId: string;
};

export type FlowProgressSetRequest = {
  bookId: string;
  chapterIndex: number;
  scrollRatio: number;
};

export type ReaderSettingsGetRequest = {
  token: string;
};

export type ReaderSettingsUpdateRequest = {
  token: string;
  patch: ReaderSettingsPatch;
};

export type ProgressGetLastPageRequest = {
  bookId: string;
};

export type ProgressSetLastPageRequest = {
  bookId: string;
  lastPage: number;
};

export type StatsMarkOpenedRequest = {
  bookId: string;
  format: BookFormat;
};

export type RecommendationsForBookRequest = {
  bookId: string;
};

export type WishlistSaveRequest = {
  title: string;
  author?: string | null;
  reason: string;
  confidence?: number | null;
};

export type WishlistRemoveRequest = {
  itemId: string;
};

export type WishlistUpdateRequest = {
  itemId: string;
  readLater: boolean;
};

export type AiSummariesSaveRequest = {
  id?: string;
  bookId: string | null;
  bookTitle: string;
  author: string | null;
  language: 'ru' | 'en';
  summary: string;
  keyIdeas: string[];
  studyNotes: string[];
  flashcards: AiSummaryFlashcard[];
};

export type AiSummariesGetRequest = {
  id: string;
};

export type AiSummariesDeleteRequest = {
  id: string;
};

export interface RendererBooksApi {
  list: () => Promise<BooksListResult>;
  addSample: () => Promise<BooksAddSampleResult>;
  import: () => Promise<BooksImportResult>;
  reveal: (payload: BooksRevealRequest) => Promise<BooksRevealResult>;
  delete: (payload: BooksDeleteRequest) => Promise<BooksDeleteResult>;
  getPdfData: (payload: BooksGetPdfDataRequest) => Promise<BooksGetPdfDataResult>;
  getEpubData: (payload: BooksGetEpubDataRequest) => Promise<BooksGetEpubDataResult>;
  getFb2Data: (payload: BooksGetFb2DataRequest) => Promise<BooksGetFb2DataResult>;
  getTxtData: (payload: BooksGetTxtDataRequest) => Promise<BooksGetTxtDataResult>;
}

export interface RendererDiscoverApi {
  search: (payload: DiscoverSearchRequest) => Promise<DiscoverSearchResult>;
  download: (payload: DiscoverDownloadRequest) => Promise<DiscoverDownloadResult>;
  onDownloadProgress: (listener: (event: DiscoverDownloadProgressEvent) => void) => () => void;
}

export interface RendererNotesApi {
  create: (payload: NotesCreateRequest) => Promise<NotesCreateResult>;
  list: (payload: NotesListRequest) => Promise<NotesListResult>;
  delete: (payload: NotesDeleteRequest) => Promise<NotesDeleteResult>;
  update: (payload: NotesUpdateRequest) => Promise<NotesUpdateResult>;
}

export interface RendererHighlightsApi {
  list: (payload: HighlightsListRequest) => Promise<HighlightsListResult>;
  createMerged: (payload: HighlightsCreateMergedRequest) => Promise<HighlightsCreateMergedResult>;
  delete: (payload: HighlightsDeleteRequest) => Promise<HighlightsDeleteResult>;
  insertRaw: (payload: HighlightsInsertRawRequest) => Promise<HighlightsInsertRawResult>;
  updateNote: (payload: HighlightsUpdateNoteRequest) => Promise<HighlightsUpdateNoteResult>;
}

export interface RendererEpubHighlightsApi {
  list: (payload: EpubHighlightsListRequest) => Promise<EpubHighlightsListResult>;
  create: (payload: EpubHighlightsCreateRequest) => Promise<EpubHighlightsCreateResult>;
}

export interface RendererBookmarksApi {
  list: (payload: BookmarksListRequest) => Promise<BookmarksListResult>;
  toggle: (payload: BookmarksToggleRequest) => Promise<BookmarksToggleResult>;
  remove: (payload: BookmarksRemoveRequest) => Promise<BookmarksRemoveResult>;
}

export interface RendererEpubBookmarksApi {
  list: (payload: EpubBookmarksListRequest) => Promise<EpubBookmarksListResult>;
  toggle: (payload: EpubBookmarksToggleRequest) => Promise<EpubBookmarksToggleResult>;
}

export interface RendererExportApi {
  getBookData: (payload: ExportGetBookDataRequest) => Promise<ExportGetBookDataResult>;
  saveFile: (payload: ExportSaveFileRequest) => Promise<ExportSaveFileResult>;
}

export interface RendererEpubProgressApi {
  get: (payload: EpubProgressGetRequest) => Promise<EpubProgressGetResult>;
  set: (payload: EpubProgressSetRequest) => Promise<EpubProgressSetResult>;
}

export interface RendererFlowProgressApi {
  get: (payload: FlowProgressGetRequest) => Promise<FlowProgressGetResult>;
  set: (payload: FlowProgressSetRequest) => Promise<FlowProgressSetResult>;
}

export interface RendererReaderSettingsApi {
  get: (payload: ReaderSettingsGetRequest) => Promise<ReaderSettingsGetResult>;
  update: (payload: ReaderSettingsUpdateRequest) => Promise<ReaderSettingsUpdateResult>;
}

export interface RendererStatsApi {
  markOpened: (payload: StatsMarkOpenedRequest) => Promise<StatsMarkOpenedResult>;
  getRecentBooks: () => Promise<StatsGetRecentBooksResult>;
}

export interface RendererRecommendationsApi {
  getHome: () => Promise<RecommendationsHomeResult>;
  getForBook: (payload: RecommendationsForBookRequest) => Promise<RecommendationsForBookResult>;
}

export interface RendererWishlistApi {
  list: () => Promise<WishlistListResult>;
  save: (payload: WishlistSaveRequest) => Promise<WishlistSaveResult>;
  remove: (payload: WishlistRemoveRequest) => Promise<WishlistRemoveResult>;
  update: (payload: WishlistUpdateRequest) => Promise<WishlistUpdateResult>;
}

export interface RendererAiSummariesApi {
  save: (payload: AiSummariesSaveRequest) => Promise<AiSummariesSaveResult>;
  list: () => Promise<AiSummariesListResult>;
  get: (payload: AiSummariesGetRequest) => Promise<AiSummariesGetResult>;
  delete: (payload: AiSummariesDeleteRequest) => Promise<AiSummariesDeleteResult>;
}

export interface RendererApi {
  ping: () => Promise<PingResponse>;
  discover: RendererDiscoverApi;
  recommendations: RendererRecommendationsApi;
  wishlist: RendererWishlistApi;
  books: RendererBooksApi;
  notes: RendererNotesApi;
  highlights: RendererHighlightsApi;
  epubHighlights: RendererEpubHighlightsApi;
  bookmarks: RendererBookmarksApi;
  epubBookmarks: RendererEpubBookmarksApi;
  export: RendererExportApi;
  epubProgress: RendererEpubProgressApi;
  flowProgress: RendererFlowProgressApi;
  readerSettings: RendererReaderSettingsApi;
  stats: RendererStatsApi;
  aiSummaries: RendererAiSummariesApi;
  getLastPage: (payload: ProgressGetLastPageRequest) => Promise<number | null>;
  setLastPage: (payload: ProgressSetLastPageRequest) => Promise<void>;
}

declare global {
  interface Window {
    api?: RendererApi;
  }
}

export {};
