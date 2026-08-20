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
import { Actions } from 'src/constants';
import { handleUserError } from './utils';

test('shows the password validation message from a 400 response', async () => {
  const error = new Response(
    JSON.stringify({
      message: {
        password: ['Password must be at least 8 characters long.'],
      },
    }),
    { status: 400 },
  );
  const addDangerToast = jest.fn();

  await expect(
    handleUserError(error, Actions.CREATE, addDangerToast),
  ).rejects.toBe(error);
  expect(addDangerToast).toHaveBeenCalledWith(
    'Password must be at least 8 characters long.',
  );
});

test('shows a plain string message from a 400 response', async () => {
  const error = new Response(
    JSON.stringify({ message: 'User must have at least one role or group!' }),
    { status: 400 },
  );
  const addDangerToast = jest.fn();

  await expect(
    handleUserError(error, Actions.UPDATE, addDangerToast),
  ).rejects.toBe(error);
  expect(addDangerToast).toHaveBeenCalledWith(
    'User must have at least one role or group!',
  );
});

test('keeps the duplicate username message for a 422 response', async () => {
  const error = new Response(
    JSON.stringify({
      message:
        'duplicate key value violates unique constraint "ab_user_username_key"',
    }),
    { status: 422 },
  );
  const addDangerToast = jest.fn();

  await expect(
    handleUserError(error, Actions.CREATE, addDangerToast),
  ).rejects.toBe(error);
  expect(addDangerToast).toHaveBeenCalledWith(
    'This username is already taken. Please choose another one.',
  );
});

test('shows the generic message when a 422 response has no message', async () => {
  const error = new Response(JSON.stringify({ foo: 'bar' }), { status: 422 });
  const addDangerToast = jest.fn();

  await expect(
    handleUserError(error, Actions.CREATE, addDangerToast),
  ).rejects.toBe(error);
  expect(addDangerToast).toHaveBeenCalledWith(
    'There was an error creating the user. Please, try again.',
  );
});

test('shows the generic message when a 400 response is not JSON', async () => {
  const error = new Response('<html>Bad request</html>', {
    status: 400,
    headers: { 'Content-Type': 'text/html' },
  });
  const addDangerToast = jest.fn();

  await expect(
    handleUserError(error, Actions.CREATE, addDangerToast),
  ).rejects.toBe(error);
  expect(addDangerToast).toHaveBeenCalledWith(
    'There was an error creating the user. Please, try again.',
  );
});
