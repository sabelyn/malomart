import type { Context, Handler } from "aws-lambda";

export const invoke = <E, R>(handler: Handler<E, R>, event: unknown) =>
  handler(event as E, {} as Context, () => undefined) as Promise<R>;

export const awsError = (name: string) => Object.assign(new Error(name), { name });
