export const IPC_CHANNELS = {
  ping: 'app:ping',
  booksList: 'books:list',
  booksAddSample: 'books:add-sample',
  booksImport: 'books:import',
  booksReveal: 'books:reveal',
  booksDelete: 'books:delete',
  booksGetPdfData: 'books:get-pdf-data',
  booksGetEpubData: 'books:get-epub-data',
  notesCreate: 'notes:create',
  notesList: 'notes:list',
  notesDelete: 'notes:delete',
  notesUpdate: 'notes:update',
  highlightsList: 'highlights:list',
  highlightsCreateMerged: 'highlights:create-merged',
  highlightsDelete: 'highlights:delete',
  highlightsInsertRaw: 'highlights:insert-raw',
  bookmarksList: 'bookmarks:list',
  bookmarksToggle: 'bookmarks:toggle',
  bookmarksRemove: 'bookmarks:remove',
  exportGetBookData: 'export:get-book-data',
  exportSaveFile: 'export:save-file',
  epubProgressGet: 'epub-progress:get',
  epubProgressSet: 'epub-progress:set',
  progressGetLastPage: 'progress:get-last-page',
  progressSetLastPage: 'progress:set-last-page'
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

export type BookFormat = 'pdf' | 'epub';

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
  page: number;
  rects: HighlightRect[];
  text: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Bookmark = {
  id: string;
  bookId: string;
  page: number;
  createdAt: number;
};

export type ErrorResult = { ok: false; error: string };
export type BooksListResult = { ok: true; books: Book[] } | ErrorResult;
export type BooksAddSampleResult = { ok: true; book: Book } | ErrorResult;
export type BooksImportResult = { ok: true; book: Book } | ErrorResult;
export type BooksRevealResult = { ok: true } | ErrorResult;
export type BooksDeleteResult = { ok: true } | ErrorResult;
export type BooksGetPdfDataResult = { ok: true; base64: string; title: string } | ErrorResult;
export type BooksGetEpubDataResult = { ok: true; base64: string; title: string } | ErrorResult;
export type NotesCreateResult = { ok: true; note: Note } | ErrorResult;
export type NotesListResult = { ok: true; notes: Note[] } | ErrorResult;
export type NotesDeleteResult = { ok: true } | ErrorResult;
export type NotesUpdateResult = { ok: true; note: Note } | ErrorResult;
export type HighlightsListResult = { ok: true; highlights: Highlight[] } | ErrorResult;
export type HighlightsCreateMergedResult = { ok: true; highlight: Highlight } | ErrorResult;
export type HighlightsDeleteResult = { ok: true } | ErrorResult;
export type HighlightsInsertRawResult = { ok: true; highlight: Highlight } | ErrorResult;
export type BookmarksListResult = { ok: true; bookmarks: Bookmark[] } | ErrorResult;
export type BookmarksToggleResult = { ok: true; bookmarked: boolean } | ErrorResult;
export type BookmarksRemoveResult = { ok: true } | ErrorResult;
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

export type BooksRevealRequest = {
  bookId: string;
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
  page: number;
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
  page: number;
  rects: HighlightRect[];
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

export type ProgressGetLastPageRequest = {
  bookId: string;
};

export type ProgressSetLastPageRequest = {
  bookId: string;
  lastPage: number;
};

export interface RendererBooksApi {
  list: () => Promise<BooksListResult>;
  addSample: () => Promise<BooksAddSampleResult>;
  import: () => Promise<BooksImportResult>;
  reveal: (payload: BooksRevealRequest) => Promise<BooksRevealResult>;
  delete: (payload: BooksDeleteRequest) => Promise<BooksDeleteResult>;
  getPdfData: (payload: BooksGetPdfDataRequest) => Promise<BooksGetPdfDataResult>;
  getEpubData: (payload: BooksGetEpubDataRequest) => Promise<BooksGetEpubDataResult>;
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
}

export interface RendererBookmarksApi {
  list: (payload: BookmarksListRequest) => Promise<BookmarksListResult>;
  toggle: (payload: BookmarksToggleRequest) => Promise<BookmarksToggleResult>;
  remove: (payload: BookmarksRemoveRequest) => Promise<BookmarksRemoveResult>;
}

export interface RendererExportApi {
  getBookData: (payload: ExportGetBookDataRequest) => Promise<ExportGetBookDataResult>;
  saveFile: (payload: ExportSaveFileRequest) => Promise<ExportSaveFileResult>;
}

export interface RendererEpubProgressApi {
  get: (payload: EpubProgressGetRequest) => Promise<EpubProgressGetResult>;
  set: (payload: EpubProgressSetRequest) => Promise<EpubProgressSetResult>;
}

export interface RendererApi {
  ping: () => Promise<PingResponse>;
  books: RendererBooksApi;
  notes: RendererNotesApi;
  highlights: RendererHighlightsApi;
  bookmarks: RendererBookmarksApi;
  export: RendererExportApi;
  epubProgress: RendererEpubProgressApi;
  getLastPage: (payload: ProgressGetLastPageRequest) => Promise<number | null>;
  setLastPage: (payload: ProgressSetLastPageRequest) => Promise<void>;
}

declare global {
  interface Window {
    api?: RendererApi;
  }
}

export {};
