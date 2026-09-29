import type { CallOptions, Endpoint, RequestInput, ResponseOutput, Schemas } from "@mm/lib/api";
import { ApiRequestError, call } from "@mm/lib/api";
import { confirmSignUp, refreshSession, signIn, signOut, signUp, verifySignIn } from "@mm/lib/auth";

export type ApiCallerOptions = Pick<CallOptions, "baseUrl" | "fetch" | "validateResponse"> & {
  onSessionExpired?: () => void;
};

export type RequestOptions = Pick<CallOptions, "signal">;

const NO_REFRESH = new Set([confirmSignUp, refreshSession, signIn, signOut, signUp, verifySignIn].map(endpoint => endpoint.id));

export const isUnauthorized = (err: unknown) => err instanceof ApiRequestError && err.status === 401;

export const createApiCaller = ({ onSessionExpired, ...defaults }: ApiCallerOptions = {}) => {
  let refreshing: Promise<boolean> | undefined;

  const refresh = () =>
    (refreshing ??= call(refreshSession, {}, defaults)
      .then(
        () => true,
        () => false
      )
      .finally(() => {
        refreshing = undefined;
      }));

  return async <S extends Schemas>(endpoint: Endpoint<S>, input: RequestInput<S>, options?: RequestOptions): Promise<ResponseOutput<S>> => {
    const send = () => call(endpoint, input, { ...defaults, ...options });

    try {
      return await send();
    } catch (err) {
      if (!isUnauthorized(err) || NO_REFRESH.has(endpoint.id)) {
        throw err;
      }
      if (!(await refresh())) {
        onSessionExpired?.();
        throw err;
      }
      return send();
    }
  };
};
