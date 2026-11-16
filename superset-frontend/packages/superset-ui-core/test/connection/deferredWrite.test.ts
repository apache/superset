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
  json: { deferred: true, message: 'Held for review.' },
  response: new Response(null, { status }),
});

test('a 202 marked as deferred is an acknowledgement, not a result', () => {
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

test('a 202 from ordinary async work is not a deferral', () => {
  // The ones Superset already answers 202 for: a queued permission sync, a
  // global async chart query, a screenshot or thumbnail, async SQL Lab. The
  // work is running and its result is coming, so nothing was held -- and
  // without the marker each of these would be read as a held write, with an
  // unrelated `id` taken out of the body as the reference to it.
  const asyncJobs = [
    { json: { job_id: 'abc', status: 'pending' } },
    { json: { channel_id: 'c1', job_id: 'j1', status: 'running' } },
    { json: { message: 'OK' } },
    { json: {} },
  ];
  asyncJobs.forEach(job => {
    expect(
      isDeferredWrite({ ...job, response: new Response(null, { status: 202 }) }),
    ).toBe(false);
  });
});

test('an unwrapped body is read as well as a parsed pair', () => {
  // A caller that already took `json` out still gets an answer, which is why
  // the host's loosely typed write handlers need no casts.
  expect(isDeferredWrite({ status: 202, deferred: true })).toBe(true);
  expect(isDeferredWrite({ status: 202 })).toBe(false);
});

test('a bare Response cannot be a deferral', () => {
  // It carries no parsed body, so it cannot say it held anything -- and a
  // write held without a word about why is not one a client can report.
  expect(isDeferredWrite(new Response(null, { status: 202 }))).toBe(false);
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
