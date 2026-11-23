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
  getViewOptions,
  onDidRegisterView,
  onDidUnregisterView,
  PAGE_LOCATION,
  registerView,
  resolveView,
  views,
} from './index';

jest.mock('@apache-superset/core/utils', () => ({
  ...jest.requireActual('@apache-superset/core/utils'),
  logging: { warn: jest.fn(), error: jest.fn() },
}));

const disposables: Array<{ dispose: () => void }> = [];

const component = () => React.createElement('div', null, 'x');
const Component = () => null;
const page = (id: string) => ({ id, name: 'Queue' });

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
  jest.clearAllMocks();
});

test('register stores view metadata and makes it resolvable', () => {
  const provider = () => React.createElement('div', null, 'Test');
  disposables.push(
    views.registerView(
      { id: 'test.view', name: 'Test View' },
      'sqllab.panels',
      provider,
    ),
  );

  expect(views.getViews('sqllab.panels')).toEqual([
    { id: 'test.view', name: 'Test View' },
  ]);
  expect(resolveView('test.view')).toBeTruthy();
});

test('getContributions returns undefined for unknown location', () => {
  expect(views.getViews('nonexistent')).toBeUndefined();
});

test('resolveView returns a placeholder element for unknown id', () => {
  expect(resolveView('nonexistent.view')).toBeTruthy();
});

test('multiple views at the same location are returned together', () => {
  const provider1 = () => React.createElement('div', null, 'View 1');
  const provider2 = () => React.createElement('div', null, 'View 2');

  disposables.push(
    views.registerView(
      { id: 'ext.view1', name: 'View One' },
      'sqllab.panels',
      provider1,
    ),
    views.registerView(
      { id: 'ext.view2', name: 'View Two' },
      'sqllab.panels',
      provider2,
    ),
  );

  const contributions = views.getViews('sqllab.panels');
  expect(contributions).toHaveLength(2);
  expect(contributions).toEqual([
    { id: 'ext.view1', name: 'View One' },
    { id: 'ext.view2', name: 'View Two' },
  ]);
});

test('views at different locations are independent', () => {
  const provider1 = () => React.createElement('div', null, 'Panel');
  const provider2 = () => React.createElement('div', null, 'Status');

  disposables.push(
    views.registerView(
      { id: 'ext.panel', name: 'Panel' },
      'sqllab.panels',
      provider1,
    ),
    views.registerView(
      { id: 'ext.status', name: 'Status' },
      'sqllab.statusBar',
      provider2,
    ),
  );

  expect(views.getViews('sqllab.panels')).toHaveLength(1);
  expect(views.getViews('sqllab.statusBar')).toHaveLength(1);
});

test('dispose removes the view registration', () => {
  const provider = () => React.createElement('div', null, 'Test');
  const disposable = views.registerView(
    { id: 'test.view', name: 'Test View' },
    'sqllab.panels',
    provider,
  );

  expect(views.getViews('sqllab.panels')).toHaveLength(1);

  disposable.dispose();

  expect(views.getViews('sqllab.panels')).toBeUndefined();
});

test('a duplicate view id replaces the first and warns, as a duplicate command does', () => {
  disposables.push(
    views.registerView(
      { id: 'acme.one', name: 'One' },
      'sqllab.panels',
      component,
    ),
  );

  expect(() =>
    disposables.push(
      views.registerView(
        { id: 'acme.one', name: 'Two' },
        'sqllab.panels',
        component,
      ),
    ),
  ).not.toThrow();

  expect(logging.warn).toHaveBeenCalledWith(
    expect.stringContaining('View "acme.one" is already registered'),
  );
  expect(views.getViews('sqllab.panels')).toEqual([
    { id: 'acme.one', name: 'Two' },
  ]);
});

test('a replaced view id leaves its old location index', () => {
  // Two maps, so overwriting the registry entry without clearing the index
  // leaves a location reporting a view that is not registered there. At
  // `global.page` that is not merely stale: the page host resolves the id
  // and would render the replacement, which sits elsewhere and so carries
  // none of the page's permission options.
  disposables.push(
    registerView({ id: 'acme.one', name: 'Page' }, PAGE_LOCATION, component, {
      classPermissionName: 'AcmeApi',
      methodPermissionName: 'read',
    }),
  );
  disposables.push(
    registerView({ id: 'acme.one', name: 'Panel' }, 'sqllab.panels', component),
  );

  expect(views.getViews(PAGE_LOCATION)).toBeUndefined();
  expect(views.getViews('sqllab.panels')).toEqual([
    { id: 'acme.one', name: 'Panel' },
  ]);
  // The surviving registration named no permission, and the gate reads the
  // registration rather than the index, so it must not inherit the page's.
  expect(getViewOptions('acme.one')).toBeUndefined();
});

test('disposing the replaced registration leaves the replacement alone', () => {
  // Otherwise an extension tearing down its own view would remove the one
  // that had taken its id.
  const first = views.registerView(
    { id: 'acme.two', name: 'One' },
    'sqllab.panels',
    component,
  );
  disposables.push(
    views.registerView(
      { id: 'acme.two', name: 'Two' },
      'sqllab.panels',
      component,
    ),
  );

  first.dispose();

  expect(views.getViews('sqllab.panels')).toEqual([
    { id: 'acme.two', name: 'Two' },
  ]);
});

test('PAGE_LOCATION is the location SIP-235 names', () => {
  expect(PAGE_LOCATION).toBe('global.page');
});

test('getViews reports a page', () => {
  disposables.push(
    registerView(page('acme.tools.queue'), PAGE_LOCATION, Component),
  );

  expect(views.getViews(PAGE_LOCATION)?.map(v => v.id)).toContain(
    'acme.tools.queue',
  );
});

test('a disposed page leaves the registry', () => {
  const d = registerView(page('acme.tools.queue'), PAGE_LOCATION, Component);
  d.dispose();

  expect(views.getViews(PAGE_LOCATION)?.map(v => v.id) ?? []).not.toContain(
    'acme.tools.queue',
  );
});

test('onDidRegisterView fires for a page', () => {
  const seen: string[] = [];
  disposables.push(onDidRegisterView(e => seen.push(e.view.id)));
  disposables.push(
    registerView(page('acme.tools.queue'), PAGE_LOCATION, Component),
  );

  expect(seen).toEqual(['acme.tools.queue']);
});

test('onDidUnregisterView fires for a page', () => {
  const seen: string[] = [];
  const d = registerView(page('acme.tools.queue'), PAGE_LOCATION, Component);
  disposables.push(onDidUnregisterView(e => seen.push(e.view.id)));

  d.dispose();

  expect(seen).toEqual(['acme.tools.queue']);
});

test('a page that names no permission reports none', () => {
  // Which is what keeps the option from locking anyone out of a page that
  // already worked: absent is absent, never a permission nobody holds.
  disposables.push(
    registerView(page('acme.tools.queue'), PAGE_LOCATION, Component),
  );

  expect(getViewOptions('acme.tools.queue')).toBeUndefined();
});

test('a page reports the permission it named', () => {
  disposables.push(
    registerView(page('acme.tools.queue'), PAGE_LOCATION, Component, {
      classPermissionName: 'ChangeRequest',
      methodPermissionName: 'read',
    }),
  );

  expect(getViewOptions('acme.tools.queue')).toEqual({
    classPermissionName: 'ChangeRequest',
    methodPermissionName: 'read',
  });
});

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

test('a view with no permission at any location is fine', () => {
  disposables.push(
    registerView(page('acme.tools.panel'), 'sqllab.panels', Component),
  );

  expect(views.getViews('sqllab.panels')?.map(v => v.id)).toContain(
    'acme.tools.panel',
  );
});

// The host serves a page from `/extensions/pages/:pageId`, which matches a
// single segment. An id carrying a separator registers happily and takes a
// navigation entry, and then the route never matches it.
test.each([
  'acme.tools/queue',
  'acme.tools?queue',
  'acme.tools#queue',
  'acme.tools%queue',
])('a page id is refused when it is not one path segment: %s', id => {
  expect(() =>
    registerView({ id, name: 'Queue' }, PAGE_LOCATION, Component),
  ).toThrow(/one path segment/);
});

test('an id with a separator is fine at a location that is not an address', () => {
  // The rule is a property of the route, not of the id, so it applies only
  // where the id becomes part of a URL.
  disposables.push(
    registerView(
      { id: 'acme.tools/panel', name: 'Panel' },
      'sqllab.panels',
      Component,
    ),
  );

  expect(views.getViews('sqllab.panels')?.map(v => v.id)).toContain(
    'acme.tools/panel',
  );
});
