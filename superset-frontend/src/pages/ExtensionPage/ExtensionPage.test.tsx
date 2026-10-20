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
import { MemoryRouter } from 'react-router-dom';
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

    const crashed = render(
      createElement('div', null, resolvePage('acme.tools:/crashes')),
    );
    await waitFor(() =>
      expect(screen.getByText(/page exploded/i)).toBeInTheDocument(),
    );

    crashed.rerender(
      createElement('div', null, resolvePage('acme.tools:/review-queue')),
    );

    expect(await screen.findByText('the page')).toBeInTheDocument();
    expect(screen.queryByText(/page exploded/i)).not.toBeInTheDocument();
  } finally {
    consoleError.mockRestore();
  }
});
