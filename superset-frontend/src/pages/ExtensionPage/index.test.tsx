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
import { MemoryRouter, Route } from 'react-router-dom';
import { act, render, screen } from 'spec/helpers/testing-library';
import { views } from 'src/core/views';
import { RoutePaths } from 'src/views/routePaths';
import ExtensionPage from '.';

let resolveReady: () => void;

jest.mock('src/extensions/ExtensionsLoader', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      ready: () =>
        new Promise<void>(resolve => {
          resolveReady = resolve;
        }),
    }),
  },
}));

const disposables: Array<{ dispose: () => void }> = [];

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
});

const register = (
  id: string,
  location = 'global.page',
  options?: { classPermissionName?: string; methodPermissionName?: string },
) => {
  disposables.push(
    views.registerView(
      { id, name: 'Data catalog' },
      location,
      () => <div>Page Content</div>,
      options,
    ),
  );
};

const renderAt = (path: string, roles: Record<string, string[][]> = {}) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Route path={RoutePaths.EXTENSION_PAGE} component={ExtensionPage} />
    </MemoryRouter>,
    { useTheme: true, useRedux: true, initialState: { user: { roles } } },
  );

test('renders a view registered at global.page, titled with its name', async () => {
  register('acme.catalog.main');
  renderAt('/extensions/pages/acme.catalog.main');
  expect(await screen.findByText('Page Content')).toBeInTheDocument();
  expect(screen.getByText('Data catalog')).toBeInTheDocument();
});

test('renders the same page for a sub-path below its id', async () => {
  register('acme.catalog.main');
  renderAt('/extensions/pages/acme.catalog.main/42/edit');
  expect(await screen.findByText('Page Content')).toBeInTheDocument();
});

test('shows loading until the extension registers the page', async () => {
  renderAt('/extensions/pages/acme.catalog.main');
  expect(screen.queryByText('Page Content')).not.toBeInTheDocument();
  expect(screen.queryByText('Page not found')).not.toBeInTheDocument();

  act(() => register('acme.catalog.main'));
  expect(await screen.findByText('Page Content')).toBeInTheDocument();
});

test('shows not found once extensions have loaded without the page', async () => {
  renderAt('/extensions/pages/acme.catalog.missing');
  await act(async () => resolveReady());
  expect(await screen.findByText('Page not found')).toBeInTheDocument();
});

test('does not render a view registered at a location other than global.page', async () => {
  register('acme.catalog.panel', 'sqllab.panels');
  renderAt('/extensions/pages/acme.catalog.panel');
  await act(async () => resolveReady());
  expect(await screen.findByText('Page not found')).toBeInTheDocument();
  expect(screen.queryByText('Page Content')).not.toBeInTheDocument();
});

test('shows not authorized when the user lacks the page permission', async () => {
  register('acme.tools.approvals', 'global.page', {
    classPermissionName: 'AcmeApprovalsApi',
    methodPermissionName: 'review',
  });
  renderAt('/extensions/pages/acme.tools.approvals', {
    Gamma: [['can_read', 'Dashboard']],
  });
  expect(await screen.findByText('Not authorized')).toBeInTheDocument();
  expect(screen.queryByText('Page Content')).not.toBeInTheDocument();
});

test('renders a permission-gated page for a user holding the permission', async () => {
  register('acme.tools.approvals', 'global.page', {
    classPermissionName: 'AcmeApprovalsApi',
    methodPermissionName: 'review',
  });
  renderAt('/extensions/pages/acme.tools.approvals', {
    Reviewer: [['can_review', 'AcmeApprovalsApi']],
  });
  expect(await screen.findByText('Page Content')).toBeInTheDocument();
});
