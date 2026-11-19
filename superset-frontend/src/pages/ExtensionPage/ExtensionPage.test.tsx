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

import { createElement, useEffect } from 'react';
import { Link, MemoryRouter, Route } from 'react-router-dom';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import { PAGE_LOCATION, registerView } from 'src/core/views';
import ExtensionPage from './index';

// Must be `mock`-prefixed: jest forbids a mock factory from closing over
// anything else.
const mockInitializeExtensions = jest.fn(() => Promise.resolve());
jest.mock('src/extensions/ExtensionsLoader', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({ initializeExtensions: mockInitializeExtensions }),
  },
}));

const disposables: Array<{ dispose: () => void }> = [];

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
  mockInitializeExtensions.mockClear();
});

/** The address the host serves a contributed page at. */
const at = (id: string) => `/extensions/pages/${id}`;

const Page = () => createElement('div', null, 'the page');

/**
 * Rendered through the host's own route, because that is where the page id
 * comes from: `ExtensionPage` reads it as a route parameter rather than
 * parsing it out of the pathname itself.
 *
 * `roles` is the shape `bootstrap_user_data(include_perms=True)` puts in the
 * store -- a role name to a list of `[permission, resource]` pairs -- which
 * is what the page checks against. It is the only input the permission
 * decision has, so there is nothing to stub beyond it.
 */
const renderAt = (
  pathname: string,
  roles: Record<string, [string, string][]> = {},
) =>
  render(
    createElement(
      MemoryRouter,
      { initialEntries: [pathname] },
      createElement(
        Route,
        { path: '/extensions/pages/:pageId' },
        createElement(ExtensionPage),
      ),
    ),
    { useRedux: true, initialState: { user: { roles } } },
  );

const register = (id: string, options?: Record<string, string>) =>
  disposables.push(
    registerView({ id, name: 'Queue' }, PAGE_LOCATION, Page, options),
  );

test('renders the page that claims the path', async () => {
  register('acme.tools.review-queue');

  renderAt(at('acme.tools.review-queue'));

  expect(await screen.findByText('the page')).toBeInTheDocument();
});

test('a page that names no permission opens for any signed-in user', async () => {
  // The user below holds nothing at all. Adding the option must not be able
  // to close a page that already worked, so a page without one cannot
  // consult permissions.
  register('acme.tools.review-queue');

  renderAt(at('acme.tools.review-queue'), {});

  expect(await screen.findByText('the page')).toBeInTheDocument();
});

test('a page opens for a user who holds its permission', async () => {
  register('acme.tools.review-queue', {
    classPermissionName: 'ChangeRequest',
    methodPermissionName: 'read',
  });

  renderAt(at('acme.tools.review-queue'), {
    Gamma: [['can_read', 'ChangeRequest']],
  });

  expect(await screen.findByText('the page')).toBeInTheDocument();
});

test('a page refuses a user who does not hold its permission', async () => {
  register('acme.tools.review-queue', {
    classPermissionName: 'ChangeRequest',
    methodPermissionName: 'read',
  });

  // Holding the write half is not holding the read half, and holding read on
  // something else is not holding it here: the pair is one permission.
  renderAt(at('acme.tools.review-queue'), {
    Gamma: [
      ['can_write', 'ChangeRequest'],
      ['can_read', 'Dashboard'],
    ],
  });

  expect(await screen.findByText('Not authorized')).toBeInTheDocument();
  expect(screen.queryByText('the page')).not.toBeInTheDocument();
});

test('the refusal names the permission to ask for', async () => {
  // The reader cannot act on "you lack permission"; an administrator needs
  // the pair to grant it in the Roles screen.
  register('acme.tools.review-queue', {
    classPermissionName: 'ChangeRequest',
    methodPermissionName: 'read',
  });

  renderAt(at('acme.tools.review-queue'), {});

  expect(await screen.findByText(/can_read/)).toBeInTheDocument();
  expect(screen.getByText(/ChangeRequest/)).toBeInTheDocument();
});

test('an id nothing has registered says so once extensions have settled', async () => {
  renderAt(at('nobody.registered.this'));

  expect(await screen.findByText('Page not found')).toBeInTheDocument();
});

test('a page registering late is picked up without a remount', async () => {
  // The server serves the shell for every id, so arriving before the bundle
  // has landed is the ordinary case rather than an error. Until extensions
  // settle this must not say "not found": the page may be moments away.
  renderAt(at('acme.tools.review-queue'));

  expect(screen.queryByText('the page')).not.toBeInTheDocument();

  register('acme.tools.review-queue');

  expect(await screen.findByText('the page')).toBeInTheDocument();
});

test('a page registering late with a permission is checked on arrival', async () => {
  // The same subscription that notices a page notices what it requires, so
  // a late page is gated the moment it registers rather than rendering
  // first and refusing afterwards.
  renderAt(at('acme.tools.review-queue'), {});

  register('acme.tools.review-queue', {
    classPermissionName: 'ChangeRequest',
    methodPermissionName: 'read',
  });

  expect(await screen.findByText('Not authorized')).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByText('the page')).not.toBeInTheDocument(),
  );
});

test('moving to another page remounts the view, so nothing survives the move', () => {
  // One host route serves every page, so this component stays mounted while
  // `:pageId` changes. Without a key that changes with the page, React sees
  // the same element type in the same position and reuses the instance --
  // and the error boundary inside `resolveView` keeps the error it caught,
  // so a move from a page that threw to any other contributed page would
  // show the first page's error until a reload.
  //
  // The same component is registered at both ids, because that is the case
  // the key decides: with two different components React remounts anyway and
  // this would pass with or without one.
  //
  // Navigated by clicking a `Link` inside the router rather than pushing a
  // history of our own: `react-router-dom` here is v5 and the `history`
  // package is v5, whose API it does not listen to, so an external push
  // never reaches `useParams`.
  let mounts = 0;
  const Counting = () => {
    useEffect(() => {
      mounts += 1;
    }, []);
    return createElement('div', null, 'the page');
  };
  disposables.push(
    registerView({ id: 'acme.one', name: 'One' }, PAGE_LOCATION, Counting),
    registerView({ id: 'acme.two', name: 'Two' }, PAGE_LOCATION, Counting),
  );

  render(
    createElement(
      MemoryRouter,
      { initialEntries: [at('acme.one')] },
      createElement(Link, { to: at('acme.two') }, 'go to the other page'),
      createElement(
        Route,
        { path: '/extensions/pages/:pageId' },
        createElement(ExtensionPage),
      ),
    ),
    { useRedux: true, initialState: { user: { roles: {} } } },
  );
  expect(mounts).toBe(1);

  fireEvent.click(screen.getByText('go to the other page'));

  expect(screen.getByText('the page')).toBeInTheDocument();
  expect(mounts).toBe(2);
});
