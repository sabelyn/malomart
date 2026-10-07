import { dbClient } from "@mm/clients";
import { SessionCookie } from "@mm/lib";
import type { CognitoJwtVerifier } from "aws-jwt-verify";
import type { Request, Response } from "express";
import { container } from "tsyringe";

import { DB, USER } from "@/contracts/tokens";
import env from "@/env";
import { identity } from "@/middleware/identity";
import { clearTable, putItems } from "../../helpers/db";
import { cacheTestJwks, signJwt } from "../../helpers/jwt";

const captured = vi.hoisted(() => ({ verifiers: [] as unknown[] }));

vi.mock("aws-jwt-verify", async importOriginal => {
  const actual = await importOriginal<typeof import("aws-jwt-verify")>();
  return {
    ...actual,
    CognitoJwtVerifier: {
      create: (...args: Parameters<typeof actual.CognitoJwtVerifier.create>) => {
        const verifier = actual.CognitoJwtVerifier.create(...args);
        captured.verifiers.push(verifier);
        return verifier;
      }
    }
  };
});

const CustomersTable = env.TABLE_NAMES.customers;
const db = dbClient();
const res = {} as Response;

let customerId: string;

const authenticate = async () => {
  const req = { cookies: { [SessionCookie.Access]: signJwt({ sub: customerId }) } } as unknown as Request;
  await identity(req, res, vi.fn());
  return req;
};

beforeAll(() => {
  cacheTestJwks(captured.verifiers[0] as ReturnType<typeof CognitoJwtVerifier.create>);
});

beforeEach(async () => {
  customerId = crypto.randomUUID();
  container.registerInstance(DB, db);
  await clearTable(db, CustomersTable, ["id"]);
});

describe("identity", () => {
  it("loads the stored customer data onto the user", async () => {
    const customerData = { defaultAddressId: crypto.randomUUID(), defaultPaymentMethodId: crypto.randomUUID() };
    await putItems(db, CustomersTable, [{ id: customerId, ...customerData }]);

    const req = await authenticate();

    expect(req.user).toEqual({
      id: customerId,
      email: "user@example.com",
      name: "Regular User",
      isAdmin: false,
      customerData
    });
    expect(req.container.resolve(USER)).toBe(req.user);
  });

  it("uses empty customer data when the customer has no record", async () => {
    await putItems(db, CustomersTable, [{ id: crypto.randomUUID(), defaultAddressId: crypto.randomUUID() }]);

    const req = await authenticate();

    expect(req.user?.customerData).toEqual({});
  });
});
