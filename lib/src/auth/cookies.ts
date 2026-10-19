export const SessionCookie = {
  Access: "__Host-mm_at",
  OAuth: "__Host-mm_oauth",
  Pending: "__Host-mm_auth",
  Refresh: "__Secure-mm_rt"
} as const;
export type SessionCookie = (typeof SessionCookie)[keyof typeof SessionCookie];
