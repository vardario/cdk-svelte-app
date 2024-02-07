import { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import path from 'node:path';
import type { Server } from 'server';
import { installPolyfills } from '@sveltejs/kit/node/polyfills';

installPolyfills();

export type Handler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>;

export function createSvelteServerHandler(serverDir: string): Handler {
  return async event => {
    const { Server } = await import(path.resolve(serverDir, 'index.js'));
    const { manifest } = await import(path.resolve(serverDir, 'manifest-full.js'));
    const server = new Server(manifest) as Server;
    await server.init({ env: process.env });

    const origin = event.headers.origin || `https://${event.requestContext.domainName}`;

    const encoding = event.isBase64Encoded ? 'base64' : 'utf-8';
    const body = event.body ? Buffer.from(event.body, encoding) : undefined;
    const queryString = event.rawQueryString ? `?${event.rawQueryString}` : undefined;
    const url = `${origin}${event.requestContext.http.path}${queryString ?? ''}`;

    if (event.cookies) {
      event.headers['cookie'] = event.cookies.join('; ');
    }

    const req = new Request(url, {
      method: event.requestContext.http.method,
      headers: new Headers((event.headers as Record<string, string>) || {}),
      body
    });

    const response = await server.respond(req, {
      platform: { req },
      getClientAddress() {
        return event.requestContext.http.sourceIp;
      }
    });

    const headers: Record<string, string> = {};

    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      statusCode: response.status,
      body: await response.text(),
      headers
    };
  };
}

export const handler: APIGatewayProxyHandlerV2 = createSvelteServerHandler('./server');
