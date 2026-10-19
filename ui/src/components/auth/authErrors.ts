import { ApiRequestError, ErrorCode } from "@mm/lib/api";

import { alerts } from "@/copy";

export const authErrorMessage = (error: unknown) => {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case ErrorCode.InvalidCode:
        return alerts.auth.invalidCode;
      case ErrorCode.ExpiredCode:
        return alerts.auth.expiredCode;
      case ErrorCode.RateLimited:
        return alerts.auth.rateLimited;
      case ErrorCode.AccountExists:
        return alerts.auth.accountExists;
    }
    if (error.status === 401) {
      return alerts.auth.sessionTimedOut;
    }
  }
  return alerts.auth.failed;
};
