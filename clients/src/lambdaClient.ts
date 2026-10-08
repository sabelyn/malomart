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
  const endpoint = process.env.AWS_ENDPOINT_URL;
  baseClient ??= new LambdaClient(endpoint ? { endpoint } : {});
  return baseClient;
};

export const invoke = async <TInput, TOutputSchema extends ZodType>(
  client: LambdaClient,
  functionName: string,
  input: TInput,
  outputSchema: TOutputSchema
): Promise<output<TOutputSchema> | InvokeErrorResponse> => {
  const { Payload, FunctionError } = await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify(input)
    })
  );
  const payload = Payload ? JSON.parse(Buffer.from(Payload).toString()) : undefined;

  if (FunctionError) {
    throw new Error(`Unexpected error while invoking ${functionName}.`, { cause: payload });
  }

  const parsed = outputSchema.safeParse(payload);
  if (parsed.success) {
    return parsed.data;
  } else {
    const errorName = (payload as InvokeErrorResponse)?.errorName;
    if (errorName) {
      return { errorName };
    }
    throw new Error(`Invalid response returned from invoking ${functionName}.`, { cause: parsed.error });
  }
};
