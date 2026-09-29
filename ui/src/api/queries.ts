import type { Endpoint, PaginationData, RequestInput, Schemas } from "@mm/lib";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type { ZodObject, ZodType } from "zod";

import { endpointKey, infiniteEndpointKey } from "./keys";
import { apiCall } from "./queryClient";

type Paginated = { pagination: PaginationData };

type PaginatedSchemas = Schemas & { query: ZodObject; response: ZodType<Paginated> };

export const endpointQuery = <S extends Schemas>(endpoint: Endpoint<S>, input: RequestInput<S>) =>
  queryOptions({
    queryKey: endpointKey(endpoint, input),
    queryFn: ({ signal }) => apiCall(endpoint, input, { signal })
  });

export const endpointInfiniteQuery = <S extends PaginatedSchemas>(endpoint: Endpoint<S>, input: RequestInput<S>) =>
  infiniteQueryOptions({
    queryKey: infiniteEndpointKey(endpoint, input),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const page = { ...input, query: { ...input.query, cursor: pageParam } };
      return apiCall(endpoint, page, { signal });
    },
    getNextPageParam: (lastPage: Paginated) => (lastPage.pagination.hasNext ? lastPage.pagination.cursor : undefined)
  });
