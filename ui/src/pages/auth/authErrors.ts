import { ApiRequestError, ErrorCode } from "@mm/lib/api";

export const SESSION_TIMED_OUT = "That took too long. Start over.";

export const authErrorMessage = (error: unknown) => {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case ErrorCode.InvalidCode:
        return "Wrong code. Check your email and try again.";
      case ErrorCode.ExpiredCode:
        return "That code expired. Get a new one.";
      case ErrorCode.RateLimited:
        return "Too many tries. Wait a few minutes.";
      case ErrorCode.AccountExists:
        return "There's already an account for that email.";
    }
    if (error.status === 401) {
      return SESSION_TIMED_OUT;
    }
  }
  return "Something broke. Try again.";
};
