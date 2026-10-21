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

import { createElement } from 'react';
import { MemoryRouter, useHistory, useLocation } from 'react-router-dom';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { registerPageFor, resolvePage } from 'src/core/pages';
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

const renderAt = (pathname: string) =>
  render(
    createElement(
      MemoryRouter,
      { initialEntries: [pathname] },
      createElement(ExtensionPage),
    ),
  );

const Page = () => createElement('div', null, 'the page');

test('renders the page that claims the path', async () => {
  disposables.push(
    registerPageFor(
      'acme.tools',
      [{ path: '/review-queue' }],
      { path: '/review-queue', name: 'Queue' },
      Page,
    ),
  );

  renderAt('/review-queue');

  expect(await screen.findByText('the page')).toBeInTheDocument();
});

test('a deep path reaches the same page', async () => {
  disposables.push(
    registerPageFor(
      'acme.tools',
      [{ path: '/review-queue' }],
      { path: '/review-queue', name: 'Queue' },
      Page,
    ),
  );

  renderAt('/review-queue/42/edit');

  expect(await screen.findByText('the page')).toBeInTheDocument();
});

test('a page the user may not open renders a refusal, not the component', async () => {
  disposables.push(
    registerPageFor(
      'acme.tools',
      [{ path: '/review-queue', permitted: false }],
      { path: '/review-queue', name: 'Queue' },
      Page,
    ),
  );

  renderAt('/review-queue');

  expect(await screen.findByText(/Not authorized/i)).toBeInTheDocument();
  expect(screen.queryByText('the page')).not.toBeInTheDocument();
});

test('an unclaimed path waits for extensions before saying not found', async () => {
  // Extensions register long after first render, so concluding "not found"
  // early would flash an error on every cold load of a real page.
  let settle: () => void = () => {};
  mockInitializeExtensions.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        settle = resolve;
      }),
  );

  renderAt('/nobody-claims-this');

  expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();

  settle();

  expect(await screen.findByText(/Page not found/i)).toBeInTheDocument();
});

test('a failure to load extensions still settles the question', async () => {
  mockInitializeExtensions.mockImplementationOnce(() =>
    Promise.reject(new Error('boom')),
  );

  renderAt('/nobody-claims-this');

  expect(await screen.findByText(/Page not found/i)).toBeInTheDocument();
});

test('a page that throws does not poison the next page', async () => {
  // ErrorBoundary keeps its caught error in state and cannot be cleared, so
  // without a key per page the first crash would render over every page the
  // user visited afterwards.
  const Boom = () => {
    throw new Error('page exploded');
  };
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});

  try {
    disposables.push(
      registerPageFor(
        'acme.tools',
        [{ path: '/crashes' }],
        { path: '/crashes', name: 'Crashes' },
        Boom,
      ),
      registerPageFor(
        'acme.tools',
        [{ path: '/review-queue' }],
        { path: '/review-queue', name: 'Queue' },
        Page,
      ),
    );

    // Rendered inside a router: the boundary reads the location so it can
    // clear a crash when the user moves within the page.
    const crashed = render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/crashes'] },
        createElement('div', null, resolvePage('acme.tools:/crashes')),
      ),
    );
    await waitFor(() =>
      expect(screen.getByText(/page exploded/i)).toBeInTheDocument(),
    );

    crashed.rerender(
      createElement(
        MemoryRouter,
        { initialEntries: ['/review-queue'] },
        createElement('div', null, resolvePage('acme.tools:/review-queue')),
      ),
    );

    expect(await screen.findByText('the page')).toBeInTheDocument();
    expect(screen.queryByText(/page exploded/i)).not.toBeInTheDocument();
  } finally {
    consoleError.mockRestore();
  }
});

test('a crashed page offers a retry that remounts it', async () => {
  // A page's first render usually depends on a request, so the common crash
  // is a response the component did not expect -- worth one more attempt
  // without making the user reload the browser.
  let shouldThrow = true;
  const Flaky = () => {
    if (shouldThrow) {
      throw new Error('page exploded');
    }
    return createElement('div', null, 'recovered');
  };
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});

  try {
    disposables.push(
      registerPageFor(
        'acme.tools',
        [{ path: '/flaky' }],
        { path: '/flaky', name: 'Flaky' },
        Flaky,
      ),
    );

    render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/flaky'] },
        createElement('div', null, resolvePage('acme.tools:/flaky')),
      ),
    );

    expect(await screen.findByText(/page exploded/i)).toBeInTheDocument();

    shouldThrow = false;
    screen.getByRole('button', { name: /Try again/i }).click();

    expect(await screen.findByText('recovered')).toBeInTheDocument();
    expect(screen.queryByText(/page exploded/i)).not.toBeInTheDocument();
  } finally {
    consoleError.mockRestore();
  }
});

test('moving within a page clears a crash from the previous sub-path', async () => {
  // A page owns a subtree of URLs, so the user can move from /42 to /43
  // without leaving it. Carrying the first crash across would make the rest
  // of the page unreachable without a browser reload.
  const Record = () => {
    const { pathname } = useLocation();
    if (pathname === '/records/42') {
      throw new Error('record 42 is broken');
    }
    return createElement('div', null, `showing ${pathname}`);
  };
  // Navigates through the router's own history rather than a hand-built one,
  // so this does not depend on the standalone `history` package resolving to
  // the version react-router v5 expects.
  const Elsewhere = () => {
    const history = useHistory();
    return createElement(
      'button',
      { type: 'button', onClick: () => history.push('/records/43') },
      'go',
    );
  };
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});

  try {
    disposables.push(
      registerPageFor(
        'acme.tools',
        [{ path: '/records' }],
        { path: '/records', name: 'Records' },
        Record,
      ),
    );

    render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/records/42'] },
        createElement(Elsewhere),
        resolvePage('acme.tools:/records'),
      ),
    );

    expect(await screen.findByText(/record 42 is broken/i)).toBeInTheDocument();

    screen.getByRole('button', { name: 'go' }).click();

    expect(await screen.findByText('showing /records/43')).toBeInTheDocument();
    expect(
      screen.queryByText(/record 42 is broken/i),
    ).not.toBeInTheDocument();
  } finally {
    consoleError.mockRestore();
  }
});
