import type { ZodType } from "zod";
import type { ZodOpenApiResponsesObject, ZodOpenApiOperationObject, ZodOpenApiPathItemObject, ZodOpenApiPathsObject, ZodOpenApiResponseObject } from "zod-openapi";

import { ErrorResponse } from "./types";
import type { HttpMethod, StatusCode, Body, Params, Query } from "./types";
import type { Route } from "./Route";
import { Endpoint } from "./Endpoint";

export const requestBody = (schema: ZodType) => ({
  required: true,
  content: { "application/json": { schema } }
});

export const requestParams = (path?: Params, query?: Query) => ({
  ...(path ? { path } : {}),
  ...(query ? { query } : {})
});

export const response = (description?: string, schema?: ZodType): ZodOpenApiResponseObject => ({
  ...(description ? { description } : {}),
  ...(schema ? { content: { "application/json": { schema } } } : {})
});

export const error = (description: string) => response(description, ErrorResponse);

export const commonErrors = {
  500: error("Something unexpected happened while handling the request."),
  503: error("Downstream service is busy or unavailable.")
};

export const commonProtectedErrors = {
  ...commonErrors,
  401: error("Authorization is required but invalid or not present.")
};

export const commonAdminErrors = {
  ...commonProtectedErrors,
  403: error("Authenticated user does not have admin permissions.")
};

export const routeToPaths = (route: Route) => {
  const paths: ZodOpenApiPathsObject = {};
  for (const r of route.children) {
    if (r instanceof Endpoint) {
      const item: ZodOpenApiPathItemObject = (paths[r.fullPath] ??= {});
      item[r.method.toLowerCase() as Lowercase<HttpMethod>] = toOperation(r);
    } else if (r.children.size > 0) {
      const nestedPaths = routeToPaths(r);
      for (const [path, item] of Object.entries(nestedPaths)) {
        paths[path] = item;
      }
    }
  }

  return paths;
}

const toOperation = (endpoint: Endpoint<Body, Params, Query, Body>) => {
  const op: ZodOpenApiOperationObject = {
    operationId: endpoint.id,
    summary: endpoint.summary,
    description: endpoint.description,
    tags: [...endpoint.tags],
    responses: {}
  };

  if (endpoint.paramsSchema || endpoint.querySchema) {
    op.requestParams = requestParams(endpoint.paramsSchema, endpoint.querySchema);
  }
  if (endpoint.bodySchema) {
    op.requestBody = requestBody(endpoint.bodySchema);
  }

  let responses: ZodOpenApiResponsesObject = {
    [endpoint.successStatus]: response(endpoint.successDescription, endpoint.responseSchema)
  };
  for (const [status, message] of Object.entries(endpoint.errors)) {
    responses[status as StatusCode] = error(message);
  }
  switch (endpoint.access) {
    case "admin":
      responses = { ...commonAdminErrors, ...responses };
      break;
    case "user":
      responses = { ...commonProtectedErrors, ...responses };
      break;
    default:
      responses = { ...commonErrors, ...responses };
  }

  op.responses = responses;
  return op;
};
