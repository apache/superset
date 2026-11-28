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
import { t } from '@apache-superset/core/translation';
import type { navigation as navigationApi } from '@apache-superset/core';
import {
  ensureAppRoot,
  redirect,
  stripAppRoot,
} from '../../utils/navigationUtils';
import { RoutePaths } from '../../views/routePaths';
import { registerCommand as commandsRegisterCommand } from '../commands';
import { Disposable } from '../models';
import { createValueEventEmitter } from '../utils';

type Page = navigationApi.Page;
type AppLocation = navigationApi.AppLocation;

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
];

function derivePage(pathname: string): Page {
  for (const { path, page } of PAGE_ROUTES) {
    if (matchPath(pathname, { path, exact: false })) return page;
  }
  // A contributed page sits behind a catch-all route, so no entry above can
  // match one and the fallback used to call it `'home'`: an extension asking
  // where the user was got the welcome screen, and a move from Home to a
  // contributed page changed nothing and so fired nothing at all.
  //
  // One prefix answers it, the host's own, so this needs no registry lookup
  // and cannot disagree with the router about which paths belong to a page.
  // It is the address that is asked, not what is registered against it: a
  // page whose bundle has not arrived, or whose registration was disposed,
  // leaves "page not found" at an address that is still an extension page.
  if (pathname.startsWith('/extensions/pages/')) return 'extension';
  return 'home';
}

// Seeded from the address the app was loaded at, so a cold load onto a
// contributed page reports `'extension'` without waiting for a navigation.
//
// Rooted away first. Every later value comes from the router, whose
// `basename` is the application root, so `location.pathname` there is already
// relative to it. `window.location.pathname` is not: on a deployment served
// under a prefix the raw path still carries it, and an `AppLocation` that
// sometimes includes the root and sometimes does not is one a page cannot
// strip its own id from. `derivePage` would miss the page prefix too, and
// report `'home'` for a contributed page on a cold load.
const initialPathname = stripAppRoot(window.location.pathname);

const pageEmitter = createValueEventEmitter<Page>(derivePage(initialPathname));

const locationEmitter = createValueEventEmitter<AppLocation>({
  pathname: initialPathname,
  search: window.location.search,
});

/** Updates the current page from a pathname. No-op when the page is unchanged. */
export const notifyLocationChanged = (pathname: string, search = ''): void => {
  // Fired for every change, including one that leaves the surface alone:
  // moving between two addresses inside one page is the move a page itself
  // most needs to hear about, and `getPage` reports both as `'extension'`.
  locationEmitter.fire({ pathname, search });
  // Which contributed page is open is a finer question than the surface
  // this module reports: two contributed pages are both `'extension'` here,
  // so moving between them changes nothing below. That move is reported by
  // `onDidChangeLocation` above, which is why the location is fired first
  // and unconditionally, and the page only when the surface changes.
  const next = derivePage(pathname);
  if (next === pageEmitter.getCurrent()) {
    return;
  }
  pageEmitter.fire(next);
};

const getPage: typeof navigationApi.getPage = () => pageEmitter.getCurrent();

const onDidChangePage: typeof navigationApi.onDidChangePage = (
  listener: (page: Page) => void,
  thisArgs?: unknown,
): Disposable => pageEmitter.subscribe(listener, thisArgs);

/**
 * The id of the host command that opens a contributed page.
 *
 * Public, so a keybinding or a menu item at any location can open a page
 * without going through the navbar. A `page` menu item's click handler is
 * this command, which is why the item can stay declarative: the host has a
 * static target to render a real link from.
 */
export const OPEN_PAGE_COMMAND = 'core.navigation.openPage';

/**
 * The host's own history, handed over by the app shell.
 *
 * Held rather than imported because there is one router and it belongs to
 * the host: an extension that imported `react-router-dom` would get a second
 * instance whose context the host's `<Router>` never populates.
 */
let history: { push: (path: string) => void } | undefined;

/** Called once by the app shell, with the router's own history. */
export const setNavigationHistory = (next: typeof history): void => {
  history = next;
};

const getLocation: typeof navigationApi.getLocation = () =>
  locationEmitter.getCurrent();

const onDidChangeLocation: typeof navigationApi.onDidChangeLocation = (
  listener: (location: AppLocation) => void,
  thisArgs?: unknown,
): Disposable => locationEmitter.subscribe(listener, thisArgs);

/**
 * The prefix the deployment is served under, or `''` at a domain root.
 *
 * Through `ensureAppRoot`, which is the sanctioned reader of the root --
 * `navigationUtils.invariants.test.ts` rejects a direct `applicationRoot()`
 * call from here. Passing `null` asks it for the root alone, which it reports
 * as `'/'` when there is none; `''` is the more useful answer for a caller
 * building a path by concatenation.
 */
const getApplicationRoot: typeof navigationApi.getApplicationRoot = () => {
  const root = ensureAppRoot(null);
  return root === '/' ? '' : root;
};

const navigateTo: typeof navigationApi.navigateTo = (path: string): void => {
  if (!history) {
    // Before the shell has handed its history over there is no router to
    // push onto. A full load is the honest fallback: it reaches the same
    // address, just without the transition.
    //
    // Through `redirect`, which is the one sanctioned way out of this
    // module -- it applies the application root and the scheme guard, and
    // `navigationUtils.invariants.test.ts` rejects a direct
    // `window.location` call from here. The raw path is passed because
    // `redirect` roots it itself; rooting it twice would double the prefix
    // on a subdirectory deployment.
    redirect(path);
    return;
  }
  history.push(path);
};

/** Synchronizes the navigation module with React Router. Call once in the app shell. */
export const useNavigationTracker = () => {
  const history = useHistory();
  const location = useLocation();

  // Handed over rather than imported: there is one router and it is the
  // host's. Done in an effect-free assignment so a `navigateTo` fired from a
  // command handler during the first render still finds it.
  setNavigationHistory(history);

  useEffect(
    () =>
      commandsRegisterCommand(
        {
          id: OPEN_PAGE_COMMAND,
          title: t('Open page'),
          description: t('Opens a page contributed by an extension.'),
        },
        (pageId: string) => navigateTo(`/extensions/pages/${pageId}`),
      ).dispose,
    [],
  );
  // Both, because a page can move between two of its own addresses by query
  // string alone, and that is a navigation the page itself has to hear.
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const current = `${location.pathname}${location.search}`;
    if (previous.current !== current) {
      previous.current = current;
      notifyLocationChanged(location.pathname, location.search);
    }
  }, [location.pathname, location.search]);
};

export const navigation: typeof navigationApi = {
  getPage,
  onDidChangePage,
  getLocation,
  onDidChangeLocation,
  navigateTo,
  getApplicationRoot,
  appRoot: ensureAppRoot,
};
