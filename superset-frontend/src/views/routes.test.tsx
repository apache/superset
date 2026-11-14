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
// Imported statically, and before './routes', so both hold the same page
// registry. A dynamic import here would resolve against a module registry an
// earlier `jest.resetModules()` has since replaced.
import { registerPageFor } from 'src/core/pages';
import { isFrontendRoute, routes } from './routes';

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

/**
 * The route that serves contributed pages is one concrete host route.
 *
 * It matches a single prefix the host owns and forms every page's address
 * from the page's id, so a contributed page cannot be reached at a path
 * Superset already answers and its position in `routes` carries no
 * guarantee. These cases pin that: one such route, under a prefix no host
 * screen sits beneath.
 */
// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('the host route that serves contributed pages', () => {
  const EXTENSION_PAGE_ROUTE = '/extensions/pages/:pageId';

  const routesWithExtensions = async () => {
    jest.resetModules();
    jest.doMock('@superset-ui/core', () => ({
      ...jest.requireActual('@superset-ui/core'),
      isFeatureEnabled: (flag: string) => flag === 'ENABLE_EXTENSIONS',
    }));
    const { routes: scoped } = await import('./routes');
    return scoped;
  };

  afterEach(() => {
    jest.dontMock('@superset-ui/core');
    jest.resetModules();
  });

  test('is a concrete host route, so nothing has to outrank anything', async () => {
    const scoped = await routesWithExtensions();

    expect(scoped.filter(r => r.path === EXTENSION_PAGE_ROUTE)).toHaveLength(1);
  });

  test('no host route is shadowed by it', async () => {
    // What the author-chosen paths could not promise: this route matches one
    // prefix the host owns, so no host screen can be reached through it.
    const scoped = await routesWithExtensions();
    const hostPaths = scoped
      .map(r => r.path)
      .filter(
        path =>
          typeof path === 'string' &&
          path !== EXTENSION_PAGE_ROUTE &&
          !path.includes(':'),
      );

    hostPaths.forEach(pathname => {
      const firstMatch = scoped.find(r =>
        matchPath(pathname, { path: r.path }),
      );
      expect(firstMatch?.path).not.toBe(EXTENSION_PAGE_ROUTE);
    });
  });

  test('the root path is left to the welcome redirect', async () => {
    const scoped = await routesWithExtensions();

    expect(matchPath('/', { path: EXTENSION_PAGE_ROUTE })).toBeNull();
    const firstMatch = scoped.find(r => matchPath('/', { path: r.path }));
    expect(firstMatch?.path).not.toBe(EXTENSION_PAGE_ROUTE);
  });

  test('it does not exist when extensions are switched off', async () => {
    jest.resetModules();
    const { routes: scoped } = await import('./routes');

    expect(scoped.map(r => r.path)).not.toContain(EXTENSION_PAGE_ROUTE);
  });
});

test('isFrontendRoute recognises a contributed page and its sub-paths', () => {
  // Answered on the prefix the host owns, so it stays right for a page that
  // registers after this module was evaluated. Without it the menu would
  // full-page-reload to reach a contributed page.
  const registration = registerPageFor(
    'acme.tools',
    [{ id: 'acme.tools.review-queue' }],
    { id: 'acme.tools.review-queue', name: 'Queue' },
    () => null,
  );

  try {
    expect(isFrontendRoute('/extensions/pages/acme.tools.review-queue')).toBe(
      true,
    );
    expect(
      isFrontendRoute('/extensions/pages/acme.tools.review-queue/42/edit'),
    ).toBe(true);
    expect(isFrontendRoute('/nothing-claims-this')).toBe(false);
  } finally {
    registration.dispose();
  }
});
