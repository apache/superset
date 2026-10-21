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
import ExtensionPlaceholder from 'src/extensions/ExtensionPlaceholder';
import {
  findPageByPath,
  getPages,
  registerPageFor,
  resolvePage,
} from './index';

const disposables: Array<{ dispose: () => void }> = [];
const Component = () => React.createElement('div', null, 'page');

/** The manifest declaration the loader would have bound for these tests. */
const DECLARED = [
  { path: '/review-queue' },
  { path: '/review-queue-archive' },
  { path: '/a/b' },
];

const register = (
  extensionId: string,
  page: { path: string; name: string },
  declared: readonly { path: string; permitted?: boolean }[] = DECLARED,
) => registerPageFor(extensionId, declared, page, Component);

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
});

test('a declared page registers at the path it declared', () => {
  disposables.push(
    register('acme.tools', { path: '/review-queue', name: 'Queue' }),
  );

  expect(getPages()).toEqual([
    {
      path: '/review-queue',
      name: 'Queue',
      extensionId: 'acme.tools',
      permitted: true,
    },
  ]);
});

test('a path the manifest does not declare is refused', () => {
  // The server registers URL rules from the manifest, so a component
  // registered against an undeclared path would work on client navigation
  // and 404 on a cold load. Refusing here keeps the halves in agreement.
  const error = jest.spyOn(logging, 'error').mockImplementation(() => {});
  try {
    register('acme.tools', { path: '/welcome', name: 'X' });

    expect(getPages()).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('manifest does not declare'),
    );
  } finally {
    error.mockRestore();
  }
});

test('refusing a page does not throw, so one page cannot kill the bundle', () => {
  // `registerPage` is called at module scope, so a throw here would take
  // down the extension's other pages, its views and its commands too.
  const error = jest.spyOn(logging, 'error').mockImplementation(() => {});
  try {
    expect(() =>
      register('acme.tools', { path: '/welcome', name: 'X' }),
    ).not.toThrow();

    // The returned Disposable is inert rather than absent, so an extension
    // that pushes it into a subscription list does not then crash on dispose.
    const inert = register('acme.tools', { path: '/welcome', name: 'X' });
    expect(() => inert.dispose()).not.toThrow();
  } finally {
    error.mockRestore();
  }
});

test('a page the server refused says so, not that the author got it wrong', () => {
  // The path was taken by Superset or another extension. Nothing in the
  // extension's own source shows that, so the message has to point outward.
  const error = jest.spyOn(logging, 'error').mockImplementation(() => {});
  try {
    register('acme.tools', { path: '/review-queue', name: 'X' }, [
      { path: '/review-queue', registered: false },
    ]);

    expect(getPages()).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('this deployment already serves'),
    );
  } finally {
    error.mockRestore();
  }
});

test('the refusal names what was declared, so the fix is obvious', () => {
  const error = jest.spyOn(logging, 'error').mockImplementation(() => {});
  try {
    register('acme.tools', { path: '/welcome', name: 'X' }, [
      { path: '/review-queue' },
    ]);

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Declared: /review-queue'),
    );
  } finally {
    error.mockRestore();
  }
});

test('an extension with no declared pages can register none', () => {
  const error = jest.spyOn(logging, 'error').mockImplementation(() => {});
  try {
    register('acme.tools', { path: '/review-queue', name: 'X' }, []);

    expect(getPages()).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Declared: (none)'),
    );
  } finally {
    error.mockRestore();
  }
});

test.each([
  ['relative', 'review-queue'],
  ['an attempt to climb out', '/../login'],
  ['a trailing slash', '/review-queue/'],
  ['uppercase', '/Review-Queue'],
  ['empty', ''],
  ['a route parameter', '/review-queue/:id'],
  ['a leading hyphen', '/-queue'],
])('a path that is %s is refused', (_label, path) => {
  // Checked before the manifest list, so a malformed path is reported as
  // malformed even when it somehow appears in the manifest.
  const error = jest.spyOn(logging, 'error').mockImplementation(() => {});
  try {
    register('acme.tools', { path, name: 'X' }, [{ path }]);

    expect(getPages()).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('not an absolute path'),
    );
  } finally {
    error.mockRestore();
  }
});

test('a multi-segment path is allowed', () => {
  disposables.push(register('acme.tools', { path: '/a/b', name: 'Nested' }));

  expect(getPages().map(p => p.path)).toEqual(['/a/b']);
});

test('re-registering a path within one extension replaces it, and says so', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  try {
    disposables.push(
      register('acme.tools', { path: '/review-queue', name: 'First' }),
      register('acme.tools', { path: '/review-queue', name: 'Second' }),
    );

    expect(getPages().map(p => p.name)).toEqual(['Second']);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('acme.tools:/review-queue'),
    );
  } finally {
    warn.mockRestore();
  }
});

test('disposing a replaced registration leaves the replacement alone', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  try {
    const first = register('acme.tools', {
      path: '/review-queue',
      name: 'First',
    });
    disposables.push(
      register('acme.tools', { path: '/review-queue', name: 'Second' }),
    );

    first.dispose();

    expect(getPages().map(p => p.name)).toEqual(['Second']);
  } finally {
    warn.mockRestore();
  }
});

test('a path is matched by prefix, so deep links reach their page', () => {
  // The server registers `<path:rest>` under each page, so the client has to
  // resolve the same way or a deep link would render "not found".
  disposables.push(
    register('acme.tools', { path: '/review-queue', name: 'Queue' }),
  );

  expect(findPageByPath('/review-queue')?.name).toBe('Queue');
  expect(findPageByPath('/review-queue/42/edit')?.name).toBe('Queue');
});

test('a path no extension claims matches nothing', () => {
  disposables.push(
    register('acme.tools', { path: '/review-queue', name: 'Queue' }),
    register('acme.tools', {
      path: '/review-queue-archive',
      name: 'Archive',
    }),
  );

  expect(findPageByPath('/welcome')).toBeUndefined();
  // A sibling sharing a prefix must not be swallowed by the shorter one.
  expect(findPageByPath('/review-queue-archive')?.name).toBe('Archive');
});

test('resolvePage falls back to a placeholder for an unknown id', () => {
  // `toBeTruthy` passed for any element at all, including the real page --
  // it asserted nothing about the fallback it names.
  const element = resolvePage('acme.tools:/missing');

  expect(element.type).toBe(ExtensionPlaceholder);
  expect(element.props).toMatchObject({ id: 'acme.tools:/missing' });
});

test('resolvePage renders a registered page under an error boundary', () => {
  disposables.push(
    register('acme.tools', { path: '/review-queue', name: 'Queue' }),
  );

  const element = resolvePage('acme.tools:/review-queue');

  expect(element.type).not.toBe(ExtensionPlaceholder);
  // Keyed so a page that throws does not leave its error over the next one.
  expect(element.key).toBe('acme.tools:/review-queue');
});

test('the deepest page claiming a path wins, whatever the registration order', () => {
  // `/reports` and `/reports/archive` both claim `/reports/archive`. Taking
  // the first registered would leave the deeper page unreachable, decided by
  // load order rather than by anything its author controls.
  disposables.push(
    register('acme.tools', { path: '/reports', name: 'Reports' }, [
      { path: '/reports' },
      { path: '/reports/archive' },
    ]),
    register('acme.tools', { path: '/reports/archive', name: 'Archive' }, [
      { path: '/reports' },
      { path: '/reports/archive' },
    ]),
  );

  expect(findPageByPath('/reports')?.name).toBe('Reports');
  expect(findPageByPath('/reports/archive')?.name).toBe('Archive');
  expect(findPageByPath('/reports/archive/2024')?.name).toBe('Archive');
  expect(findPageByPath('/reports/other')?.name).toBe('Reports');
});

test('a page the user may not open is still registered, marked unpermitted', () => {
  // Registered rather than dropped: the extension's bundle calls
  // registerPage unconditionally, so refusing here would turn a permission
  // the user lacks into an error in their console. The host renders a
  // refusal instead, and the server refuses the path independently.
  disposables.push(
    register('acme.tools', { path: '/review-queue', name: 'Queue' }, [
      { path: '/review-queue', permitted: false },
    ]),
  );

  expect(getPages()).toEqual([
    {
      path: '/review-queue',
      name: 'Queue',
      extensionId: 'acme.tools',
      permitted: false,
    },
  ]);
});

test('a declaration that says nothing about permission is treated as open', () => {
  // The server omits the flag only for a page with no declared permission,
  // and an older server omits it entirely. Defaulting to refused would hide
  // every page from everyone the first time this ships.
  disposables.push(
    register('acme.tools', { path: '/review-queue', name: 'Queue' }, [
      { path: '/review-queue' },
    ]),
  );

  expect(getPages()[0].permitted).toBe(true);
});
