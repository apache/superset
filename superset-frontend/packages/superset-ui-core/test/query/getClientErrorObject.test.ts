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
import {
  COMMON_ERR_MESSAGES,
  getClientErrorMessage,
  getClientErrorObject,
  getErrorText,
  parseErrorJson,
  ErrorTypeEnum,
} from '@superset-ui/core';

test('Returns a Promise', () => {
  const response = getClientErrorObject('error');
  expect(response instanceof Promise).toBe(true);
});

test('Returns a Promise that resolves to an object with an error key', async () => {
  const error = 'error';

  const errorObj = await getClientErrorObject(error);
  expect(errorObj).toMatchObject({ error });
});

test('should handle HTML response with "500" or "server error"', async () => {
  const htmlString500 = '<div>500: Internal Server Error</div>';
  const clientErrorObject500 = await getClientErrorObject(htmlString500);
  expect(clientErrorObject500).toEqual({ error: 'Server error' });

  const htmlStringServerError = '<div>Server error message</div>';
  const clientErrorObjectServerError = await getClientErrorObject(
    htmlStringServerError,
  );
  expect(clientErrorObjectServerError).toEqual({
    error: 'Server error',
  });
});

test('should handle HTML response with "404" or "not found"', async () => {
  const htmlString404 = '<div>404: Page not found</div>';
  const clientErrorObject404 = await getClientErrorObject(htmlString404);
  expect(clientErrorObject404).toEqual({ error: 'Not found' });

  const htmlStringNotFoundError = '<div>Not found message</div>';
  const clientErrorObjectNotFoundError = await getClientErrorObject(
    htmlStringNotFoundError,
  );
  expect(clientErrorObjectNotFoundError).toEqual({
    error: 'Not found',
  });
});

test('should handle HTML response without common error code', async () => {
  const htmlString = '<!doctype html><div>Foo bar Lorem Ipsum</div>';
  const clientErrorObject = await getClientErrorObject(htmlString);
  expect(clientErrorObject).toEqual({ error: 'Unknown error' });

  const htmlString2 = '<div><p>An error occurred</p></div>';
  const clientErrorObject2 = await getClientErrorObject(htmlString2);
  expect(clientErrorObject2).toEqual({
    error: 'Unknown error',
  });
});

test('Handles Response that can be parsed as json', async () => {
  const jsonError = { something: 'something', error: 'Error message' };
  const jsonErrorString = JSON.stringify(jsonError);

  const errorObj = await getClientErrorObject(new Response(jsonErrorString));
  expect(errorObj).toMatchObject(jsonError);
});

test('Handles backwards compatibility between old error messages and the new SIP-40 errors format', async () => {
  const jsonError = {
    errors: [
      {
        error_type: ErrorTypeEnum.GENERIC_DB_ENGINE_ERROR,
        extra: { engine: 'presto', link: 'https://www.google.com' },
        level: 'error',
        message: 'presto error: test error',
      },
    ],
  };
  const jsonErrorString = JSON.stringify(jsonError);

  const errorObj = await getClientErrorObject(new Response(jsonErrorString));
  expect(errorObj.error).toEqual(jsonError.errors[0].message);
  expect(errorObj.link).toEqual(jsonError.errors[0].extra.link);
});

test('Handles Response that can be parsed as text', async () => {
  const textError = 'Hello I am a text error';

  const errorObj = await getClientErrorObject(new Response(textError));
  expect(errorObj).toMatchObject({ error: textError });
});

test('Handles Response that contains raw html be parsed as text', async () => {
  const textError = 'Hello I am a text error';

  const errorObj = await getClientErrorObject(new Response(textError));
  expect(errorObj).toMatchObject({ error: textError });
});

test('Handles TypeError Response', async () => {
  const error = new TypeError('Failed to fetch');

  // @ts-ignore
  const errorObj = await getClientErrorObject(error);
  expect(errorObj).toMatchObject({ error: 'Network error' });
});

test('Handles timeout error', async () => {
  const errorObj = await getClientErrorObject({
    timeout: 1000,
    statusText: 'timeout',
  });
  expect(errorObj).toMatchObject({
    timeout: 1000,
    statusText: 'timeout',
    error: 'Request timed out',
    errors: [
      {
        error_type: ErrorTypeEnum.FRONTEND_TIMEOUT_ERROR,
        extra: {
          timeout: 1,
          issue_codes: [
            {
              code: 1000,
              message: 'Issue 1000 - The dataset is too large to query.',
            },
            {
              code: 1001,
              message: 'Issue 1001 - The database is under an unusual load.',
            },
          ],
        },
        level: 'error',
        message: 'Request timed out',
      },
    ],
  });
});

test('Handles plain text as input', async () => {
  const error = 'error';

  const errorObj = await getClientErrorObject(error);
  expect(errorObj).toMatchObject({ error });
});

test('Handles error with status code', async () => {
  const status500 = new Response(null, { status: 500 });
  const status404 = new Response(null, { status: 404 });
  const status502 = new Response(null, { status: 502 });

  expect(await getClientErrorObject(status500)).toMatchObject({
    error: 'Server error',
  });
  expect(await getClientErrorObject(status404)).toMatchObject({
    error: 'Not found',
  });
  expect(await getClientErrorObject(status502)).toMatchObject({
    error: 'Bad gateway',
  });
});

test('Handles error with status text and message', async () => {
  const statusText = 'status';
  const message = 'message';

  // @ts-ignore
  expect(await getClientErrorObject({ statusText, message })).toMatchObject({
    error: statusText,
  });
  // @ts-ignore
  expect(await getClientErrorObject({ message })).toMatchObject({
    error: message,
  });
  // @ts-ignore
  expect(await getClientErrorObject({})).toMatchObject({
    error: 'An error occurred',
  });
});

test('getClientErrorMessage', () => {
  expect(getClientErrorMessage('error')).toEqual('error');
  expect(
    getClientErrorMessage('error', {
      error: 'client error',
      message: 'client error message',
    }),
  ).toEqual('error:\nclient error message');
  expect(
    getClientErrorMessage('error', {
      error: 'client error',
    }),
  ).toEqual('error:\nclient error');
});

test('parseErrorJson with message', () => {
  expect(parseErrorJson({ message: 'error message' })).toEqual({
    message: 'error message',
    error: 'error message',
  });

  expect(
    parseErrorJson({
      message: {
        key1: ['error message1', 'error message2'],
        key2: ['error message3', 'error message4'],
      },
    }),
  ).toEqual({
    message: {
      key1: ['error message1', 'error message2'],
      key2: ['error message3', 'error message4'],
    },
    error: 'error message1',
  });

  expect(
    parseErrorJson({
      message: {},
    }),
  ).toEqual({
    message: {},
    error: 'Invalid input',
  });
});

test('parseErrorJson with HTML message', () => {
  expect(
    parseErrorJson({
      message: '<div>error message</div>',
    }),
  ).toEqual({
    message: '<div>error message</div>',
    error: 'Unknown error',
  });
  expect(
    parseErrorJson({
      message: '<div>Server error</div>',
    }),
  ).toEqual({
    message: '<div>Server error</div>',
    error: 'Server error',
  });
});

test('parseErrorJson with HTML message and status code', () => {
  expect(
    parseErrorJson({
      status: 502,
      message: '<div>error message</div>',
    }),
  ).toEqual({
    status: 502,
    message: '<div>error message</div>',
    error: 'Bad gateway',
  });
  expect(
    parseErrorJson({
      status: 999,
      message: '<div>Server error</div>',
    }),
  ).toEqual({
    status: 999,
    message: '<div>Server error</div>',
    error: 'Server error',
  });
});

test('parseErrorJson with stacktrace', () => {
  expect(
    parseErrorJson({ error: 'error message', stack: 'stacktrace' }),
  ).toEqual({
    error: 'Unexpected error: (no description, click to see stack trace)',
    stacktrace: 'stacktrace',
    stack: 'stacktrace',
  });

  expect(
    parseErrorJson({
      error: 'error message',
      description: 'error description',
      stack: 'stacktrace',
    }),
  ).toEqual({
    error: 'Unexpected error: error description',
    stacktrace: 'stacktrace',
    description: 'error description',
    stack: 'stacktrace',
  });
});

test('parseErrorJson with CSRF', () => {
  expect(
    parseErrorJson({
      responseText: 'CSRF',
    }),
  ).toEqual({
    error: COMMON_ERR_MESSAGES.SESSION_TIMED_OUT,
    responseText: 'CSRF',
  });
});

test('getErrorText', async () => {
  expect(await getErrorText('error', 'dashboard')).toEqual(
    'Sorry, there was an error saving this dashboard: error',
  );

  const error = JSON.stringify({ message: 'Forbidden' });
  expect(await getErrorText(new Response(error), 'dashboard')).toEqual(
    'You do not have permission to edit this dashboard',
  );
  expect(
    await getErrorText(
      new Response(JSON.stringify({ status: 'error' })),
      'dashboard',
    ),
  ).toEqual('Sorry, an unknown error occurred.');
});
