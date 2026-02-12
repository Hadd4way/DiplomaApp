export const IPC_CHANNELS = {
  ping: 'app:ping',
  authSignUp: 'auth:sign-up',
  authSignIn: 'auth:sign-in',
  authGetCurrentUser: 'auth:get-current-user',
  authSignOut: 'auth:sign-out',
  booksList: 'books:list',
  booksAddSample: 'books:add-sample',
  booksImport: 'books:import',
  booksReveal: 'books:reveal',
  booksDelete: 'books:delete',
  booksGetPdfData: 'books:get-pdf-data',
  notesCreate: 'notes:create',
  notesList: 'notes:list',
  notesDelete: 'notes:delete',
  notesUpdate: 'notes:update',
  highlightsList: 'highlights:list',
  highlightsCreateMerged: 'highlights:create-merged',
  highlightsDelete: 'highlights:delete',
  highlightsInsertRaw: 'highlights:insert-raw',
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

export type User = {
  id: string;
  email: string;
  displayName: string;
  createdAt: number;
};

export type BookFormat = 'pdf' | 'epub';

export type Book = {
  id: string;
  userId: string;
  title: string;
  author?: string | null;
  format: BookFormat;
  filePath?: string | null;
  createdAt: number;
};

export type Note = {
  id: string;
  userId: string;
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
  userId: string;
  bookId: string;
  page: number;
  rects: HighlightRect[];
  createdAt: number;
  updatedAt: number;
};

export type AuthError = { ok: false; error: string };
export type AuthResult = { ok: true; token: string; user: User } | AuthError;
export type GetCurrentUserResult = { ok: true; user: User } | AuthError;
export type SignOutResult = { ok: true } | AuthError;
export type BooksListResult = { ok: true; books: Book[] } | AuthError;
export type BooksAddSampleResult = { ok: true; book: Book } | AuthError;
export type BooksImportResult = { ok: true; book: Book } | AuthError;
export type BooksRevealResult = { ok: true } | AuthError;
export type BooksDeleteResult = { ok: true } | AuthError;
export type BooksGetPdfDataResult = { ok: true; base64: string; title: string } | AuthError;
export type NotesCreateResult = { ok: true; note: Note } | AuthError;
export type NotesListResult = { ok: true; notes: Note[] } | AuthError;
export type NotesDeleteResult = { ok: true } | AuthError;
export type NotesUpdateResult = { ok: true; note: Note } | AuthError;
export type HighlightsListResult = { ok: true; highlights: Highlight[] } | AuthError;
export type HighlightsCreateMergedResult = { ok: true; highlight: Highlight } | AuthError;
export type HighlightsDeleteResult = { ok: true } | AuthError;
export type HighlightsInsertRawResult = { ok: true; highlight: Highlight } | AuthError;

export type SignUpRequest = {
  email: string;
  password: string;
  displayName: string;
};

export type SignInRequest = {
  email: string;
  password: string;
};

export type GetCurrentUserRequest = {
  token: string;
};

export type SignOutRequest = {
  token: string;
};

export type BooksListRequest = {
  token: string;
};

export type BooksAddSampleRequest = {
  token: string;
};

export type BooksImportRequest = {
  token: string;
};

export type BooksRevealRequest = {
  token: string;
  bookId: string;
};

export type BooksDeleteRequest = {
  token: string;
  bookId: string;
};

export type BooksGetPdfDataRequest = {
  token: string;
  bookId: string;
};

export type NotesCreateRequest = {
  token: string;
  bookId: string;
  page: number;
  content: string;
};

export type NotesListRequest = {
  token: string;
  bookId?: string | null;
  q?: string | null;
};

export type NotesDeleteRequest = {
  token: string;
  noteId: string;
};

export type NotesUpdateRequest = {
  token: string;
  noteId: string;
  content: string;
};

export type HighlightsListRequest = {
  token: string;
  bookId: string;
  page: number;
};

export type HighlightsCreateMergedRequest = {
  token: string;
  bookId: string;
  page: number;
  rects: HighlightRect[];
};

export type HighlightsDeleteRequest = {
  token: string;
  highlightId: string;
};

export type HighlightsInsertRawRequest = {
  token: string;
  bookId: string;
  page: number;
  rects: HighlightRect[];
};

export type ProgressGetLastPageRequest = {
  userId: string;
  bookId: string;
};

export type ProgressSetLastPageRequest = {
  userId: string;
  bookId: string;
  lastPage: number;
};

export interface RendererAuthApi {
  signUp: (payload: SignUpRequest) => Promise<AuthResult>;
  signIn: (payload: SignInRequest) => Promise<AuthResult>;
  getCurrentUser: (payload: GetCurrentUserRequest) => Promise<GetCurrentUserResult>;
  signOut: (payload: SignOutRequest) => Promise<SignOutResult>;
}

export interface RendererBooksApi {
  list: (payload: BooksListRequest) => Promise<BooksListResult>;
  addSample: (payload: BooksAddSampleRequest) => Promise<BooksAddSampleResult>;
  import: (payload: BooksImportRequest) => Promise<BooksImportResult>;
  reveal: (payload: BooksRevealRequest) => Promise<BooksRevealResult>;
  delete: (payload: BooksDeleteRequest) => Promise<BooksDeleteResult>;
  getPdfData: (payload: BooksGetPdfDataRequest) => Promise<BooksGetPdfDataResult>;
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

export interface RendererApi {
  ping: () => Promise<PingResponse>;
  auth: RendererAuthApi;
  books: RendererBooksApi;
  notes: RendererNotesApi;
  highlights: RendererHighlightsApi;
  getLastPage: (userId: string, bookId: string) => Promise<number | null>;
  setLastPage: (userId: string, bookId: string, lastPage: number) => Promise<void>;
}

declare global {
  interface Window {
    api?: RendererApi;
  }
}

export {};
