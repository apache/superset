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
 * The extension page catch-all must stay the last entry in `routes`.
 *
 * `<Switch>` renders the first match in array order, so that position is the
 * whole of the guarantee that a contributed page cannot shadow a host screen
 * -- the client-side counterpart to Werkzeug giving the server's static rules
 * precedence over an extension's. An extension declares its own path now, so
 * nothing else stops it naming one Superset already uses.
 *
 * Without these, appending a route after the catch-all would silently move
 * that screen behind whatever extension claimed its path.
 */
// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('extension page catch-all precedence', () => {
  const EXTENSION_CATCH_ALL = '/:extensionPagePath+';

  const routesWithExtensions = async () => {
    jest.resetModules();
    jest.doMock('@superset-ui/core', () => {
      const actual = jest.requireActual('@superset-ui/core');
      return {
        ...actual,
        isFeatureEnabled: (flag: string) =>
          flag === actual.FeatureFlag.EnableExtensions ||
          actual.isFeatureEnabled(flag),
      };
    });
    const { routes: scoped } = await import('./routes');
    return scoped;
  };

  afterEach(() => {
    jest.dontMock('@superset-ui/core');
    jest.resetModules();
  });

  test('is registered last, so every host route outranks it', async () => {
    const scoped = await routesWithExtensions();

    expect(scoped[scoped.length - 1].path).toBe(EXTENSION_CATCH_ALL);
    // Stated twice on purpose: the index check above is what breaks when a
    // route is appended, and this is what that would mean.
    expect(
      scoped.filter(r => r.path === EXTENSION_CATCH_ALL),
    ).toHaveLength(1);
  });

  test('every host route resolves to itself, not to the catch-all', async () => {
    const scoped = await routesWithExtensions();

    // Derived from the table rather than a fixed list, so a route added in
    // the wrong place is covered the day it is added. Parameterised paths
    // are skipped because there is no concrete URL to probe them with.
    const literalPaths = scoped
      .map(r => r.path)
      .filter(path => path !== EXTENSION_CATCH_ALL && !path.includes(':'));

    expect(literalPaths.length).toBeGreaterThan(5);

    literalPaths.forEach(pathname => {
      const firstMatch = scoped.find(r => matchPath(pathname, { path: r.path }));
      expect([pathname, firstMatch?.path]).not.toEqual([
        pathname,
        EXTENSION_CATCH_ALL,
      ]);
    });
  });

  test.each(['/dashboard/123/', '/chart/add', '/sqllab/'])(
    'a concrete URL under a parameterised host route (%s) still wins',
    async pathname => {
      const scoped = await routesWithExtensions();

      const firstMatch = scoped.find(r => matchPath(pathname, { path: r.path }));
      expect(firstMatch?.path).not.toBe(EXTENSION_CATCH_ALL);
    },
  );

  test('a path no host route claims falls through to it', async () => {
    const scoped = await routesWithExtensions();

    // Both a single segment and a deep link, since a page owns everything
    // beneath its own path.
    ['/approvals', '/change-review/42/edit'].forEach(pathname => {
      const firstMatch = scoped.find(r => matchPath(pathname, { path: r.path }));
      expect(firstMatch?.path).toBe(EXTENSION_CATCH_ALL);
    });
  });

  test('the root path is left to the welcome redirect', async () => {
    const scoped = await routesWithExtensions();

    // `+` requires at least one segment. Were it `*`, the catch-all would
    // match `/` and render "page not found" in place of the
    // `<Redirect from="/" to="/welcome/" exact />` that follows the routes.
    const firstMatch = scoped.find(r => matchPath('/', { path: r.path }));
    expect(firstMatch?.path).not.toBe(EXTENSION_CATCH_ALL);
    expect(matchPath('/', { path: EXTENSION_CATCH_ALL })).toBeNull();
  });

  test('it does not exist when extensions are switched off', async () => {
    jest.resetModules();
    const { routes: scoped } = await import('./routes');

    expect(scoped.map(r => r.path)).not.toContain(EXTENSION_CATCH_ALL);
  });
});
