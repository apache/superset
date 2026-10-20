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

import React from 'react';
import { logging } from '@apache-superset/core/utils';
import {
  findPageByPath,
  getPages,
  pagePath,
  registerPageFor,
  resolvePage,
} from './index';

const disposables: Array<{ dispose: () => void }> = [];
const Component = () => React.createElement('div', null, 'page');

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
});

test('the host derives the URL from the extension, not the extension', () => {
  // The extension supplies only a slug. If it could supply a path it could
  // claim the host's URLs, or another extension's.
  disposables.push(
    registerPageFor('acme.tools', { slug: 'queue', name: 'Queue' }, Component),
  );

  expect(getPages()).toEqual([
    {
      slug: 'queue',
      name: 'Queue',
      extensionId: 'acme.tools',
      path: '/extensions/acme.tools/queue',
    },
  ]);
});

test('two extensions may use the same slug without colliding', () => {
  // Namespacing is what makes this safe; without it one would replace the
  // other and the loser would simply stop rendering.
  disposables.push(
    registerPageFor('acme.tools', { slug: 'queue', name: 'A' }, Component),
    registerPageFor('other.ext', { slug: 'queue', name: 'B' }, Component),
  );

  expect(getPages().map(p => p.path)).toEqual([
    '/extensions/acme.tools/queue',
    '/extensions/other.ext/queue',
  ]);
});

test.each([
  ['a path rather than a slug', '/queue'],
  ['a nested path', 'queue/42'],
  ['an attempt to escape the namespace', '../../login'],
  ['uppercase', 'Queue'],
  ['empty', ''],
  ['a leading hyphen', '-queue'],
])('a slug that is %s is refused', (_label, slug) => {
  expect(() =>
    registerPageFor('acme.tools', { slug, name: 'X' }, Component),
  ).toThrow(/must be lowercase letters/);
  expect(getPages()).toEqual([]);
});

test('re-registering a slug within one extension replaces it, and says so', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  try {
    disposables.push(
      registerPageFor('acme.tools', { slug: 'queue', name: 'First' }, Component),
      registerPageFor('acme.tools', { slug: 'queue', name: 'Second' }, Component),
    );

    expect(getPages().map(p => p.name)).toEqual(['Second']);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('acme.tools.queue'),
    );
  } finally {
    warn.mockRestore();
  }
});

test('disposing a replaced registration leaves the replacement alone', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  try {
    const first = registerPageFor(
      'acme.tools',
      { slug: 'queue', name: 'First' },
      Component,
    );
    disposables.push(
      registerPageFor('acme.tools', { slug: 'queue', name: 'Second' }, Component),
    );

    first.dispose();

    expect(getPages().map(p => p.name)).toEqual(['Second']);
  } finally {
    warn.mockRestore();
  }
});

test('a path is matched by prefix, so deep links reach their page', () => {
  // The server serves `<path:rest>` under the page, so the client has to
  // resolve the same way or a deep link would render "not found".
  disposables.push(
    registerPageFor('acme.tools', { slug: 'queue', name: 'Queue' }, Component),
  );

  expect(findPageByPath('/extensions/acme.tools/queue')?.slug).toBe('queue');
  expect(findPageByPath('/extensions/acme.tools/queue/42/edit')?.slug).toBe(
    'queue',
  );
});

test('a path no extension claims matches nothing', () => {
  disposables.push(
    registerPageFor('acme.tools', { slug: 'queue', name: 'Queue' }, Component),
  );

  expect(findPageByPath('/extensions/acme.tools/nonexistent')).toBeUndefined();
  expect(findPageByPath('/extensions/nobody.nothing/x')).toBeUndefined();
  // A sibling slug sharing a prefix must not be swallowed.
  expect(findPageByPath('/extensions/acme.tools/queue-archive')).toBeUndefined();
});

test('resolvePage falls back to a placeholder for an unknown id', () => {
  expect(resolvePage('acme.tools.missing')).toBeTruthy();
});

test('pagePath is the single definition of the namespace', () => {
  expect(pagePath('acme.tools', 'queue')).toBe('/extensions/acme.tools/queue');
});
