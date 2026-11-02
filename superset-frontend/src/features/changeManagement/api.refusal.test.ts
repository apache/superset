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

/**
 * @fileoverview Reading the server's reason off a refused action (R4-04).
 *
 * Every refusal the workflow raises carries a sentence written for the
 * person reading it. SupersetClient rejects with the Response rather than an
 * Error holding that body, so reading `message` straight off the rejection
 * found nothing and the reviewer was shown a generic failure instead of the
 * one line that told them what to do next.
 */
import { refusalMessage } from './api';

const STALE =
  'This change was updated after you opened it. Review the new version before approving.';

const refusal = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('a conflict answers with the sentence the server wrote', async () => {
  expect(await refusalMessage(refusal(409, { message: STALE }))).toBe(STALE);
});

test('the body wins over the status', async () => {
  // For a status it recognises the parser can answer the status text, which
  // turns this refusal into the bare word "Conflict".
  const message = await refusalMessage(refusal(409, { message: STALE }));

  expect(message).not.toBe('Conflict');
});

test('an error that carries its own message is used as it is', async () => {
  expect(await refusalMessage(new Error(STALE))).toBe(STALE);
});

test('a refusal with nothing to say answers null', async () => {
  expect(await refusalMessage(refusal(500, {}))).toBeNull();
});

test('an unreadable rejection answers null rather than throwing', async () => {
  // Null, so the caller's own wording stands. A shape the parser cannot
  // read at all is left to it: whatever generic line it returns is no worse
  // than the one the caller would have used instead.
  expect(await refusalMessage(undefined)).toBeNull();
});

test('a blank message is not mistaken for a reason', async () => {
  expect(await refusalMessage(refusal(409, { message: '   ' }))).toBeNull();
});
