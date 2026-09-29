import { getCurrentUser, signOut } from "@mm/lib/auth";
import type { CurrentUser } from "@mm/lib/auth";
import type { Query } from "@tanstack/react-query";
import { hashKey, queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";

import { isUnauthorized } from "./client";
import { sessionKey } from "./keys";
import { useEndpointMutation } from "./mutations";
import { apiCall } from "./queryClient";

const SESSION_STALE_MS = 5 * 60_000;

const sessionHash = hashKey(sessionKey);

const isNotSession = (query: Query) => query.queryHash !== sessionHash;

export const sessionQuery = queryOptions({
  queryKey: sessionKey,
  queryFn: async ({ signal }) => {
    try {
      return await apiCall(getCurrentUser, {}, { signal });
    } catch (err) {
      if (isUnauthorized(err)) {
        return null;
      }
      throw err;
    }
  },
  staleTime: SESSION_STALE_MS,
  retry: false
});

export const useSession = () => useQuery(sessionQuery);

export const useSetSession = () => {
  const queryClient = useQueryClient();
  return (user: CurrentUser | null) => queryClient.setQueryData(sessionQuery.queryKey, user);
};

type SignOutOptions = {
  onSignedOut?: () => void;
};

export const useSignOut = ({ onSignedOut }: SignOutOptions = {}) => {
  const queryClient = useQueryClient();

  return useEndpointMutation(signOut, {
    onSuccess: () => {
      onSignedOut?.();
      queryClient.setQueryData(sessionQuery.queryKey, null);
      queryClient.removeQueries({ type: "inactive", predicate: isNotSession });
      void queryClient.invalidateQueries({ predicate: isNotSession });
    }
  });
};
