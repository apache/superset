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
 * @fileoverview Host-side registry for extension-contributed pages.
 *
 * Mirrors `src/core/views`: module-level state, a `useSyncExternalStore`
 * subscription so a registration arriving after first render still lands, and
 * an `ExtensionPlaceholder` for a page whose component has not arrived.
 *
 * The one thing this adds is holding an extension to its manifest. A page's
 * path is declared there, which is what the server reads when it registers a
 * URL rule and checks the path against every route the deployment serves. A
 * component registered against a path the manifest does not declare has no
 * rule behind it: it would mount on client navigation and 404 on a cold load.
 * Rejecting it here keeps the two halves from disagreeing.
 */

import React, {
  ComponentType,
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import type { pages as pagesApi } from '@apache-superset/core';
import { logging } from '@apache-superset/core/utils';
import PageBoundary from './PageBoundary';
import ExtensionPlaceholder from 'src/extensions/ExtensionPlaceholder';
import { Disposable } from '../models';
import { createEventEmitter } from '../utils';

type Page = pagesApi.Page;
type ResolvedPage = pagesApi.ResolvedPage;

/**
 * A page as the server reported it: what the manifest declares, plus whether
 * this user may open it. Bound per extension by the loader.
 */
export interface DeclaredPage {
  path: string;
  /** False when the server refused the path and registered no rule for it. */
  registered?: boolean;
  permitted?: boolean;
  /** Everything else the manifest declared about the page. */
  [field: string]: unknown;
}

/** A registration that did not take, so a caller can dispose it harmlessly. */
const INERT = new Disposable(() => {});

/**
 * Mirrors `PAGE_PATH_PATTERN` in `superset_core.extensions.constants`.
 *
 * Checked again here because this is the last point before a path is handed
 * to the router, and because the message a developer sees for a malformed
 * path should arrive in the console they are already watching.
 */
const PAGE_PATH_PATTERN = /^(\/[a-z]([a-z0-9]*(-[a-z0-9]+)*)?)+$/;

const pageRegistry: Map<
  string,
  { page: ResolvedPage; component: ComponentType }
> = new Map();

const syncListeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
};

const registerEmitter = createEventEmitter<ResolvedPage>();
const unregisterEmitter = createEventEmitter<ResolvedPage>();

// `useSyncExternalStore` requires a referentially stable snapshot between
// notifications, so the array is rebuilt only when the registry changes.
let snapshot: readonly ResolvedPage[] = Object.freeze([]);
const refresh = () => {
  // Frozen rather than copied on read. `getPages` is handed to extension
  // code through the public namespace, and it is also the `getSnapshot` for
  // `useSyncExternalStore`, which compares by reference -- so returning a
  // fresh array per call would give React a new snapshot on every render and
  // never settle. Freezing gives the same protection without giving up the
  // stable identity: the pages are the host's own routing and menu input,
  // and a caller rewriting a `path` would point a live route somewhere else.
  snapshot = Object.freeze(
    Array.from(pageRegistry.values(), entry => Object.freeze(entry.page)),
  );
  syncListeners.forEach(listener => listener());
};

/**
 * Registers a page on behalf of a specific extension.
 *
 * Not part of the public API: the loader binds `extensionId` and the paths
 * that extension's manifest declares before handing the namespace to
 * extension code, so an extension can neither claim another extension's id
 * nor register a path it did not declare. See `ExtensionsLoader.loadModule`.
 */
export const registerPageFor = (
  extensionId: string,
  declared: readonly DeclaredPage[],
  page: Page,
  component: ComponentType,
): Disposable => {
  // Nothing here throws. An extension calls `registerPage` at module scope,
  // so a throw takes down the whole bundle -- its other pages, its views, its
  // commands -- over one page. Worse, one of these conditions is not the
  // author's doing at all: the server refuses a path it has already given to
  // something else, and the author cannot see that from their own source. The
  // page is dropped, loudly, and the extension carries on.
  if (!page?.path || !PAGE_PATH_PATTERN.test(page.path)) {
    logging.error(
      `Extension "${extensionId}" registered a page at ` +
        `"${page?.path ?? '<missing>'}", which is not an absolute path of ` +
        `lowercase segments such as "/review-queue". The page was ignored.`,
    );
    return INERT;
  }

  const declaration = declared.find(entry => entry.path === page.path);
  if (!declaration) {
    logging.error(
      `Extension "${extensionId}" registered a page at "${page.path}", which ` +
        `its manifest does not declare. Add it to contributions.pages and ` +
        `rebuild: the server registers URL rules from the manifest, so this ` +
        `page would work on client navigation and 404 on a cold load. ` +
        `Declared: ${declared.map(entry => entry.path).join(', ') || '(none)'}.`,
    );
    return INERT;
  }

  if (declaration.registered === false) {
    // Two causes, and from here they look the same: the path is held by
    // Superset, an operator's blueprint or another extension, or the page was
    // added to the manifest after this server started, since rules are
    // registered at boot while the extensions API re-reads the manifest every
    // request. Naming only the conflict sent an author who had just added a
    // page looking for one that does not exist, so the message names both and
    // says where the answer is.
    logging.error(
      `Extension "${extensionId}" declares a page at "${page.path}", but the ` +
        `server registered no route for it, so the page was ignored. Either ` +
        `the path is already served -- the server log names what holds it, ` +
        `and the manifest needs a different path -- or the page was added ` +
        `after the server started, in which case restart it.`,
    );
    return INERT;
  }

  const id = `${extensionId}:${page.path}`;
  // Registered whether or not the user may open it, so that the component is
  // there to render a refusal rather than a blank screen, and so an
  // extension's own bundle never has to branch on permissions.
  //
  // The manifest's own fields come first, so a page that declares `nav` or
  // `name` there does not have to repeat them in code to be seen. They are
  // only defaults: anything the registration passes wins, because that is the
  // call the author wrote.
  const {
    path: _path,
    registered: _registered,
    permitted,
    ...declaredFields
  } = declaration;
  const resolved: ResolvedPage = {
    ...(declaredFields as Partial<Page>),
    ...page,
    extensionId,
    permitted: permitted !== false,
  };

  const replaced = pageRegistry.get(id);
  if (replaced) {
    // Within one extension only -- ids carry the extension, and the server
    // has already refused a path two extensions both declare. Silent
    // replacement would make the first registration stop rendering with
    // nothing said about it.
    logging.warn(
      `Page "${id}" is already registered; it has been replaced and the ` +
        `earlier component no longer renders.`,
    );
  }

  const entry = { page: resolved, component };
  pageRegistry.set(id, entry);
  refresh();
  registerEmitter.fire(resolved);

  return new Disposable(() => {
    // Only while this registration still holds the id: disposing one that has
    // since been replaced would remove the replacement instead.
    if (pageRegistry.get(id) !== entry) {
      return;
    }
    pageRegistry.delete(id);
    refresh();
    unregisterEmitter.fire(resolved);
  });
};

export const getPages = (): readonly ResolvedPage[] => snapshot;

export const usePages = (): readonly ResolvedPage[] =>
  useSyncExternalStore(subscribe, getPages, getPages);

/** The page registered for a path, or undefined when nothing claims it. */
export const findPageByPath = (path: string): ResolvedPage | undefined =>
  // Longest match, not the first registered. `/reports` and
  // `/reports/archive` can both claim `/reports/archive`, and taking the
  // first leaves the deeper page unreachable whenever it happens to be
  // registered second -- which is load order, not anything an author
  // controls. The server resolves the same way, because Werkzeug prefers the
  // rule with more static segments.
  snapshot
    .filter(page => path === page.path || path.startsWith(`${page.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];

/**
 * The root path of the page currently rendering.
 *
 * Supplied by the host when it mounts a page, so `useSubPath`/`useNavigate`
 * can work in paths relative to that page without the page knowing its own
 * URL. Defaults to empty, which makes both hooks inert rather than wrong if
 * they are somehow called outside a page.
 */
export const PageRootContext = createContext<string>('');

/**
 * The host's own router is read here, inside the host bundle.
 *
 * An extension cannot do this for itself: `react-router-dom` is not in the
 * share scope, so an extension's import resolves to a second module instance
 * whose context is never populated by the host's `<Router>`. Exposing these
 * two hooks through `@apache-superset/core`, which *is* shared, is what lets
 * a page navigate at all.
 */
export const useSubPath: typeof pagesApi.useSubPath = () => {
  const root = useContext(PageRootContext);
  const { pathname } = useLocation();
  if (!root) {
    return '/';
  }
  // `useLocation` reports a path the router has already stripped of the app
  // root, so stripping again is wrong rather than merely redundant: it would
  // eat a real first segment wherever a page path happens to begin with the
  // same one, leaving the page unable to read its own sub-path.
  const stripped = pathname;
  const sub = stripped.startsWith(root) ? stripped.slice(root.length) : '';
  return sub.startsWith('/') ? sub : `/${sub}`;
};

export const useNavigate: typeof pagesApi.useNavigate = () => {
  const root = useContext(PageRootContext);
  const history = useHistory();
  return useCallback(
    (subPath: string) => {
      if (!root) {
        return;
      }
      // Relative by contract: a page states where it is going within itself.
      const suffix = subPath.startsWith('/') ? subPath : `/${subPath}`;
      // No `ensureAppRoot` here. Superset's router is mounted as
      // `<BrowserRouter basename={applicationRoot()}>`, so it adds the app
      // root on push and strips it from `location.pathname`. Adding it here
      // too produced `/root/root/page` under a subdirectory deployment --
      // invisible wherever the app root is empty, which is most deployments.
      const target = `${root}${suffix === '/' ? '' : suffix}`;
      // `history.push` keeps `..` verbatim, while the browser's URL parser
      // resolves it out of the address bar on `pushState`. An unnormalised
      // target therefore leaves the router and the URL disagreeing, and
      // enough `..` climbs past the router's basename as well. Parsing with
      // the same algorithm the browser applies keeps the check from drifting
      // from what the address bar will do, and covers `%2E%2E` with it.
      // The base is a constant so the parse is deterministic in tests, as in
      // `src/utils/navigationUtils.ts`.
      const resolved = new URL(target, 'http://pages.invalid');
      if (
        resolved.pathname !== root &&
        !resolved.pathname.startsWith(`${root}/`)
      ) {
        logging.error(
          `A page at "${root}" tried to navigate to "${subPath}", which ` +
            `resolves outside the page. Sub-paths are relative to the page ` +
            `root; the navigation was ignored.`,
        );
        return;
      }
      // `search` and `hash` are re-appended: `history.push` parses them off a
      // whole path string, so pushing `pathname` alone would quietly drop the
      // query and fragment from `navigate('/42?tab=x#y')`.
      history.push(`${resolved.pathname}${resolved.search}${resolved.hash}`);
    },
    [history, root],
  );
};

export const resolvePage = (id: string): React.ReactElement => {
  const entry = pageRegistry.get(id);
  if (!entry) {
    return React.createElement(ExtensionPlaceholder, { id });
  }
  // `PageBoundary` keys itself by page id, so one page's crash cannot follow
  // the user to another, and offers a retry and a reset on moving within the
  // page -- neither of which `ErrorBoundary` can do on its own.
  return React.createElement(
    PageBoundary,
    { key: id, id },
    React.createElement(
      PageRootContext.Provider,
      { value: entry.page.path },
      React.createElement(entry.component),
    ),
  );
};

// `thisArgs` is part of `Event<T>`, and `subscribe` binds it. Dropping it here
// would leave `pages.onDidRegisterPage(controller.addPage, controller)` --
// which the type invites -- calling `addPage` unbound.
export const onDidRegisterPage = (
  listener: (e: ResolvedPage) => void,
  thisArgs?: unknown,
) => registerEmitter.subscribe(listener, thisArgs);

export const onDidUnregisterPage = (
  listener: (e: ResolvedPage) => void,
  thisArgs?: unknown,
) => unregisterEmitter.subscribe(listener, thisArgs);

/**
 * The namespace handed to extension code, with `registerPage` unbound.
 *
 * The loader replaces `registerPage` per extension; this shape exists so the
 * host's own `window.superset.pages` is complete and type-compatible.
 */
export const pages = {
  useSubPath,
  useNavigate,
  registerPage: (() => {
    throw new Error(
      'pages.registerPage is bound per extension by the loader and cannot ' +
        'be called on the host namespace directly.',
    );
  }) as unknown as typeof pagesApi.registerPage,
  getPages,
  onDidRegisterPage,
  onDidUnregisterPage,
} as unknown as typeof pagesApi;
