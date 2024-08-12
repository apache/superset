/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import 'whatwg-fetch'; // for adding Response polyfill
import {
  JsonObject,
  SupersetApiError,
  SupersetApiErrorType,
} from '@superset-ui/core';
import handleError, {
  ErrorInput,
} from '../../../../src/query/api/v1/handleError';

async function testHandleError(
  inputError: ErrorInput,
  expected: string | JsonObject,
): Promise<SupersetApiError> {
  try {
    await handleError(inputError);
  } catch (error) {
    const typedError = error as SupersetApiError;
    expect(typedError).toBeInstanceOf(SupersetApiError);
    if (typeof expected === 'string') {
      expect(typedError.message).toContain(expected);
    } else {
      expect(typedError).toEqual(expect.objectContaining(expected));
    }
    return error;
  }
  return new SupersetApiError({ message: 'Where is the error?' });
}

describe('handleError()', () => {
  it('should throw error directly', async () => {
    expect.assertions(3);
    const input = new SupersetApiError({ message: 'timeout' });
    const output = await testHandleError(input, 'timeout');
    expect(input).toBe(output);
  });

  it('should handle error string', async () => {
    expect.assertions(2);
    await testHandleError('STOP', 'STOP');
  });

  it('should handle HTTP error', async () => {
    expect.assertions(2);
    const mockResponse = new Response('Ha?', {
      status: 404,
      statusText: 'NOT FOUND',
    });
    await testHandleError(mockResponse, '404 NOT FOUND');
  });

  it('should handle HTTP error with status < 400', async () => {
    expect.assertions(2);
    const mockResponse = new Response('Ha haha?', {
      status: 302,
      statusText: 'Found',
    });
    await testHandleError(mockResponse, '302 Found');
  });

  it('should use message from HTTP error', async () => {
    expect.assertions(2);
    const mockResponse = new Response('{ "message": "BAD BAD" }', {
      status: 500,
      statusText: 'Server Error',
    });
    await testHandleError(mockResponse, 'BAD BAD');
  });

  it('should handle response of single error', async () => {
    expect.assertions(2);
    const mockResponse = new Response(
      '{ "error": "BAD BAD", "link": "https://superset.apache.org" }',
      {
        status: 403,
        statusText: 'Access Denied',
      },
    );
    await testHandleError(mockResponse, {
      message: 'BAD BAD',
      extra: { link: 'https://superset.apache.org' },
    });
  });

  it('should handle single error object', async () => {
    expect.assertions(2);
    const mockError = {
      error: {
        message: 'Request timeout',
        error_type: SupersetApiErrorType.FrontendTimeoutError,
      },
    };
    await testHandleError(mockError, {
      message: 'Request timeout',
      errorType: 'FRONTEND_TIMEOUT_ERROR',
    });
  });

  it('should process multi errors in HTTP json', async () => {
    expect.assertions(2);
    const mockResponse = new Response(
      '{ "errors": [{ "error_type": "NOT OK" }] }',
      {
        status: 403,
        statusText: 'Access Denied',
      },
    );
    await testHandleError(mockResponse, 'NOT OK');
  });

  it('should handle invalid multi errors', async () => {
    expect.assertions(4);
    const mockResponse1 = new Response('{ "errors": [] }', {
      status: 403,
      statusText: 'Access Denied',
    });
    const mockResponse2 = new Response('{ "errors": null }', {
      status: 400,
      statusText: 'Bad Request',
    });
    await testHandleError(mockResponse1, '403 Access Denied');
    await testHandleError(mockResponse2, '400 Bad Request');
  });

  it('should fallback to statusText', async () => {
    expect.assertions(2);
    const mockResponse = new Response('{ "failed": "random ramble" }', {
      status: 403,
      statusText: 'Access Denied',
    });
    await testHandleError(mockResponse, '403 Access Denied');
  });

  it('should handle regular JS error', async () => {
    expect.assertions(4);
    await testHandleError(new Error('What?'), 'What?');
    const emptyError = new Error();
    emptyError.stack = undefined;
    await testHandleError(emptyError, 'Unknown Error');
  });

  it('should handle { error: ... }', async () => {
    expect.assertions(2);
    await testHandleError({ error: 'Hmm' }, 'Hmm');
  });

  it('should throw unknown error', async () => {
    expect.assertions(4);
    await testHandleError(
      Promise.resolve('Some random things') as never,
      'Unknown Error',
    );
    await testHandleError(undefined as never, 'Unknown Error');
  });
});
