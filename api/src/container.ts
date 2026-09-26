import { dbClient, s3Client } from "@mm/clients";
import { container } from "tsyringe";

import * as tokens from "@/contracts/tokens";

export const registerDependencies = () => {
  container.registerInstance(tokens.DB, dbClient());
  container.registerInstance(tokens.S3, s3Client());
}
