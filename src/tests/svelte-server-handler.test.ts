import { test, describe, expect } from 'vitest';
import path from 'node:path';
import { createSvelteServerHandler } from '../svelte-server-handler.js';
import { createAwsProxyEvent } from './test-utils.js';
//import formDataToString from 'formdata-to-string';

describe('svelte-server-handler', () => {
  test('createSvelteServerHandler', async () => {
    const handler = createSvelteServerHandler(
      path.resolve(__dirname, '../../example/svelte-app/.svelte-kit/output/server')
    );

    const pages = ['/', '/about', '/sverdle', '/sverdle/how-to-play'];

    for (const page of pages) {
      const preRenderedResponse = await handler(createAwsProxyEvent(page, 'GET'));
      expect(preRenderedResponse.statusCode).toBe(200);
      expect(preRenderedResponse.headers?.['content-type']).toBe('text/html');
    }

    //TODO: Get this working
    // const formData = new FormData();
    // formData.append('guess', 'e');
    // formData.append('guess', 'e');
    // formData.append('guess', 'e');
    // formData.append('guess', 'e');

    // const formDataBody = await formDataToString(formData);
    // const [boundary] = formDataBody.split('\n');
    // const formServerAction = await handler(
    //   createAwsProxyEvent('/sverdle?/enter', 'POST', {
    //     body: formDataBody,
    //     headers: {
    //       'content-type': `multipart/form-data; boundary=${boundary}`,
    //       'content-length': formDataBody.length.toString(),
    //       origin: 'https://localhost'
    //     }
    //   })
    // );
  });
});
