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

describe('a duplicate view id', () => {
  const component = () => React.createElement('div', null, 'x');

  test('is refused rather than silently replacing the first', () => {
    // The SIP asks for a throw. Replacing would leave whatever the first
    // registration contributed simply absent, with only a console line to
    // say why -- the hardest kind of mistake for an author to find.
    disposables.push(
      views.registerView(
        { id: 'acme.one', name: 'One' },
        'sqllab.panels',
        component,
      ),
    );

    expect(() =>
      views.registerView(
        { id: 'acme.one', name: 'Two' },
        'sqllab.panels',
        component,
      ),
    ).toThrow(/already registered as "acme.one"/);
  });

  test('names the other location when the two differ', () => {
    // An author hunting this needs to know where the id is already taken,
    // which is not necessarily the location they just registered at.
    disposables.push(
      views.registerView(
        { id: 'acme.two', name: 'One' },
        'sqllab.panels',
        component,
      ),
    );

    expect(() =>
      views.registerView(
        { id: 'acme.two', name: 'Two' },
        'global.page',
        component,
      ),
    ).toThrow(/at "sqllab.panels"/);
  });

  test('the first registration survives the refusal', () => {
    // The throw must not have torn down what was already there.
    disposables.push(
      views.registerView(
        { id: 'acme.three', name: 'Keep' },
        'sqllab.panels',
        component,
      ),
    );
    expect(() =>
      views.registerView(
        { id: 'acme.three', name: 'Drop' },
        'sqllab.panels',
        component,
      ),
    ).toThrow();

    expect(views.getViews('sqllab.panels')).toEqual([
      { id: 'acme.three', name: 'Keep' },
    ]);
  });

  test('the id is free again once the first is disposed', () => {
    // Otherwise an extension could never be unloaded and reloaded.
    const first = views.registerView(
      { id: 'acme.four', name: 'One' },
      'sqllab.panels',
      component,
    );
    first.dispose();

    expect(() =>
      disposables.push(
        views.registerView(
          { id: 'acme.four', name: 'Two' },
          'sqllab.panels',
          component,
        ),
      ),
    ).not.toThrow();
  });
});
