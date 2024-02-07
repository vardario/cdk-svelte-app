import { test, describe } from 'vitest';
import path from 'node:path';
import { createSvelteServerHandler } from '../svelte-server-handler.js';
import { createAwsProxyEvent } from './test-utils.js';

describe('svelte-server-handler', () => {
  test('createSvelteServerHandler', async () => {
    const handler = await createSvelteServerHandler(path.resolve(__dirname, '../../example/svelte-app/build/server'));
    const rootResponse = await handler(createAwsProxyEvent('/', 'GET'));
    console.log(rootResponse.statusCode);
  });
});
