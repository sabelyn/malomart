import type { AnyEndpoint } from "./Endpoint";
import { Endpoint } from "./Endpoint";
import type { Route } from "./Route";

export const collectEndpoints = (route: Route): AnyEndpoint[] => {
  const endpoints: AnyEndpoint[] = [];
  const visit = (r: Route) => {
    if (r instanceof Endpoint) {
      endpoints.push(r);
    }
    r.children.forEach(visit);
  };
  visit(route);
  return endpoints;
};
