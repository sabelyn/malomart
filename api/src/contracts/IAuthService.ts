export type AuthTokens = {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
};

export type PendingAuth = {
  email: string;
  session: string;
};

export interface IAuthService {
  confirmSignUp: (email: string, code: string, session?: string) => Promise<AuthTokens | undefined>;
  refresh: (refreshToken: string) => Promise<AuthTokens>;
  signOut: (refreshToken: string) => Promise<void>;
  signUp: (email: string, name: string) => Promise<PendingAuth | undefined>;
  startSignIn: (email: string) => Promise<PendingAuth>;
  verifySignIn: (pending: PendingAuth, code: string) => Promise<AuthTokens>;
}
