export const IPC_CHANNELS = {
  ping: 'app:ping',
  discoverSearch: 'discover:search',
  discoverDownload: 'discover:download',
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
  statsGetRecentBooks: 'stats:get-recent-books'
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
export type DiscoverBookFormat = 'epub' | 'txt' | 'html' | 'other';
export type DiscoverSourceFilter = 'all' | DiscoverBookSource;

export type Book = {
  id: string;
  title: string;
  author?: string | null;
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
  author: string | null;
  language: string | null;
  coverUrl: string | null;
  downloadUrl: string | null;
  format: DiscoverBookFormat;
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

export type ErrorResult = { ok: false; error: string };
export type BooksListResult = { ok: true; books: Book[] } | ErrorResult;
export type BooksAddSampleResult = { ok: true; book: Book } | ErrorResult;
export type BooksImportResult = { ok: true; book: Book } | ErrorResult;
export type DiscoverSearchResult = { ok: true; results: DiscoverBookResult[] } | ErrorResult;
export type DiscoverDownloadResult = { ok: true; book: Book } | ErrorResult;
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

export type BooksRevealRequest = {
  bookId: string;
};

export type DiscoverSearchRequest = {
  query: string;
  source?: DiscoverSourceFilter | null;
};

export type DiscoverDownloadRequest = {
  result: DiscoverBookResult;
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

export interface RendererApi {
  ping: () => Promise<PingResponse>;
  discover: RendererDiscoverApi;
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
  getLastPage: (payload: ProgressGetLastPageRequest) => Promise<number | null>;
  setLastPage: (payload: ProgressSetLastPageRequest) => Promise<void>;
}

declare global {
  interface Window {
    api?: RendererApi;
  }
}

export {};
