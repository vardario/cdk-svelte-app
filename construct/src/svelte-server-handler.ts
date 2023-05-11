import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Server } from "./server.js";
import { manifest } from "./server/manifest.js";

const server = new Server(manifest);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  return {
    statusCode: 200,
    body: "hello",
  };
};
