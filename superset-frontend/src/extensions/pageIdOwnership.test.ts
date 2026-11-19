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

import { assertPageIdIsOwned } from './ExtensionsLoader';
import { PAGE_LOCATION } from '../core/views';

// The only surviving defence against one extension claiming another's page.
// The manifest carried a server-side rule for this and the manifest is gone,
// so this guard is now load-bearing on its own.

test('a page id carrying the extension id is accepted', () => {
  expect(() =>
    assertPageIdIsOwned('acme.tools', 'acme.tools.review-queue', PAGE_LOCATION),
  ).not.toThrow();
});

test('a page id belonging to another extension is refused', () => {
  expect(() =>
    assertPageIdIsOwned('acme.tools', 'other.ext.review-queue', PAGE_LOCATION),
  ).toThrow(/must begin with the extension's own id/);
});

test('the error names both the extension and the id it tried to claim', () => {
  // An author reads this in a console with no stack worth following, so it
  // has to say which extension and which id without further digging.
  expect(() =>
    assertPageIdIsOwned('acme.tools', 'other.ext.queue', PAGE_LOCATION),
  ).toThrow(/"acme.tools".*"other.ext.queue"/s);
});

test('a missing id is refused rather than passed through', () => {
  expect(() =>
    assertPageIdIsOwned('acme.tools', undefined, PAGE_LOCATION),
  ).toThrow(/<missing>/);
});

test('the extension id alone, with no page part, is refused', () => {
  // `acme.tools` does not start with `acme.tools.` -- the separator matters,
  // or an extension could register the bare id and own the namespace.
  expect(() =>
    assertPageIdIsOwned('acme.tools', 'acme.tools', PAGE_LOCATION),
  ).toThrow();
});

test('a prefix that only looks like the id is refused', () => {
  // `acme.toolsmith.x` shares a textual prefix with `acme.tools` but is a
  // different extension. The trailing dot is what rules it out.
  expect(() =>
    assertPageIdIsOwned('acme.tools', 'acme.toolsmith.x', PAGE_LOCATION),
  ).toThrow();
});

test('a view at any other location is not an extension page', () => {
  // Ownership is a rule about page ids, because the host forms a page's
  // address from its id. Other locations have no address to collide on.
  expect(() =>
    assertPageIdIsOwned('acme.tools', 'anything.at.all', 'sqllab.editor'),
  ).not.toThrow();
});

describe('an id that cannot be one path segment', () => {
  // The host serves every page from `/extensions/pages/:pageId`, which
  // matches a single segment. These register happily, take a navbar entry,
  // and then the route never matches — so the page renders not-found for
  // ever with nothing to say why.
  test.each(['/', '?', '#', '%'])('rejects %p after the prefix', char => {
    expect(() =>
      assertPageIdIsOwned(
        'acme.tools',
        `acme.tools.queue${char}x`,
        PAGE_LOCATION,
      ),
    ).toThrow(/one path segment/);
  });

  test('the message names the character that is wrong', () => {
    expect(() =>
      assertPageIdIsOwned(
        'acme.tools',
        'acme.tools.review/queue',
        PAGE_LOCATION,
      ),
    ).toThrow(/contains "\/"/);
  });

  test('a dotted id is still fine', () => {
    // Dots are what page ids are made of; only the characters that break
    // the route are refused.
    expect(() =>
      assertPageIdIsOwned(
        'acme.tools',
        'acme.tools.review.queue',
        PAGE_LOCATION,
      ),
    ).not.toThrow();
  });

  test('a hyphen or underscore is still fine', () => {
    expect(() =>
      assertPageIdIsOwned(
        'acme.tools',
        'acme.tools.review-queue_v2',
        PAGE_LOCATION,
      ),
    ).not.toThrow();
  });
});
