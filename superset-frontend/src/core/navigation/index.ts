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
 * @fileoverview Host-internal implementation of the `navigation` namespace.
 *
 * Derives the current {@link Page} from the browser location by matching
 * against {@link RoutePaths}. Call {@link useNavigationTracker} once in the
 * app shell to keep the page in sync with React Router.
 */

import { useEffect, useRef } from 'react';
import { useHistory, useLocation, matchPath } from 'react-router-dom';
import type { History } from 'history';
import type { navigation as navigationApi } from '@apache-superset/core';
import {
  navigateTo as fullPageNavigate,
  stripAppRoot,
} from 'src/utils/navigationUtils';
import { RoutePaths } from '../../views/routePaths';
import { commands } from '../commands';
import { Disposable } from '../models';
import { createValueEventEmitter } from '../utils';

type Page = navigationApi.Page;
type Location = navigationApi.Location;

/** Maps route path patterns to their corresponding Page type. */
const PAGE_ROUTES: { path: string; page: Page }[] = [
  // List routes must precede their parameterised detail counterparts: with
  // prefix-free paths, `matchPath(exact: false)` lets `/dashboard/:idOrSlug/`
  // greedily capture `/dashboard/list/` (idOrSlug='list'), so the more specific
  // list route has to win first — mirroring the `routes.tsx` Switch precedence.
  { path: RoutePaths.DASHBOARD_LIST, page: 'dashboard_list' },
  { path: RoutePaths.DASHBOARD, page: 'dashboard' },
  { path: RoutePaths.QUERY_HISTORY, page: 'query_history' },
  { path: RoutePaths.SAVED_QUERIES, page: 'saved_queries' },
  { path: RoutePaths.SQLLAB, page: 'sqllab' },
  { path: RoutePaths.CHART_ADD, page: 'explore' },
  { path: RoutePaths.CHART_LIST, page: 'chart_list' },
  { path: RoutePaths.EXPLORE, page: 'explore' },
  { path: RoutePaths.EXPLORE_PERMALINK, page: 'explore' },
  { path: RoutePaths.DATASET_LIST, page: 'dataset_list' },
  { path: RoutePaths.DATASET_ADD, page: 'dataset' },
  { path: RoutePaths.DATASET, page: 'dataset' },
  { path: RoutePaths.EXTENSION_PAGE, page: 'extension' },
];

function derivePage(pathname: string): Page {
  for (const { path, page } of PAGE_ROUTES) {
    if (matchPath(pathname, { path, exact: false })) return page;
  }
  return 'home';
}

const pageEmitter = createValueEventEmitter<Page>(
  derivePage(window.location.pathname),
);

/** Updates the current page from a pathname. No-op when the page is unchanged. */
export const notifyLocationChanged = (pathname: string): void => {
  const next = derivePage(pathname);
  if (next === pageEmitter.getCurrent()) return;
  pageEmitter.fire(next);
};

const getPage: typeof navigationApi.getPage = () => pageEmitter.getCurrent();

const onDidChangePage: typeof navigationApi.onDidChangePage = (
  listener: (page: Page) => void,
  thisArgs?: unknown,
): Disposable => pageEmitter.subscribe(listener, thisArgs);

const EXTENSION_PAGES_PREFIX = '/extensions/pages/';

// Seeded on first use rather than at import: `stripAppRoot` reads the
// application root from bootstrap data, which is not guaranteed to be
// readable while this module is still being evaluated.
let locationEmitterInstance: ReturnType<
  typeof createValueEventEmitter<Location>
> | null = null;

const getLocationEmitter = () => {
  if (!locationEmitterInstance) {
    locationEmitterInstance = createValueEventEmitter<Location>({
      pathname: stripAppRoot(window.location.pathname),
      search: window.location.search ?? '',
    });
  }
  return locationEmitterInstance;
};

/**
 * React Router's history, captured by `useNavigationTracker`, so
 * `navigateTo` can push client-side from non-component code (a command
 * handler). `react-router-dom` is not in the module-federation share scope,
 * so an extension can't reach the host's router any other way, and a raw
 * `history.pushState` fires no `popstate` the router would see.
 */
let routerHistory: History | null = null;

/** Paths the host router renders client-side, so a push won't dead-end. */
const isClientRoutable = (pathname: string): boolean =>
  PAGE_ROUTES.some(({ path }) => !!matchPath(pathname, { path, exact: false }));

const navigateTo: typeof navigationApi.navigateTo = (path: string) => {
  if (
    typeof path !== 'string' ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\')
  ) {
    throw new Error(
      `navigateTo expects a router-relative path starting with "/" (got "${path}").`,
    );
  }
  const relative = stripAppRoot(path);
  const pathname = relative.split(/[?#]/)[0];
  if (routerHistory && isClientRoutable(pathname)) {
    routerHistory.push(relative);
    return;
  }
  fullPageNavigate(relative);
};

/** Id of the built-in command that opens an extension page by its id. */
export const OPEN_PAGE_COMMAND = 'core.navigation.openPage';

// The handler behind `page` menu items, public so keybindings and other
// menu locations can open a page without going through a menu item:
// `commands.executeCommand('core.navigation.openPage', 'acme.catalog.main')`.
commands.registerCommand(
  {
    id: OPEN_PAGE_COMMAND,
    title: 'Open page',
    description: 'Open an extension page registered at global.page.',
  },
  (pageId: string) => {
    if (typeof pageId !== 'string' || !/^[^/?#%\s]+$/.test(pageId)) {
      throw new Error(
        `${OPEN_PAGE_COMMAND} expects a page id (got "${pageId}").`,
      );
    }
    navigateTo(`${EXTENSION_PAGES_PREFIX}${pageId}`);
  },
);

const getLocation: typeof navigationApi.getLocation = () =>
  getLocationEmitter().getCurrent();

const onDidChangeLocation: typeof navigationApi.onDidChangeLocation = (
  listener: (location: Location) => void,
  thisArgs?: unknown,
): Disposable => getLocationEmitter().subscribe(listener, thisArgs);

/** Synchronizes the navigation module with React Router. Call once in the app shell. */
export const useNavigationTracker = () => {
  const location = useLocation();
  const history = useHistory();
  const prevPathname = useRef<string | null>(null);

  useEffect(() => {
    routerHistory = history;
    return () => {
      if (routerHistory === history) routerHistory = null;
    };
  }, [history]);

  useEffect(() => {
    if (prevPathname.current !== location.pathname) {
      prevPathname.current = location.pathname;
      notifyLocationChanged(location.pathname);
    }
    const current = getLocationEmitter().getCurrent();
    if (
      current.pathname !== location.pathname ||
      current.search !== location.search
    ) {
      getLocationEmitter().fire({
        pathname: location.pathname,
        search: location.search,
      });
    }
  }, [location.pathname, location.search]);
};

export const navigation: typeof navigationApi = {
  getPage,
  onDidChangePage,
  navigateTo,
  getLocation,
  onDidChangeLocation,
};
