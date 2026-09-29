import type { Route } from "@mm/lib/api";
import { getCurrentUser } from "@mm/lib/auth";

type KeyedEndpoint = { id: string; parent?: Route };

export const routeKey = (route: Route) => route.fullPath.split("/").filter(Boolean);

const parentKey = (endpoint: KeyedEndpoint) => (endpoint.parent ? routeKey(endpoint.parent) : []);

export const endpointKey = (endpoint: KeyedEndpoint, input: object) => [...parentKey(endpoint), endpoint.id, input];

export const infiniteEndpointKey = (endpoint: KeyedEndpoint, input: object) => [...parentKey(endpoint), endpoint.id, "infinite", input];

export const sessionKey = endpointKey(getCurrentUser, {});
