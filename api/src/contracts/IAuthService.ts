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
  confirmEmailChange: (accessToken: string, code: string) => Promise<void>;
  confirmSignUp: (email: string, code: string, session?: string) => Promise<AuthTokens | undefined>;
  deleteUser: (accessToken: string) => Promise<void>;
  refresh: (refreshToken: string) => Promise<AuthTokens>;
  requestEmailChange: (accessToken: string, email: string) => Promise<void>;
  signOut: (refreshToken: string) => Promise<void>;
  signOutEverywhere: (accessToken: string) => Promise<void>;
  signUp: (email: string, name: string) => Promise<PendingAuth | undefined>;
  startSignIn: (email: string) => Promise<PendingAuth>;
  updateName: (accessToken: string, name: string) => Promise<void>;
  verifySignIn: (pending: PendingAuth, code: string) => Promise<AuthTokens>;
}
