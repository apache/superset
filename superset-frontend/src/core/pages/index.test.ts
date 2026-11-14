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
  getCurrentPage,
  getPages,
  notifyPathnameChanged,
  onDidChangeCurrentPage,
  onDidRegisterPage,
  onDidUnregisterPage,
  registerPageFor,
  resolvePage,
  type DeclaredPage,
} from './index';

const disposables: Array<{ dispose: () => void }> = [];
const Component = () => React.createElement('div', null, 'page');

/** The manifest declaration the loader would have bound for these tests. */
const DECLARED = [
  { id: 'acme.tools.review-queue' },
  { id: 'acme.tools.review-queue-archive' },
];

const register = (
  extensionId: string,
  page: { id: string; name: string },
  declared: readonly DeclaredPage[] = DECLARED,
) => registerPageFor(extensionId, declared, page, Component);

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
});

test('a declared page registers at the path it declared', () => {
  disposables.push(
    register('acme.tools', { id: 'acme.tools.review-queue', name: 'Queue' }),
  );

  expect(getPages()).toEqual([
    {
      id: 'acme.tools.review-queue',
      name: 'Queue',
      extensionId: 'acme.tools',
      permitted: true,
    },
  ]);
});

test('an id the manifest does not declare is refused', () => {
  // The manifest is what the server reads to decide who may open a page, so
  // a component registered under an undeclared id would mount on client
  // navigation with nothing guarding it. Refusing here keeps the halves in
  // agreement.
  const error = jest.spyOn(logging, 'error').mockImplementation(() => {});
  try {
    register('acme.tools', { id: 'acme.tools.welcome', name: 'X' });

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
      register('acme.tools', { id: 'acme.tools.welcome', name: 'X' }),
    ).not.toThrow();

    // The returned Disposable is inert rather than absent, so an extension
    // that pushes it into a subscription list does not then crash on dispose.
    const inert = register('acme.tools', {
      id: 'acme.tools.welcome',
      name: 'X',
    });
    expect(() => inert.dispose()).not.toThrow();
  } finally {
    error.mockRestore();
  }
});

test('the refusal names what was declared, so the fix is obvious', () => {
  const error = jest.spyOn(logging, 'error').mockImplementation(() => {});
  try {
    register('acme.tools', { id: 'acme.tools.welcome', name: 'X' }, [
      { id: 'acme.tools.review-queue' },
    ]);

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Declared: acme.tools.review-queue'),
    );
  } finally {
    error.mockRestore();
  }
});

test('an extension with no declared pages can register none', () => {
  const error = jest.spyOn(logging, 'error').mockImplementation(() => {});
  try {
    register('acme.tools', { id: 'acme.tools.review-queue', name: 'X' }, []);

    expect(getPages()).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Declared: (none)'),
    );
  } finally {
    error.mockRestore();
  }
});

test.each([
  ["another extension's", 'other.ext.queue'],
  ['a near-miss on the prefix', 'acme.toolsy.queue'],
  ['bare', 'queue'],
  ['empty', ''],
])('an id that is %s is refused', (_label, id) => {
  // A page id is the only thing an extension chooses here, and it decides the
  // page's URL. Requiring the extension's own id as a prefix is what stops one
  // extension claiming, or quietly overwriting, another's page.
  const error = jest.spyOn(logging, 'error').mockImplementation(() => {});
  try {
    register('acme.tools', { id, name: 'X' }, [{ id }]);

    expect(getPages()).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("must begin with the extension's own id"),
    );
  } finally {
    error.mockRestore();
  }
});

test('re-registering an id within one extension replaces it, and says so', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  try {
    disposables.push(
      register('acme.tools', { id: 'acme.tools.review-queue', name: 'First' }),
      register('acme.tools', { id: 'acme.tools.review-queue', name: 'Second' }),
    );

    expect(getPages().map(p => p.name)).toEqual(['Second']);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('acme.tools.review-queue'),
    );
  } finally {
    warn.mockRestore();
  }
});

test('disposing a replaced registration leaves the replacement alone', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  try {
    const first = register('acme.tools', {
      id: 'acme.tools.review-queue',
      name: 'First',
    });
    disposables.push(
      register('acme.tools', { id: 'acme.tools.review-queue', name: 'Second' }),
    );

    first.dispose();

    expect(getPages().map(p => p.name)).toEqual(['Second']);
  } finally {
    warn.mockRestore();
  }
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
    register('acme.tools', { id: 'acme.tools.review-queue', name: 'Queue' }),
  );

  const element = resolvePage('acme.tools.review-queue');

  expect(element.type).not.toBe(ExtensionPlaceholder);
  // Keyed so a page that throws does not leave its error over the next one.
  expect(element.key).toBe('acme.tools.review-queue');
});

test('a page the user may not open is still registered, marked unpermitted', () => {
  // Registered rather than dropped: the extension's bundle calls
  // registerPage unconditionally, so refusing here would turn a permission
  // the user lacks into an error in their console. The host renders a
  // refusal instead, and the server refuses the path independently.
  disposables.push(
    register('acme.tools', { id: 'acme.tools.review-queue', name: 'Queue' }, [
      { id: 'acme.tools.review-queue', permitted: false },
    ]),
  );

  expect(getPages()).toEqual([
    {
      id: 'acme.tools.review-queue',
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
    register('acme.tools', { id: 'acme.tools.review-queue', name: 'Queue' }, [
      { id: 'acme.tools.review-queue' },
    ]),
  );

  expect(getPages()[0].permitted).toBe(true);
});

test('the manifest supplies nav and name without the code repeating them', () => {
  // The manifest is where a page is declared, and the server sends the whole
  // declaration to the frontend. Reading only the registration's argument
  // meant a page that declared `nav` there never reached the menu -- the
  // field looked decorative.
  disposables.push(
    registerPageFor(
      'acme.tools',
      [
        {
          id: 'acme.tools.review-queue',
          name: 'Review queue',
          nav: { label: 'Queue' },
          permission: 'can_review',
        },
      ],
      { id: 'acme.tools.review-queue', name: 'Review queue' },
      Component,
    ),
  );

  expect(getPages()[0]).toMatchObject({
    id: 'acme.tools.review-queue',
    nav: { label: 'Queue' },
    permission: 'can_review',
    permitted: true,
  });
});

test('what the registration passes wins over the declaration', () => {
  // The declaration is a default, not an override: the call the author wrote
  // is the more specific statement.
  disposables.push(
    registerPageFor(
      'acme.tools',
      [{ id: 'acme.tools.review-queue', name: 'From manifest' }],
      { id: 'acme.tools.review-queue', name: 'From code' },
      Component,
    ),
  );

  expect(getPages()[0].name).toBe('From code');
});

test('the declaration cannot smuggle in a different path or permission flag', () => {
  // `path`, `registered` and `permitted` are the host's own fields; spreading
  // the declaration must not let them be restated as page descriptor fields.
  disposables.push(
    registerPageFor(
      'acme.tools',
      [{ id: 'acme.tools.review-queue', registered: true, permitted: false }],
      { id: 'acme.tools.review-queue', name: 'Queue' },
      Component,
    ),
  );

  const [page] = getPages();
  expect(page.id).toBe('acme.tools.review-queue');
  expect(page.permitted).toBe(false);
  expect(page).not.toHaveProperty('path');
});

describe.each([
  ['onDidRegisterPage', onDidRegisterPage],
  ['onDidUnregisterPage', onDidUnregisterPage],
])('%s', (_name, subscribe) => {
  test('calls the listener with the thisArgs it was given', () => {
    // `Event<T>` takes `(listener, thisArgs?)`, so an extension may pass a
    // method and its owner. A wrapper that forwards only the listener leaves
    // the method unbound, and it throws on its first `this`.
    class Controller {
      seen: string[] = [];

      addPage(page: { id: string }) {
        this.seen.push(page.id);
      }
    }
    const controller = new Controller();
    disposables.push(subscribe(controller.addPage, controller));

    const disposable = register('acme.tools', {
      id: 'acme.tools.review-queue',
      name: 'Queue',
    });
    disposable.dispose();

    expect(controller.seen).toEqual(['acme.tools.review-queue']);
  });
});

describe('the snapshot handed to callers', () => {
  test('is frozen, array and pages alike', () => {
    // `getPages` is public, so an extension holds the host's own routing and
    // menu input. Rewriting an id here would point a live route elsewhere.
    disposables.push(
      register('acme.tools', { id: 'acme.tools.review-queue', name: 'Queue' }),
    );

    const [page] = getPages();
    expect(Object.isFrozen(getPages())).toBe(true);
    expect(Object.isFrozen(page)).toBe(true);
    expect(() => {
      (page as { id: string }).id = 'other.ext.page';
    }).toThrow();
    expect(getPages()[0].id).toBe('acme.tools.review-queue');
  });

  test('keeps its identity between registrations', () => {
    // Frozen rather than copied on read for this reason: `getPages` is the
    // `getSnapshot` for `useSyncExternalStore`, which compares by reference,
    // so a fresh array per call would re-render forever.
    disposables.push(
      register('acme.tools', { id: 'acme.tools.review-queue', name: 'Queue' }),
    );

    expect(getPages()).toBe(getPages());
  });
});

test('a listener that throws does not stop its peers, or the registration', () => {
  // Listeners are global and shared across extensions, and the page is in
  // the registry before the event fires.
  const error = jest.spyOn(logging, 'error').mockImplementation(() => {});
  const seen: string[] = [];
  disposables.push(
    onDidRegisterPage(() => {
      throw new Error('listener blew up');
    }),
  );
  disposables.push(onDidRegisterPage(page => seen.push(page.id)));

  expect(() =>
    disposables.push(
      register('acme.tools', { id: 'acme.tools.review-queue', name: 'Queue' }),
    ),
  ).not.toThrow();

  expect(seen).toEqual(['acme.tools.review-queue']);
  expect(getPages()).toHaveLength(1);
  expect(error).toHaveBeenCalled();
});

describe('the current contributed page', () => {
  // `navigation.getPage()` reports the surface, where every contributed page
  // is `'extension'`. These cover the finer question it cannot answer.
  afterEach(() => notifyPathnameChanged('/'));

  test('is undefined on a host screen', () => {
    disposables.push(
      register('acme.tools', { id: 'acme.tools.review-queue', name: 'Q' }),
    );
    notifyPathnameChanged('/welcome');

    expect(getCurrentPage()).toBeUndefined();
  });

  test('is the page whose address the user is on', () => {
    disposables.push(
      register('acme.tools', { id: 'acme.tools.review-queue', name: 'Q' }),
    );
    notifyPathnameChanged('/extensions/pages/acme.tools.review-queue');

    expect(getCurrentPage()).toMatchObject({ id: 'acme.tools.review-queue' });
  });

  test('a sub-path still counts as that page', () => {
    disposables.push(
      register('acme.tools', { id: 'acme.tools.review-queue', name: 'Q' }),
    );
    notifyPathnameChanged('/extensions/pages/acme.tools.review-queue/42/edit');

    expect(getCurrentPage()).toMatchObject({ id: 'acme.tools.review-queue' });
  });

  test('moving between two contributed pages fires, where the surface does not', () => {
    disposables.push(
      register('acme.tools', { id: 'acme.tools.review-queue', name: 'Q' }),
    );
    disposables.push(
      register('acme.tools', {
        id: 'acme.tools.review-queue-archive',
        name: 'A',
      }),
    );
    notifyPathnameChanged('/extensions/pages/acme.tools.review-queue');

    const seen: Array<string | undefined> = [];
    disposables.push(onDidChangeCurrentPage(page => seen.push(page?.id)));
    notifyPathnameChanged('/extensions/pages/acme.tools.review-queue-archive');

    expect(seen).toEqual(['acme.tools.review-queue-archive']);
  });

  test('leaving for a host screen fires with undefined', () => {
    disposables.push(
      register('acme.tools', { id: 'acme.tools.review-queue', name: 'Q' }),
    );
    notifyPathnameChanged('/extensions/pages/acme.tools.review-queue');

    const seen: Array<string | undefined> = [];
    disposables.push(onDidChangeCurrentPage(page => seen.push(page?.id)));
    notifyPathnameChanged('/welcome');

    expect(seen).toEqual([undefined]);
  });

  test('a sub-path move within one page fires nothing', () => {
    disposables.push(
      register('acme.tools', { id: 'acme.tools.review-queue', name: 'Q' }),
    );
    notifyPathnameChanged('/extensions/pages/acme.tools.review-queue');

    const seen: unknown[] = [];
    disposables.push(onDidChangeCurrentPage(page => seen.push(page)));
    // Beneath the page's own address. A bare `/review-queue/42` is a host
    // screen now, so it would fire `undefined` and pin nothing about
    // sub-paths.
    notifyPathnameChanged('/extensions/pages/acme.tools.review-queue/42');

    expect(seen).toEqual([]);
  });

  test('a page registering for the URL already open becomes current', () => {
    // The normal case, not the exception: the bundle lands after the route.
    notifyPathnameChanged('/extensions/pages/acme.tools.review-queue');
    expect(getCurrentPage()).toBeUndefined();

    const seen: Array<string | undefined> = [];
    disposables.push(onDidChangeCurrentPage(page => seen.push(page?.id)));
    disposables.push(
      register('acme.tools', { id: 'acme.tools.review-queue', name: 'Q' }),
    );

    expect(seen).toEqual(['acme.tools.review-queue']);
    expect(getCurrentPage()).toMatchObject({ id: 'acme.tools.review-queue' });
  });

  test('disposing the page the user is on clears it', () => {
    const disposable = register('acme.tools', {
      id: 'acme.tools.review-queue',
      name: 'Q',
    });
    notifyPathnameChanged('/extensions/pages/acme.tools.review-queue');

    const seen: Array<string | undefined> = [];
    disposables.push(onDidChangeCurrentPage(page => seen.push(page?.id)));
    disposable.dispose();

    expect(seen).toEqual([undefined]);
    expect(getCurrentPage()).toBeUndefined();
  });
});
