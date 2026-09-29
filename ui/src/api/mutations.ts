import type { Endpoint, RequestInput, ResponseOutput, Route, Schemas } from "@mm/lib";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { routeKey } from "./keys";
import { apiCall } from "./queryClient";

export type EndpointMutationOptions<S extends Schemas> = Omit<
  UseMutationOptions<ResponseOutput<S>, Error, RequestInput<S>>,
  "mutationFn"
> & {
  invalidates?: Route[];
};

export const useEndpointMutation = <S extends Schemas>(
  endpoint: Endpoint<S>,
  { invalidates = [], onSuccess, ...options }: EndpointMutationOptions<S> = {}
) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: (input: RequestInput<S>) => apiCall(endpoint, input),
    onSuccess: async (...args) => {
      await Promise.all(invalidates.map(route => queryClient.invalidateQueries({ queryKey: routeKey(route) })));
      return onSuccess?.(...args);
    }
  });
};
