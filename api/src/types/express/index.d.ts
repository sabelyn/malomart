import type { DependencyContainer } from "tsyringe";

import type { User } from "../user";

export {};

declare global {
  namespace Express {
    export interface Request {
      container: DependencyContainer;
      user?: User;
    }
  }
}
