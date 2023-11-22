import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { Server } from './server/index.js';
import { manifest } from './server/manifest-full.js';
import { installPolyfills } from '@sveltejs/kit/node/polyfills';

installPolyfills();

const server = new Server(manifest);
await server.init({ env: process.env });

export const handler: APIGatewayProxyHandlerV2 = async event => {
  const origin = event.headers.origin || `https://${event.requestContext.domainName}`;

  const encoding = event.isBase64Encoded ? 'base64' : 'utf-8';
  const body = event.body ? Buffer.from(event.body, encoding) : undefined;
  const queryString = event.rawQueryString ? `?${event.rawQueryString}` : undefined;
  let url = `${origin}${event.requestContext.http.path}`;

  if (queryString) {
    url += queryString;
  }

  if (event.cookies) {
    event.headers['cookie'] = event.cookies.join('; ');
  }

  const response = await server.respond(
    new Request(url, {
      method: event.requestContext.http.method,
      headers: new Headers((event.headers as Record<string, string>) || {}),
      body
    }),
    {
      getClientAddress() {
        return event.requestContext.http.sourceIp;
      }
    }
  );

  const headers: Record<string, string> = {};

  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  if (response.status >= 300 && response.status <= 399) {
    headers['cache-control'] = 'no-cache';
  }

  return {
    statusCode: response.status,
    body: await response.text(),
    headers
  };
};
