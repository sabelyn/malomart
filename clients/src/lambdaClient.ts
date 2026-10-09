import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { InvokeErrorResponse } from "@mm/lib/lambdas";
import { output, strictObject, string, infer as zinfer, ZodType } from "zod";

export const InvokeFunctionNames = strictObject({
  deleteCard: string().nonempty(),
  describeCard: string().nonempty(),
  updateCard: string().nonempty()
});
export type InvokeFunctionNames = zinfer<typeof InvokeFunctionNames>;

let baseClient: LambdaClient;
export const lambdaClient = () => {
  baseClient ??= new LambdaClient({});
  return baseClient;
};

type OutputOrNull<T extends ZodType | null> = T extends null ? null : output<T>;
export const invoke = async <TInput, TOutputSchema extends ZodType | null>(
  client: LambdaClient,
  functionName: string,
  input: TInput,
  outputSchema: TOutputSchema
): Promise<OutputOrNull<TOutputSchema> | InvokeErrorResponse> => {
  const { Payload, FunctionError } = await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify(input)
    })
  );
  const payload = Payload ? JSON.parse(Buffer.from(Payload).toString()) : undefined;

  if (outputSchema === null && !payload) {
    return null as OutputOrNull<TOutputSchema>;
  }
  if (FunctionError) {
    throw new Error(`Unexpected error while invoking ${functionName}.`, { cause: payload });
  }

  const parsed = outputSchema ? outputSchema.safeParse(payload) : null;
  if (parsed?.success) {
    return parsed.data as OutputOrNull<TOutputSchema>;
  } else {
    const errorName = (payload as InvokeErrorResponse)?.errorName;
    if (errorName) {
      return { errorName };
    }
    throw new Error(`Invalid response returned from invoking ${functionName}.`, { cause: parsed?.error });
  }
};

export const invokeAsync = (client: LambdaClient, functionName: string, input: unknown) =>
  client.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "Event",
      Payload: input ? JSON.stringify(input) : undefined
    })
  );
