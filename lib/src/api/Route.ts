import type { Path, RouteAccess, Tag } from "./types";

export class Route {
  readonly children = new Set<Route>();
  readonly expressPath: string;
  readonly fullPath: string;
  readonly tags: Set<Tag>;

  constructor(
    public readonly path: Path,
    public readonly access: RouteAccess = "user",
    tags: Tag[] = [],
    public readonly parent?: Route
  ) {
    this.tags = new Set(tags);

    let segments = [this.path];
    let route = parent;
    while (route) {
      segments.unshift(route.path);
      route.tags.forEach(t => this.tags.add(t));
      route = route.parent;
    }
    this.fullPath = segments.join("").replace(/\/{2,}/g, "/").replace(/\/$/, "");

    if (this.path.includes("{")) {
      this.expressPath = this.path.replace(/\{([^}]+)\}/g, ":$1");
    } else {
      this.expressPath = this.path;
    }

    parent?.addRoute(this);
  }

  addRoute = (route: Route) => {
    this.children.add(route);
  }
}
