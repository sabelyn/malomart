import { createHash, randomBytes } from "node:crypto";

const randomToken = () => randomBytes(32).toString("base64url");

export const createPkce = () => {
  const verifier = randomToken();
  return {
    state: randomToken(),
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url")
  };
};
