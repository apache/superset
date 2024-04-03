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

it('Returns a Promise', () => {
  const response = getClientErrorObject('error');
  expect(response instanceof Promise).toBe(true);
});

it('Returns a Promise that resolves to an object with an error key', async () => {
  const error = 'error';

  const errorObj = await getClientErrorObject(error);
  expect(errorObj).toMatchObject({ error });
});

it('Handles Response that can be parsed as json', async () => {
  const jsonError = { something: 'something', error: 'Error message' };
  const jsonErrorString = JSON.stringify(jsonError);

  const errorObj = await getClientErrorObject(new Response(jsonErrorString));
  expect(errorObj).toMatchObject(jsonError);
});

it('Handles backwards compatibility between old error messages and the new SIP-40 errors format', async () => {
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

it('Handles Response that can be parsed as text', async () => {
  const textError = 'Hello I am a text error';

  const errorObj = await getClientErrorObject(new Response(textError));
  expect(errorObj).toMatchObject({ error: textError });
});

it('Handles TypeError Response', async () => {
  const error = new TypeError('Failed to fetch');

  // @ts-ignore
  const errorObj = await getClientErrorObject(error);
  expect(errorObj).toMatchObject({ error: 'Network error' });
});

it('Handles timeout error', async () => {
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

it('Handles plain text as input', async () => {
  const error = 'error';

  const errorObj = await getClientErrorObject(error);
  expect(errorObj).toMatchObject({ error });
});

it('Handles error with status text and message', async () => {
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

it('getClientErrorMessage', () => {
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

it('parseErrorJson with message', () => {
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

it('parseErrorJson with stacktrace', () => {
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

it('parseErrorJson with CSRF', () => {
  expect(
    parseErrorJson({
      responseText: 'CSRF',
    }),
  ).toEqual({
    error: COMMON_ERR_MESSAGES.SESSION_TIMED_OUT,
    responseText: 'CSRF',
  });
});

it('getErrorText', async () => {
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
