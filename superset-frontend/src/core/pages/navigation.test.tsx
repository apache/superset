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
 * @fileoverview `useSubPath` / `useNavigate` under a subdirectory deployment.
 *
 * Superset mounts its router as `<Router basename={applicationRoot()}>`, so
 * `location.pathname` arrives with the app root already removed and
 * `history.push` has it added back. These tests run against a real `Router`
 * carrying a basename, because that is the only way to tell a correct
 * implementation from one that happens to work when the basename is empty.
 */

import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render, screen } from 'spec/helpers/testing-library';
import { PageRootContext, useNavigate, useSubPath } from './index';

const APP_ROOT = '/analytics';

// The app root is read once at module evaluation, so it cannot be changed
// per test without resetting modules -- which would hand this module a second
// React instance and break hooks. The two helpers are mocked instead, with
// the behaviour they have under a subdirectory deployment.
jest.mock('src/utils/navigationUtils', () => ({
  ...jest.requireActual('src/utils/navigationUtils'),
  ensureAppRoot: (path: string) =>
    path.startsWith(`${APP_ROOT}/`) || path === APP_ROOT
      ? path
      : `${APP_ROOT}${path}`,
  stripAppRoot: (path: string) =>
    path.startsWith(`${APP_ROOT}/`) ? path.slice(APP_ROOT.length) : path,
}));

const renderAt = (pathname: string, root = '/review-queue') => {
  window.history.replaceState({}, '', `${APP_ROOT}${pathname}`);

  const Probe = () => {
    const subPath = useSubPath();
    const navigate = useNavigate();
    return (
      <>
        <span data-test="sub-path">{subPath}</span>
        <button type="button" onClick={() => navigate('/42')}>
          go
        </button>
      </>
    );
  };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <BrowserRouter basename={APP_ROOT}>
      <PageRootContext.Provider value={root}>
        {children}
      </PageRootContext.Provider>
    </BrowserRouter>
  );

  render(<Probe />, { wrapper });
};

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

test('useSubPath reads the path beneath the page under an app root', () => {
  renderAt('/review-queue/42/edit');

  expect(screen.getByTestId('sub-path')).toHaveTextContent('/42/edit');
});

test('useSubPath reports / at the page root', () => {
  renderAt('/review-queue');

  expect(screen.getByTestId('sub-path')).toHaveTextContent('/');
});

test('useNavigate pushes one app root, not two', () => {
  renderAt('/review-queue');

  screen.getByRole('button', { name: 'go' }).click();

  // `BrowserRouter` adds the basename on push. Adding it in the caller too
  // produced `/analytics/analytics/review-queue/42`, which matches no route
  // and renders blank -- and is invisible in any deployment served from the
  // domain root, which is most of them.
  expect(window.location.pathname).toBe(`${APP_ROOT}/review-queue/42`);
});
