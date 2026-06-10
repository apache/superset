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
import { Suspense, useEffect } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useLocation,
} from '@tanstack/react-router';
import { bindActionCreators } from 'redux';
import { css } from '@apache-superset/core/theme';
import { Layout, Loading } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components';
import Menu from 'src/features/home/Menu';
import getBootstrapData, { applicationRoot } from 'src/utils/getBootstrapData';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import { routes, isFrontendRoute } from 'src/views/routes';
import { Logger, LOG_ACTIONS_SPA_NAVIGATION } from 'src/logger/LogUtils';
import { logEvent } from 'src/logger/actions';
import { store } from 'src/views/store';
import ExtensionsStartup from 'src/extensions/ExtensionsStartup';
import { RootContextProviders } from 'src/views/RootContextProviders';
import { ScrollToTop } from 'src/views/ScrollToTop';
import { parseSearch, stringifySearch } from './searchParams';

const bootstrapData = getBootstrapData();

let lastLocationPathname: string;

const boundActions = bindActionCreators({ logEvent }, store.dispatch);

const LocationPathnameLogger = () => {
  const pathname = useLocation({ select: location => location.pathname });
  useEffect(() => {
    // This will log client side route changes for single page app user navigation
    boundActions.logEvent(LOG_ACTIONS_SPA_NAVIGATION, { path: pathname });
    // reset performance logger timer start point to avoid soft navigation
    // cause dashboard perf measurement problem
    if (lastLocationPathname && lastLocationPathname !== pathname) {
      Logger.markTimeOrigin();
    }
    lastLocationPathname = pathname;
  }, [pathname]);
  return <></>;
};

const RootComponent = () => (
  <>
    <ScrollToTop />
    <LocationPathnameLogger />
    <RootContextProviders>
      <Menu
        data={bootstrapData.common.menu_data}
        isFrontendRoute={isFrontendRoute}
      />
      <ExtensionsStartup>
        <Outlet />
      </ExtensionsStartup>
      <ToastContainer />
    </RootContextProviders>
  </>
);

const rootRoute = createRootRoute({ component: RootComponent });

/**
 * Convert a react-router v5 path pattern to TanStack syntax:
 * ':param' segments become '$param' and trailing slashes are dropped
 * (matching is trailing-slash insensitive via `trailingSlash: 'preserve'`).
 */
export const toTanstackPath = (path: string): string => {
  const converted = path.replace(/:([A-Za-z0-9_]+)/g, '$$$1');
  const trimmed = converted.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
};

const seenPaths = new Set<string>();
const routeChildren = routes
  .filter(({ path }) => {
    const tanstackPath = toTanstackPath(path);
    if (seenPaths.has(tanstackPath)) return false;
    seenPaths.add(tanstackPath);
    return true;
  })
  .map(({ path, Component, load, props = {}, Fallback = Loading }) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: toTanstackPath(path),
      // Preloading a route (hover/focus intent) runs its loader, which
      // warms the page's webpack chunk before the user commits to the
      // navigation. The promise is deliberately NOT returned: loaders
      // are awaited before render, and blocking would keep the shell
      // (menu) from painting until the chunk lands. Fire-and-forget
      // starts the fetch; the lazy() component suspends until it lands.
      loader: load
        ? () => {
            load();
          }
        : undefined,
      component: () => (
        <Suspense fallback={<Fallback />}>
          <Layout>
            <Layout.Content
              css={css`
                display: flex;
                flex-direction: column;
              `}
            >
              <ErrorBoundary
                css={css`
                  margin: 16px;
                `}
              >
                <Component user={bootstrapData.user} {...props} />
              </ErrorBoundary>
            </Layout.Content>
          </Layout>
        </Suspense>
      ),
    }),
  );

const routeTree = rootRoute.addChildren(routeChildren);

export const router = createRouter({
  routeTree,
  basepath: applicationRoot() || undefined,
  // Preload route chunks when the user shows intent (link hover/focus).
  defaultPreload: 'intent',
  defaultPreloadDelay: 50,
  // Search params hold rison and pre-encoded payloads managed outside the
  // router (use-query-params, direct history pushes); treat them as opaque
  // strings that round-trip unchanged.
  parseSearch,
  stringifySearch,
  trailingSlash: 'preserve',
  // Unmatched paths rendered nothing under react-router's <Switch>; those
  // URLs are owned by the Flask backend.
  defaultNotFoundComponent: () => null,
  scrollRestoration: false,
});

// NOTE: the router type is deliberately NOT registered via
// `declare module '@tanstack/react-router' { interface Register ... }`.
// Registration would enforce strict route typing on every Link/navigate
// call, but Superset builds many URLs from backend-provided strings
// (e.g. dashboard.url); loose typing keeps those call sites valid.
