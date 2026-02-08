export const IPC_CHANNELS = {
  ping: 'app:ping',
  authSignUp: 'auth:sign-up',
  authSignIn: 'auth:sign-in',
  authGetCurrentUser: 'auth:get-current-user',
  authSignOut: 'auth:sign-out'
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

export type AuthError = { ok: false; error: string };
export type AuthResult = { ok: true; token: string; user: User } | AuthError;
export type GetCurrentUserResult = { ok: true; user: User } | AuthError;
export type SignOutResult = { ok: true } | AuthError;

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

export interface RendererAuthApi {
  signUp: (payload: SignUpRequest) => Promise<AuthResult>;
  signIn: (payload: SignInRequest) => Promise<AuthResult>;
  getCurrentUser: (payload: GetCurrentUserRequest) => Promise<GetCurrentUserResult>;
  signOut: (payload: SignOutRequest) => Promise<SignOutResult>;
}

export interface RendererApi {
  ping: () => Promise<PingResponse>;
  auth: RendererAuthApi;
}

declare global {
  interface Window {
    api?: RendererApi;
  }
}

export {};
