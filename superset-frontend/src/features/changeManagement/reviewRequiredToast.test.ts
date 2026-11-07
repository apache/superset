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
/**
 * @fileoverview The one sentence that tells an author their write was HELD.
 *
 * A test leak, found by a sweep of this suite. `reviewRequiredToast` is on
 * every surface where a captured write has no banner of its own -- a modal
 * over a list, a dashboard action, the version-history menu, and now the
 * delete paths too -- and it had no test of any kind. Its own comment said
 * "the behaviour as it stands is what the tests pin", and `display.test.ts`
 * never imported it.
 *
 * What it must not lose: the server's own sentence, the route to the queue,
 * and the longer duration -- the default four seconds is not long enough to
 * reach a link. Its fallback matters most of all, because a captured write
 * that reads as a completed save is the author believing their change is
 * live when nobody has reviewed it.
 */

import { reviewRequiredToast } from './display';

const SERVER_SAID =
  'Delete saved as a draft. Nothing has been removed. Request review when you are ready.';

test('it carries the server sentence through unchanged', () => {
  const { text } = reviewRequiredToast(SERVER_SAID, 9);

  expect(text).toContain(SERVER_SAID);
});

test('and the route to the step the author still owes', () => {
  const { text } = reviewRequiredToast(SERVER_SAID, 9);

  expect(text).toContain('href="/approvals/submitted-by-me"');
  expect(text).toContain('Review changes');
});

test('long enough on screen to reach that link', () => {
  // The default is four seconds. A toast carrying a link the author is meant
  // to click cannot use it.
  const { options } = reviewRequiredToast(SERVER_SAID, 9);

  expect(options.allowHtml).toBe(true);
  expect(options.duration).toBeGreaterThanOrEqual(10000);
});

test('with no server sentence it still says the change is not live', () => {
  // The fallback, and the reason this file exists. Shortened to "Changes
  // saved." this reads as an ordinary completed save, and the author walks
  // away believing a change nobody has reviewed is in front of viewers.
  const { text } = reviewRequiredToast(undefined, 9);

  expect(text).toContain('Viewers still see the live version');
  expect(text).toContain('/approvals/submitted-by-me');
});

test('a server sentence containing markup is escaped, not rendered', () => {
  // `allowHtml` is on, so anything interpolated into this string is live
  // markup in the author's browser.
  const { text } = reviewRequiredToast(
    '<img src=x onerror="alert(1)"> saved',
    9,
  );

  expect(text).not.toContain('<img');
  expect(text).toContain('&lt;img');
  // The anchor this function adds itself is still a real anchor.
  expect(text).toContain('<a href="/approvals/submitted-by-me">');
});
