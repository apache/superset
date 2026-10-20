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
import { views, resolveView } from './index';

const disposables: Array<{ dispose: () => void }> = [];

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
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

test('registerPage stores the path and makes the page resolvable', () => {
  const provider = () => React.createElement('div', null, 'Queue');
  disposables.push(
    views.registerPage(
      { id: 'ext.queue', name: 'Review queue', path: '/my-ext/queue/' },
      provider,
    ),
  );

  expect(views.getPages()).toEqual([
    { id: 'ext.queue', name: 'Review queue', path: '/my-ext/queue/' },
  ]);
  expect(resolveView('ext.queue')).toBeTruthy();
});

test('getPages is empty when no extension contributes one', () => {
  expect(views.getPages()).toEqual([]);
});

test('registerPage refuses a page with no path', () => {
  const provider = () => React.createElement('div', null, 'Nowhere');
  expect(() =>
    views.registerPage(
      { id: 'ext.nopath', name: 'Nowhere' } as never,
      provider,
    ),
  ).toThrow(/must declare an absolute "path"/);
  expect(views.getPages()).toEqual([]);
});

test('registerPage refuses a relative path', () => {
  const provider = () => React.createElement('div', null, 'Relative');
  expect(() =>
    views.registerPage(
      { id: 'ext.relative', name: 'Relative', path: 'my-ext/queue/' },
      provider,
    ),
  ).toThrow(/beginning with "\/"/);
  expect(views.getPages()).toEqual([]);
});

test('pages do not leak into an unrelated view location', () => {
  const provider = () => React.createElement('div', null, 'Queue');
  disposables.push(
    views.registerPage(
      { id: 'ext.queue', name: 'Review queue', path: '/my-ext/queue/' },
      provider,
    ),
  );

  expect(views.getViews('sqllab.panels')).toBeUndefined();
  expect(views.getPages()).toHaveLength(1);
});

test('disposing a page unmounts its route', () => {
  const provider = () => React.createElement('div', null, 'Queue');
  const disposable = views.registerPage(
    { id: 'ext.queue', name: 'Review queue', path: '/my-ext/queue/' },
    provider,
  );

  expect(views.getPages()).toHaveLength(1);

  disposable.dispose();

  expect(views.getPages()).toEqual([]);
});

test('a second view under one id replaces the first, and says so', () => {
  // Ids are the registry's keys, so the first contribution stops appearing.
  // Nothing errors, which is why the warning matters: two extensions that
  // happen to pick the same id leave one of them quietly absent.
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  try {
    disposables.push(
      views.registerView({ id: 'clash', name: 'First' }, 'sqllab.panels', () =>
        React.createElement('div', null, 'First'),
      ),
      views.registerView({ id: 'clash', name: 'Second' }, 'sqllab.panels', () =>
        React.createElement('div', null, 'Second'),
      ),
    );

    expect(views.getViews('sqllab.panels')).toEqual([
      { id: 'clash', name: 'Second' },
    ]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"clash"'));
  } finally {
    warn.mockRestore();
  }
});

test('disposing a replaced registration leaves the replacement alone', () => {
  // The stale disposable deletes by id, so without a guard an extension
  // tearing down its own view removes whichever view holds that id now.
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  try {
    const first = views.registerView(
      { id: 'clash', name: 'First' },
      'sqllab.panels',
      () => React.createElement('div', null, 'First'),
    );
    disposables.push(
      views.registerView({ id: 'clash', name: 'Second' }, 'sqllab.panels', () =>
        React.createElement('div', null, 'Second'),
      ),
    );

    first.dispose();

    expect(views.getViews('sqllab.panels')).toEqual([
      { id: 'clash', name: 'Second' },
    ]);
  } finally {
    warn.mockRestore();
  }
});

test('a replaced view is removed from its old location', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  try {
    disposables.push(
      views.registerView({ id: 'moved', name: 'First' }, 'sqllab.panels', () =>
        React.createElement('div'),
      ),
      views.registerView(
        { id: 'moved', name: 'Second' },
        'sqllab.statusBar',
        () => React.createElement('div'),
      ),
    );

    // Otherwise the old location still lists an id the registry resolves to
    // the new component, and the view renders in both places.
    expect(views.getViews('sqllab.panels')).toBeUndefined();
    expect(views.getViews('sqllab.statusBar')).toHaveLength(1);
  } finally {
    warn.mockRestore();
  }
});

test('a second page at one path is warned about', () => {
  // `Switch` renders its first matching child, so the second page is simply
  // never reached and the router reports nothing.
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  try {
    disposables.push(
      views.registerPage({ id: 'ext.one', name: 'One', path: '/shared/' }, () =>
        React.createElement('div'),
      ),
      views.registerPage({ id: 'ext.two', name: 'Two', path: '/shared/' }, () =>
        React.createElement('div'),
      ),
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('already mounted at "/shared/"'),
    );
  } finally {
    warn.mockRestore();
  }
});
