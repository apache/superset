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
 * @fileoverview A page is an ordinary view, and these are the cases that say so.
 *
 * Collapsing the `pages` namespace into `views` is only safe if the views
 * registry really does answer everything the page registry used to. Each case
 * below pins one thing the deleted namespace provided, against the member that
 * replaces it, so a regression shows up here rather than in an extension.
 */

import {
  getViewOptions,
  onDidRegisterView,
  onDidUnregisterView,
  PAGE_LOCATION,
  registerView,
  views,
} from './index';

// Asserted through the namespace an extension is actually handed, rather than
// the module-local binding: that is the surface the parity claim is about.
const { getViews } = views;

const Component = () => null;
const page = (id: string) => ({ id, name: 'Queue' });

test('PAGE_LOCATION is the location SIP-235 names', () => {
  expect(PAGE_LOCATION).toBe('global.page');
});

test('getViews reports pages — it is the replacement for getPages()', () => {
  // The PR this replaces made `global.page` the one location the registry did
  // not store, so `getViews` never saw a page. That exclusion is what made a
  // second registry necessary; undoing it is what makes one registry enough.
  const d = registerView(page('acme.tools.queue'), PAGE_LOCATION, Component);

  try {
    expect(getViews(PAGE_LOCATION)?.map(v => v.id)).toContain(
      'acme.tools.queue',
    );
  } finally {
    d.dispose();
  }
});

test('a disposed page leaves the registry', () => {
  const d = registerView(page('acme.tools.queue'), PAGE_LOCATION, Component);
  d.dispose();

  expect(getViews(PAGE_LOCATION)?.map(v => v.id) ?? []).not.toContain(
    'acme.tools.queue',
  );
});

test('onDidRegisterView fires for a page — the replacement for onDidRegisterPage', () => {
  const seen: string[] = [];
  const sub = onDidRegisterView(e => seen.push(e.view.id));
  const d = registerView(page('acme.tools.queue'), PAGE_LOCATION, Component);

  try {
    expect(seen).toEqual(['acme.tools.queue']);
  } finally {
    d.dispose();
    sub.dispose();
  }
});

test('onDidUnregisterView fires for a page — the replacement for onDidUnregisterPage', () => {
  const seen: string[] = [];
  const d = registerView(page('acme.tools.queue'), PAGE_LOCATION, Component);
  const sub = onDidUnregisterView(e => seen.push(e.view.id));

  try {
    d.dispose();
    expect(seen).toEqual(['acme.tools.queue']);
  } finally {
    sub.dispose();
  }
});

test('a page that names no permission reports none', () => {
  // What keeps SIP-235's promise that adding the option cannot lock anyone
  // out of a page that already worked: absent is absent, never a permission
  // nobody holds.
  const d = registerView(page('acme.tools.queue'), PAGE_LOCATION, Component);

  try {
    expect(getViewOptions('acme.tools.queue')).toBeUndefined();
  } finally {
    d.dispose();
  }
});

test('a page reports the permission it named', () => {
  const d = registerView(page('acme.tools.queue'), PAGE_LOCATION, Component, {
    classPermissionName: 'ChangeRequest',
    methodPermissionName: 'read',
  });

  try {
    expect(getViewOptions('acme.tools.queue')).toEqual({
      classPermissionName: 'ChangeRequest',
      methodPermissionName: 'read',
    });
  } finally {
    d.dispose();
  }
});

describe('the registration guards', () => {
  test('half a permission is refused', () => {
    expect(() =>
      registerView(page('acme.tools.queue'), PAGE_LOCATION, Component, {
        classPermissionName: 'ChangeRequest',
      }),
    ).toThrow(/only half a permission/);
  });

  test('a methodPermissionName that already carries can_ is refused', () => {
    // Otherwise it is checked as `can_can_read`, which no permission is
    // called, and the page refuses everyone with nothing to say why.
    expect(() =>
      registerView(page('acme.tools.queue'), PAGE_LOCATION, Component, {
        classPermissionName: 'ChangeRequest',
        methodPermissionName: 'can_read',
      }),
    ).toThrow(/already carries the "can_" prefix/);
  });

  test('a permission at a location nothing checks is refused', () => {
    // The failure this prevents is the quiet one: an author gates a SQL Lab
    // panel, believes it guarded, and it is not.
    expect(() =>
      registerView(page('acme.tools.panel'), 'sqllab.panels', Component, {
        classPermissionName: 'ChangeRequest',
        methodPermissionName: 'read',
      }),
    ).toThrow(/only a page .* is gated by one/);
  });

  test('a page with no permission at any location is fine', () => {
    const d = registerView(
      page('acme.tools.panel'),
      'sqllab.panels',
      Component,
    );
    expect(getViews('sqllab.panels')?.map(v => v.id)).toContain(
      'acme.tools.panel',
    );
    d.dispose();
  });
});
