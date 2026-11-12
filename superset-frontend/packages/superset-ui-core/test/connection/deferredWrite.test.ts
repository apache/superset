/*
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
  deferredWriteMessage,
  isDeferredWrite,
} from '@superset-ui/core/connection';

const jsonResponse = (status: number) => ({
  json: { message: 'Held for review.' },
  response: new Response(null, { status }),
});

test('a 202 is an acknowledgement, not a result', () => {
  expect(isDeferredWrite(jsonResponse(202))).toBe(true);
});

test('a 200 write really did apply', () => {
  expect(isDeferredWrite(jsonResponse(200))).toBe(false);
});

test('other successful statuses are not deferrals', () => {
  [201, 204, 304].forEach(status => {
    expect(isDeferredWrite(jsonResponse(status))).toBe(false);
  });
});

test('a bare Response is accepted as well as a parsed pair', () => {
  expect(isDeferredWrite(new Response(null, { status: 202 }))).toBe(true);
  expect(isDeferredWrite(new Response(null, { status: 200 }))).toBe(false);
});

test('a missing response is not a deferral', () => {
  // A caller that resolved to nothing has not been told a write was held, and
  // treating silence as a deferral would stop it applying a real result.
  expect(isDeferredWrite(undefined)).toBe(false);
  expect(isDeferredWrite(null)).toBe(false);
  expect(isDeferredWrite({})).toBe(false);
});

test("the server's own sentence is preferred over the fallback", () => {
  expect(deferredWriteMessage({ message: 'Held for review.' }, 'Saved.')).toBe(
    'Held for review.',
  );
});

test('the fallback covers a server that deferred without saying why', () => {
  expect(deferredWriteMessage({}, 'Saved.')).toBe('Saved.');
  expect(deferredWriteMessage(undefined, 'Saved.')).toBe('Saved.');
  expect(deferredWriteMessage({ message: '' }, 'Saved.')).toBe('Saved.');
  expect(deferredWriteMessage({ message: 42 } as never, 'Saved.')).toBe(
    'Saved.',
  );
});
