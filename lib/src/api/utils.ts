import type { ZodObject, ZodType } from "zod";
import type { ZodOpenApiResponsesObject, ZodOpenApiOperationObject, ZodOpenApiPathItemObject, ZodOpenApiPathsObject, ZodOpenApiResponseObject } from "zod-openapi";

import { ErrorResponse } from "./types";
import type { HttpMethod, StatusCode } from "./types";
import type { Route } from "./Route";
import type { AnyEndpoint } from "./Endpoint";
import { collectEndpoints } from "./walk";

export const requestBody = (schema: ZodType) => ({
  required: true,
  content: { "application/json": { schema } }
});

export const requestParams = (path?: ZodObject, query?: ZodObject) => ({
  ...(path ? { path } : {}),
  ...(query ? { query } : {})
});

export const response = (description?: string, schema?: ZodType): ZodOpenApiResponseObject => ({
  ...(description ? { description } : {}),
  ...(schema ? { content: { "application/json": { schema } } } : {})
});

export const error = (description: string) => response(description, ErrorResponse);

export const commonErrors = {
  429: error("Too many requests. The API is throttling this client."),
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
  for (const endpoint of collectEndpoints(route)) {
    const item: ZodOpenApiPathItemObject = (paths[endpoint.fullPath] ??= {});
    item[endpoint.method.toLowerCase() as Lowercase<HttpMethod>] = toOperation(endpoint);
  }
  return paths;
}

const toOperation = (endpoint: AnyEndpoint) => {
  const op: ZodOpenApiOperationObject = {
    operationId: endpoint.id,
    summary: endpoint.summary,
    description: endpoint.description,
    tags: [...endpoint.tags],
    responses: {}
  };

  const { body, params, query } = endpoint.schemas;
  if (params || query) {
    op.requestParams = requestParams(params, query);
  }
  if (body) {
    op.requestBody = requestBody(body);
  }

  let responses: ZodOpenApiResponsesObject = {
    [endpoint.successStatus]: response(endpoint.successDescription, endpoint.schemas.response)
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
