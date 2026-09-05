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
const icon = () => React.createElement('span', null, 'icon');

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

test('registering a view at an unknown location is rejected with a warning and an inert Disposable', () => {
  const warnSpy = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  const provider = () => React.createElement('div', null, 'Test');

  const disposable = views.registerView(
    { id: 'test.view', name: 'Test View' },
    'sqllab.notARealLocation',
    provider,
  );

  expect(views.getViews('sqllab.notARealLocation')).toBeUndefined();
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(() => disposable.dispose()).not.toThrow();

  warnSpy.mockRestore();
});

test('registering a view at a container id registered via registerViewContainer succeeds', () => {
  const provider = () => React.createElement('div', null, 'Test');
  disposables.push(
    views.registerViewContainer('sqllab.leftSidebar', {
      id: 'ext.container',
      name: 'Ext Container',
      icon,
    }),
    views.registerView(
      { id: 'ext.container', name: 'Ext Container' },
      'ext.container',
      provider,
    ),
  );

  expect(views.getViews('ext.container')).toEqual([
    { id: 'ext.container', name: 'Ext Container' },
  ]);
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

test('getViewContainers returns registered containers in deterministic render order', () => {
  disposables.push(
    views.registerViewContainer('sqllab.leftSidebar', {
      id: 'ext.b',
      name: 'B',
      icon,
    }),
    views.registerViewContainer('sqllab.leftSidebar', {
      id: 'ext.a',
      name: 'A',
      icon,
    }),
    views.registerViewContainer('sqllab.leftSidebar', {
      id: 'ext.c',
      name: 'C',
      icon,
      order: 1,
    }),
  );

  expect(views.getViewContainers('sqllab.leftSidebar').map(c => c.id)).toEqual([
    'ext.c',
    'ext.a',
    'ext.b',
  ]);
});

test('getViewContainers returns an empty array when nothing is registered', () => {
  expect(views.getViewContainers('sqllab.leftSidebar')).toEqual([]);
});

test('a duplicate container id is rejected: the first registration wins', () => {
  const warnSpy = jest.spyOn(logging, 'warn').mockImplementation(() => {});

  disposables.push(
    views.registerViewContainer('sqllab.leftSidebar', {
      id: 'ext.a',
      name: 'First',
      icon,
    }),
  );
  const secondDisposable = views.registerViewContainer('sqllab.leftSidebar', {
    id: 'ext.a',
    name: 'Second',
    icon,
  });

  expect(
    views.getViewContainers('sqllab.leftSidebar').map(c => c.name),
  ).toEqual(['First']);
  expect(warnSpy).toHaveBeenCalledTimes(1);

  secondDisposable.dispose();
  expect(
    views.getViewContainers('sqllab.leftSidebar').map(c => c.name),
  ).toEqual(['First']);

  warnSpy.mockRestore();
});

test('a container id colliding with a built-in location name is rejected', () => {
  const warnSpy = jest.spyOn(logging, 'warn').mockImplementation(() => {});

  const disposable = views.registerViewContainer('sqllab.leftSidebar', {
    id: 'sqllab.panels',
    name: 'Colliding',
    icon,
  });

  expect(views.getViewContainers('sqllab.leftSidebar')).toEqual([]);
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(() => disposable.dispose()).not.toThrow();

  warnSpy.mockRestore();
});

test('disposing a container registration removes it, and also orphans its views', () => {
  const provider = () => React.createElement('div', null, 'Test');
  const containerDisposable = views.registerViewContainer(
    'sqllab.leftSidebar',
    { id: 'ext.a', name: 'A', icon },
  );
  disposables.push(
    views.registerView({ id: 'ext.a', name: 'A' }, 'ext.a', provider),
  );

  expect(views.getViewContainers('sqllab.leftSidebar')).toHaveLength(1);

  containerDisposable.dispose();

  expect(views.getViewContainers('sqllab.leftSidebar')).toEqual([]);
  // The view itself is untouched by disposing its container — it's simply
  // no longer reachable through the rail once the container is gone.
  expect(views.getViews('ext.a')).toHaveLength(1);
});
