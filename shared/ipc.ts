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
  booksDelete: 'books:delete'
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

export type AuthError = { ok: false; error: string };
export type AuthResult = { ok: true; token: string; user: User } | AuthError;
export type GetCurrentUserResult = { ok: true; user: User } | AuthError;
export type SignOutResult = { ok: true } | AuthError;
export type BooksListResult = { ok: true; books: Book[] } | AuthError;
export type BooksAddSampleResult = { ok: true; book: Book } | AuthError;
export type BooksImportResult = { ok: true; book: Book } | AuthError;
export type BooksRevealResult = { ok: true } | AuthError;
export type BooksDeleteResult = { ok: true } | AuthError;

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
}

export interface RendererApi {
  ping: () => Promise<PingResponse>;
  auth: RendererAuthApi;
  books: RendererBooksApi;
}

declare global {
  interface Window {
    api?: RendererApi;
  }
}

export {};
