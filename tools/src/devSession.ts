import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  DescribeUserPoolClientCommand,
  InitiateAuthCommand,
  UsernameExistsException
} from "@aws-sdk/client-cognito-identity-provider";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient, TableNames } from "@mm/clients/db";
import { auth, SessionCookie } from "@mm/lib/auth";
import { createHmac, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const usage = `Usage:
  pnpm dev:session [options]
    Signs a dedicated test user into the Dev user pool, creating it first if needed, and writes the
    session cookies to local/dev-session.json as Playwright storage state for http://localhost.
    The user's password is replaced with a random one on every run and is never stored.
    --customer        Use a customer account instead of an admin account.
    --help            Show this message.`;

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUTPUTS_FILE = path.join(ROOT, "local/cdk-outputs.json");
const SESSION_FILE = path.join(ROOT, "local/dev-session.json");
const REFRESH_TTL_S = 30 * 24 * 60 * 60;

const ADMIN_GROUP = "admin";
const CUSTOMER_GROUP = "customer";

const accounts = {
  admin: { email: "dev-admin@example.com", name: "Dev Admin", groups: [CUSTOMER_GROUP, ADMIN_GROUP] },
  customer: { email: "dev-customer@example.com", name: "Dev Customer", groups: [CUSTOMER_GROUP] }
};
type Account = (typeof accounts)[keyof typeof accounts];

const cognito = new CognitoIdentityProviderClient({});
const db = dbClient();

const loadOutputs = async () => {
  let outputs: Record<string, Record<string, string>>;
  try {
    outputs = JSON.parse(await readFile(OUTPUTS_FILE, "utf8"));
  } catch (err) {
    throw new Error(`Could not read ${OUTPUTS_FILE}. Run "pnpm deploy:dev" first.`, { cause: err });
  }

  const authOutputs = outputs["Dev-MaloMartAuthStack"];
  if (!authOutputs?.UserPoolId || !authOutputs.UserPoolClientId) {
    throw new Error(`No user pool outputs for Dev-MaloMartAuthStack in ${OUTPUTS_FILE}. Run "pnpm deploy:dev".`);
  }
  const tableNames = outputs["Dev-MaloMartDbStack"]?.TableNames;
  if (!tableNames) {
    throw new Error(`No table names for Dev-MaloMartDbStack in ${OUTPUTS_FILE}. Run "pnpm deploy:dev".`);
  }
  return {
    userPoolId: authOutputs.UserPoolId,
    clientId: authOutputs.UserPoolClientId,
    tables: TableNames.parse(JSON.parse(tableNames))
  };
};

const ensureUser = async (UserPoolId: string, customersTable: string, { email, name, groups }: Account) => {
  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId,
        Username: email,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: name }
        ]
      })
    );
    console.log(`Created ${email}.`);
  } catch (err) {
    if (!(err instanceof UsernameExistsException)) throw err;
  }

  const { UserAttributes } = await cognito.send(new AdminGetUserCommand({ UserPoolId, Username: email }));
  const sub = UserAttributes?.find(attr => attr.Name === "sub")?.Value;
  if (!sub) {
    throw new Error(`Cognito returned no sub for ${email}.`);
  }

  await Promise.all(
    groups.map(GroupName => cognito.send(new AdminAddUserToGroupCommand({ UserPoolId, Username: email, GroupName })))
  );

  try {
    await db.send(
      new PutCommand({
        TableName: customersTable,
        Item: { id: sub },
        ConditionExpression: "attribute_not_exists(id)"
      })
    );
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err;
  }
};

const signIn = async (UserPoolId: string, ClientId: string, email: string) => {
  const Password = `${randomBytes(24).toString("base64url")}Aa1!`;
  await cognito.send(new AdminSetUserPasswordCommand({ UserPoolId, Username: email, Password, Permanent: true }));

  const { UserPoolClient } = await cognito.send(new DescribeUserPoolClientCommand({ UserPoolId, ClientId }));
  if (!UserPoolClient?.ClientSecret) {
    throw new Error("The user pool client has no secret.");
  }
  const SECRET_HASH = createHmac("sha256", UserPoolClient.ClientSecret)
    .update(email + ClientId)
    .digest("base64");

  const { AuthenticationResult } = await cognito.send(
    new InitiateAuthCommand({
      ClientId,
      AuthFlow: "USER_AUTH",
      AuthParameters: { USERNAME: email, PASSWORD: Password, PREFERRED_CHALLENGE: "PASSWORD", SECRET_HASH }
    })
  );
  const { AccessToken, ExpiresIn, RefreshToken } = AuthenticationResult ?? {};
  if (!AccessToken || !ExpiresIn || !RefreshToken) {
    throw new Error("Cognito did not return a complete set of tokens.");
  }
  return { AccessToken, ExpiresIn, RefreshToken };
};

const cookie = (name: string, value: string, cookiePath: string, expires: number) => ({
  name,
  value,
  domain: "localhost",
  path: cookiePath,
  expires,
  httpOnly: true,
  secure: true,
  sameSite: "Strict"
});

const main = async () => {
  const { values: args } = parseArgs({
    options: {
      customer: { type: "boolean", default: false },
      help: { type: "boolean", default: false }
    }
  });
  if (args.help) {
    console.log(usage);
    return;
  }

  const account = args.customer ? accounts.customer : accounts.admin;
  const { userPoolId, clientId, tables } = await loadOutputs();

  await ensureUser(userPoolId, tables.customers, account);
  const { AccessToken, ExpiresIn, RefreshToken } = await signIn(userPoolId, clientId, account.email);

  const now = Math.floor(Date.now() / 1000);
  const state = {
    cookies: [
      cookie(SessionCookie.Access, AccessToken, "/", now + ExpiresIn),
      cookie(SessionCookie.Refresh, RefreshToken, auth.fullPath, now + REFRESH_TTL_S)
    ],
    origins: []
  };
  await writeFile(SESSION_FILE, JSON.stringify(state, null, 2));
  console.log(`Signed in as ${account.email}. Wrote ${SESSION_FILE}.`);
};

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
