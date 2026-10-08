import { Endpoint } from "../api/Endpoint";
import { Route } from "../api/Route";
import { CreatePaymentMethodBody } from "./requests";
import { CreatePaymentMethodResponse } from "./responses";

export const lambdaRoot = new Route("/api", "user", ["Lambda"]);

export const tokenizeCard = new Endpoint(lambdaRoot, {
  description: "Retrieve a token that represents a saved payment method.",
  errors: {
    400: "Request body is invalid."
  },
  id: "tokenizeCard",
  method: "POST",
  path: "/tokenize",
  schemas: {
    body: CreatePaymentMethodBody,
    response: CreatePaymentMethodResponse
  },
  successDescription: "The randomly-generated token for the payment method.",
  successStatus: "201",
  summary: "Tokenize a Card"
});
