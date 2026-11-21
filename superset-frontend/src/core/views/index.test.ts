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
import { act, render, screen } from 'spec/helpers/testing-library';
import {
  canViewPage,
  createOwnedRegisterView,
  getRegisteredView,
  resolveView,
  useResolveView,
  views,
} from './index';

const ThrowingView = () => {
  throw new Error('Boom');
};

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

test('useResolveView re-renders once a view registers after first render', () => {
  const ResolvedView = () => useResolveView('late.view');
  render(React.createElement(ResolvedView), { useTheme: true });

  expect(
    screen.getByText('The extension late.view could not be loaded.'),
  ).toBeInTheDocument();

  const provider = () => React.createElement('div', null, 'Late Content');
  act(() => {
    disposables.push(
      views.registerView(
        { id: 'late.view', name: 'Late View' },
        'sqllab.panels',
        provider,
      ),
    );
  });

  expect(screen.getByText('Late Content')).toBeInTheDocument();
  expect(
    screen.queryByText('The extension late.view could not be loaded.'),
  ).not.toBeInTheDocument();
});

test('useResolveView gives a fresh error boundary when the id changes', () => {
  disposables.push(
    views.registerView(
      { id: 'bad.view', name: 'Bad View' },
      'sqllab.panels',
      ThrowingView,
    ),
    views.registerView(
      { id: 'good.view', name: 'Good View' },
      'sqllab.panels',
      () => React.createElement('div', null, 'Good Content'),
    ),
  );

  const ResolvedView = ({ id }: { id: string }) => useResolveView(id);
  const { rerender } = render(
    React.createElement(ResolvedView, { id: 'bad.view' }),
    { useTheme: true },
  );

  expect(screen.getByText('Unexpected error')).toBeInTheDocument();

  rerender(React.createElement(ResolvedView, { id: 'good.view' }));

  expect(screen.getByText('Good Content')).toBeInTheDocument();
  expect(screen.queryByText('Unexpected error')).not.toBeInTheDocument();
});

test('registerView throws on a duplicate id instead of overwriting', () => {
  disposables.push(
    views.registerView(
      { id: 'ext.dup', name: 'First' },
      'sqllab.panels',
      () => null,
    ),
  );
  expect(() =>
    views.registerView(
      { id: 'ext.dup', name: 'Second' },
      'sqllab.panels',
      () => null,
    ),
  ).toThrow(/already registered/);
  expect(views.getViews('sqllab.panels')?.map(v => v.name)).toEqual(['First']);
});

test('a page id must be a single URL path segment', () => {
  for (const id of ['acme/page', 'acme.page?x', 'acme page', 'acme%2Fpage']) {
    expect(() =>
      views.registerView({ id, name: 'Bad' }, views.Locations.page, () => null),
    ).toThrow(/single URL path segment/);
  }
});

test('the permission options must be set together', () => {
  expect(() =>
    views.registerView(
      { id: 'acme.tools.approvals', name: 'Approvals' },
      'global.page',
      () => null,
      { classPermissionName: 'AcmeApprovalsApi' },
    ),
  ).toThrow(/both "classPermissionName" and "methodPermissionName"/);
});

test('an owned registerView only accepts page ids under its own extension id', () => {
  const registerView = createOwnedRegisterView('acme.tools');
  expect(() =>
    registerView(
      { id: 'other.ext.page', name: 'Hijack' },
      'global.page',
      () => null,
    ),
  ).toThrow(/must start with the registering extension's id/);
  // A look-alike prefix without the dot doesn't count as owned.
  expect(() =>
    registerView(
      { id: 'acme.toolsx.page', name: 'Nope' },
      'global.page',
      () => null,
    ),
  ).toThrow(/must start with the registering extension's id/);
  disposables.push(
    registerView(
      { id: 'acme.tools.approvals', name: 'Approvals' },
      'global.page',
      () => null,
    ),
    // Other locations aren't URL-addressable, so no prefix rule there.
    registerView(
      { id: 'free.panel', name: 'Panel' },
      'sqllab.panels',
      () => null,
    ),
  );
  expect(getRegisteredView('acme.tools.approvals')?.location).toBe(
    'global.page',
  );
});

test('canViewPage checks the declared permission against the user roles', () => {
  disposables.push(
    views.registerView(
      { id: 'open.page', name: 'Open' },
      'global.page',
      () => null,
    ),
    views.registerView(
      { id: 'acme.tools.approvals', name: 'Approvals' },
      'global.page',
      () => null,
      {
        classPermissionName: 'AcmeApprovalsApi',
        methodPermissionName: 'review',
      },
    ),
  );
  const open = getRegisteredView('open.page')!;
  const gated = getRegisteredView('acme.tools.approvals')!;
  expect(canViewPage(open, {})).toBe(true);
  expect(canViewPage(gated, { Gamma: [['can_read', 'Dashboard']] })).toBe(
    false,
  );
  expect(
    canViewPage(gated, { Reviewer: [['can_review', 'AcmeApprovalsApi']] }),
  ).toBe(true);
});

test('disposing a stale registration does not remove a newer one', () => {
  const first = views.registerView(
    { id: 'ext.cycle', name: 'One' },
    'sqllab.panels',
    () => null,
  );
  first.dispose();
  disposables.push(
    views.registerView(
      { id: 'ext.cycle', name: 'Two' },
      'sqllab.panels',
      () => null,
    ),
  );
  first.dispose();
  expect(getRegisteredView('ext.cycle')?.view.name).toBe('Two');
});
