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
import { matchPath } from 'react-router-dom';
import { views } from 'src/core';
import { isFrontendRoute, isHostRoute, routes } from './routes';

jest.mock('src/pages/Home', () => () => <div data-test="mock-home" />);

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('isFrontendRoute', () => {
  test('returns true if a route matches', () => {
    routes.forEach(r => {
      expect(isFrontendRoute(r.path)).toBe(true);
    });
  });

  test('returns false if a route does not match', () => {
    expect(isFrontendRoute('/nonexistent/path/')).toBe(false);
  });

  test('does not pattern-match parameterised routes', () => {
    // Documented limitation: lookup is a literal dictionary check, so a
    // concrete `/dashboard/123/` does not match the registered
    // `/dashboard/:idOrSlug/` key. Callers must accept the full-page-reload
    // fallback for these URLs.
    expect(isFrontendRoute('/dashboard/123/')).toBe(false);
  });
});

test('routes used to mount the Superset.* SPA pages no longer carry a /superset prefix', () => {
  // After `Superset.route_base = ""`, the SPA paths must mirror the
  // post-basename pathname seen by React Router. The legacy shapes still
  // appearing here would mean Home or Dashboard renders blank under
  // subdirectory deployment.
  const paths = routes.map(r => r.path);
  expect(paths).toContain('/welcome/');
  expect(paths).toContain('/dashboard/:idOrSlug/');
  expect(paths).not.toContain('/superset/welcome/');
  expect(paths).not.toContain('/superset/dashboard/:idOrSlug/');
});

test('isFrontendRoute accepts both bare-route and appRoot-prefixed menu URLs', async () => {
  // Menu URLs flow from bootstrap_data via `url_for(...)` and already carry
  // the active appRoot (e.g. `/superset/welcome/`). The check must succeed
  // against both the bare route shape and the app-root-prefixed shape so
  // Menu.tsx routes them through React Router instead of forcing a reload.
  const previousBody = document.body.innerHTML;
  try {
    const bootstrapData = {
      common: {
        application_root: '/superset',
        conf: { AUTH_USER_REGISTRATION: false },
      },
    };
    document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(bootstrapData)}'></div>`;
    jest.resetModules();
    const { isFrontendRoute: scopedIsFrontendRoute } = await import('./routes');
    // Bare route shape (post-basename) — what React Router sees.
    expect(scopedIsFrontendRoute('/welcome/')).toBe(true);
    expect(scopedIsFrontendRoute('/dashboard/list/')).toBe(true);
    // App-root-prefixed shape — what bootstrap_data emits via url_for(...).
    expect(scopedIsFrontendRoute('/superset/welcome/')).toBe(true);
    expect(scopedIsFrontendRoute('/superset/dashboard/list/')).toBe(true);
    expect(scopedIsFrontendRoute('/superset/welcome/?edit=true')).toBe(true);
  } finally {
    document.body.innerHTML = previousBody;
    jest.resetModules();
  }
});

test('password recovery pages are matched before the /login/ prefix route', () => {
  // The route switch matches by prefix, so a recovery page listed after
  // /login/ would render the sign-in form instead.
  ['/login/forgot_password/', '/login/reset_password/'].forEach(pathname => {
    const firstMatch = routes.find(r => matchPath(pathname, { path: r.path }));
    expect(firstMatch?.path).toBe(pathname);
  });
});

test('isFrontendRoute accepts a page contributed by an extension', () => {
  // A contributed page is a client-side route like any other, so the menu must
  // navigate to it in-app. The lookup has to be live: extensions register long
  // after this module's route dictionary is built.
  expect(isFrontendRoute('/my-ext/queue/')).toBe(false);

  const disposable = views.registerPage(
    { id: 'ext.queue', name: 'Review queue', path: '/my-ext/queue/' },
    () => <div />,
  );

  try {
    expect(isFrontendRoute('/my-ext/queue/')).toBe(true);
    // It is not a host route, which is what tells a page it is not shadowed.
    expect(isHostRoute('/my-ext/queue/')).toBe(false);
  } finally {
    disposable.dispose();
  }

  expect(isFrontendRoute('/my-ext/queue/')).toBe(false);
});

test('isHostRoute answers only for the hosts own routes', () => {
  expect(isHostRoute('/welcome/')).toBe(true);
  expect(isHostRoute('/welcome/?edit=true')).toBe(true);
  expect(isHostRoute('/my-ext/queue/')).toBe(false);
});
