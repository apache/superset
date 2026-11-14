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
 * id is declared there, and that declaration is what the server reads to
 * decide whether to answer `/extensions/pages/<id>` and who may open it. A
 * component registered under an id the manifest does not declare has nothing
 * guarding it: it would mount on client navigation while the server knows
 * nothing of it. Rejecting it here keeps the two halves from disagreeing.
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
import { createEventEmitter, createValueEventEmitter } from '../utils';

type Page = pagesApi.Page;
type ResolvedPage = pagesApi.ResolvedPage;

/**
 * A page as the server reported it: what the manifest declares, plus whether
 * this user may open it. Bound per extension by the loader.
 */
export interface DeclaredPage {
  /** The view id the manifest declares, which the page registers under. */
  id: string;
  permitted?: boolean;
  /** Everything else the manifest declared about the page. */
  [field: string]: unknown;
}

/** A registration that did not take, so a caller can dispose it harmlessly. */
const INERT = new Disposable(() => {});

/**
 * Where the host serves a page.
 *
 * Formed from the id rather than declared by the extension: a page names
 * itself and the host decides where it lives, which is what stops a page
 * landing on a route Superset already answers.
 */
export const pageUrl = (id: string): string => `/extensions/pages/${id}`;

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
/** The page registered under an id, or undefined when nothing claims it. */
export const findPageById = (id: string): ResolvedPage | undefined =>
  snapshot.find(page => page.id === id);

const currentPageEmitter = createValueEventEmitter<ResolvedPage | undefined>(
  undefined,
);
let currentPathname: string | null = null;

/**
 * The page a pathname is showing, or undefined for anything else.
 *
 * One prefix answers it, so this cannot disagree with the router the way a
 * longest-match over author-chosen paths could.
 */
const findPageForPathname = (pathname: string): ResolvedPage | undefined => {
  const prefix = '/extensions/pages/';
  if (!pathname.startsWith(prefix)) {
    return undefined;
  }
  const [id] = pathname.slice(prefix.length).split('/');
  return id ? findPageById(id) : undefined;
};

const recomputeCurrentPage = (): void => {
  const next =
    currentPathname === null ? undefined : findPageForPathname(currentPathname);
  if (next === currentPageEmitter.getCurrent()) {
    return;
  }
  currentPageEmitter.fire(next);
};

const refresh = () => {
  // Frozen rather than copied on read. `getPages` is handed to extension
  // code through the public namespace, and it is also the `getSnapshot` for
  // `useSyncExternalStore`, which compares by reference -- so returning a
  // fresh array per call would give React a new snapshot on every render and
  // never settle. Freezing gives the same protection without giving up the
  // stable identity: the pages are the host's own routing and menu input,
  // and a caller rewriting an `id` would point a live route somewhere else.
  snapshot = Object.freeze(
    Array.from(pageRegistry.values(), entry => Object.freeze(entry.page)),
  );
  // Registering a page can make it the current one -- an extension whose
  // bundle lands while the user is already sitting on its URL is the normal
  // case -- and unregistering can take that away. Recomputed from the
  // rebuilt snapshot, so the lookup sees the registration that caused it.
  recomputeCurrentPage();
  syncListeners.forEach(listener => listener());
};

/**
 * Registers a page on behalf of a specific extension.
 *
 * Not part of the public API: the loader binds `extensionId` and the page
 * ids that extension's manifest declares before handing the namespace to
 * extension code, so an extension can neither claim another extension's id
 * nor register one it did not declare. See `ExtensionsLoader.loadModule`.
 */
export const registerPageFor = (
  extensionId: string,
  declared: readonly DeclaredPage[],
  page: Page,
  component: ComponentType,
): Disposable => {
  // Nothing here throws. An extension registers its pages at module scope,
  // so a throw takes down the whole bundle -- its other pages, its views,
  // its commands -- over one page. Both conditions below are the author's
  // own doing and visible in their own source, now that the host forms a
  // page's address and no registration can be refused for a path somebody
  // else already holds. The page is dropped, loudly, and the extension
  // carries on.
  if (!page?.id || !page.id.startsWith(`${extensionId}.`)) {
    logging.error(
      `Extension "${extensionId}" registered a page as ` +
        `"${page?.id ?? '<missing>'}". A page id must begin with the ` +
        `extension's own id, so that no extension can claim or overwrite ` +
        `another's page. The page was ignored.`,
    );
    return INERT;
  }

  const declaration = declared.find(entry => entry.id === page.id);
  if (!declaration) {
    logging.error(
      `Extension "${extensionId}" registered a page "${page.id}", which its ` +
        `manifest does not declare. Add it to contributions.pages and ` +
        `rebuild: the manifest is what tells the server which permission ` +
        `guards the page. ` +
        `Declared: ${declared.map(entry => entry.id).join(', ') || '(none)'}.`,
    );
    return INERT;
  }

  const { id } = page;
  // Registered whether or not the user may open it, so that the component is
  // there to render a refusal rather than a blank screen, and so an
  // extension's own bundle never has to branch on permissions.
  //
  // The manifest's own fields come first, so a page that declares `nav` or
  // `name` there does not have to repeat them in code to be seen. They are
  // only defaults: anything the registration passes wins, because that is the
  // call the author wrote.
  const { id: _id, permitted, ...declaredFields } = declaration;
  const resolved: ResolvedPage = {
    ...(declaredFields as Partial<Page>),
    ...page,
    extensionId,
    permitted: permitted !== false,
  };

  const replaced = pageRegistry.get(id);
  if (replaced) {
    // Within one extension only, because a page id has to begin with its
    // extension's own id -- checked above, and by the server, so a page
    // another extension merely named reaches neither half. Silent
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
      { value: pageUrl(entry.page.id) },
      React.createElement(entry.component),
    ),
  );
};

// `thisArgs` is part of `Event<T>`, and `subscribe` binds it. Dropping it here
// would leave `pages.onDidRegisterPage(controller.addPage, controller)` --
// which the type invites -- calling `addPage` unbound.
/**
 * Tells the registry where the user is. Called by the navigation tracker.
 *
 * Not public: an extension observes the current page, it does not set it.
 */
export const notifyPathnameChanged = (pathname: string): void => {
  currentPathname = pathname;
  recomputeCurrentPage();
};

export const getCurrentPage = (): ResolvedPage | undefined =>
  currentPageEmitter.getCurrent();

export const onDidChangeCurrentPage = (
  listener: (page: ResolvedPage | undefined) => void,
  thisArgs?: unknown,
) => currentPageEmitter.subscribe(listener, thisArgs);

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
  getCurrentPage,
  onDidChangeCurrentPage,
  getPages,
  onDidRegisterPage,
  onDidUnregisterPage,
} as unknown as typeof pagesApi;
