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
 * @fileoverview Standalone views registry implementation.
 *
 * Stores view metadata and providers as module-level state.
 * Extensions register views as side effects at import time.
 */

import React, { ComponentType, useSyncExternalStore } from 'react';
import { logging } from '@apache-superset/core/utils';
import type { views as viewsApi } from '@apache-superset/core';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import ExtensionPlaceholder from 'src/extensions/ExtensionPlaceholder';
import { Disposable } from '../models';
import { createEventEmitter } from '../utils';

type View = viewsApi.View;
type ViewRegisteredEvent = viewsApi.ViewRegisteredEvent;
type ViewUnregisteredEvent = viewsApi.ViewUnregisteredEvent;
type ViewOptions = viewsApi.ViewOptions;

const viewRegistry: Map<
  string,
  {
    view: View;
    location: string;
    component: ComponentType<any>;
    options?: ViewOptions;
  }
> = new Map();

const locationIndex: Map<string, Set<string>> = new Map();

const syncListeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
};

const registerEmitter = createEventEmitter<ViewRegisteredEvent>();
const unregisterEmitter = createEventEmitter<ViewUnregisteredEvent>();

const viewsCache = new Map<string, View[] | undefined>();
const notifyRegister = (event: ViewRegisteredEvent) => {
  viewsCache.clear();
  syncListeners.forEach(l => l());
  registerEmitter.fire(event);
};
const notifyUnregister = (event: ViewUnregisteredEvent) => {
  viewsCache.clear();
  syncListeners.forEach(l => l());
  unregisterEmitter.fire(event);
};

/**
 * The reserved location that marks a view as a top-level page.
 *
 * A page carries no path. The host serves it at `/extensions/pages/<id>`,
 * which is why nothing here has to reason about one page shadowing another or
 * a host screen: an extension names the page, not the address.
 *
 * It is an ordinary location in every other respect. A page lives in
 * `viewRegistry` like any other view, and `getViews` and `onDidRegisterView`
 * report it -- which is what lets the page host and a navbar item resolve the
 * same registration, reactively, without a second registry keeping its own
 * copy of the same state.
 */
export const PAGE_LOCATION = 'global.page';

/**
 * Refuses a page id that the host's own route could never match.
 *
 * A page is served from `/extensions/pages/:pageId`, which matches a single
 * path segment. An id carrying a separator registers happily and takes a
 * navigation entry, and then the route never matches it -- so the page
 * renders not-found for ever, with nothing to say why.
 *
 * Only at the page location, because only there does the id become part of
 * an address.
 */
const assertUsableAsPathSegment = (id: string, location: string): void => {
  if (location !== PAGE_LOCATION) {
    return;
  }
  const unusable = /[/?#%]/.exec(id);
  if (unusable) {
    throw new Error(
      `Page "${id}" contains "${unusable[0]}". A page id is one path ` +
        `segment of "/extensions/pages/<id>", so a separator in it leaves ` +
        `an id the route cannot match and a page that never opens.`,
    );
  }
};

/**
 * Refuses a permission that cannot do what the author means by it.
 *
 * Throwing is the unusual choice here -- registration is a module side
 * effect, so this takes the extension's whole bundle down, its other views
 * and commands with it. It is the right one anyway, because every case below
 * is the author's own typo, visible in their own source, deterministic, and
 * caught the first time the bundle loads. The alternative failure is an
 * ungated surface that looks gated, which nobody finds until it matters.
 */
const assertUsableOptions = (
  id: string,
  location: string,
  options?: ViewOptions,
): void => {
  if (!options?.classPermissionName && !options?.methodPermissionName) {
    return;
  }
  if (location !== PAGE_LOCATION) {
    throw new Error(
      `View "${id}" was registered at "${location}" with a permission, but ` +
        `only a page -- a view at "${PAGE_LOCATION}" -- is gated by one. ` +
        `Nothing would check it here, so the view would look guarded and ` +
        `not be. Gate the data instead, on the endpoint behind it.`,
    );
  }
  if (!options.classPermissionName || !options.methodPermissionName) {
    throw new Error(
      `Page "${id}" names only half a permission. Both ` +
        `classPermissionName and methodPermissionName are needed: together ` +
        `they are one permission -- can_<method> on <class> -- and either ` +
        `alone matches nothing.`,
    );
  }
  if (options.methodPermissionName.startsWith('can_')) {
    throw new Error(
      `Page "${id}" names methodPermissionName ` +
        `"${options.methodPermissionName}", which already carries the ` +
        `"can_" prefix the host adds. It would be checked as ` +
        `"can_${options.methodPermissionName}", which no permission is ` +
        `called, so the page would refuse everyone. Drop the prefix.`,
    );
  }
};

export const registerView: typeof viewsApi.registerView = <Props>(
  view: View,
  location: string,
  component: ComponentType<Props>,
  options?: ViewOptions,
): Disposable => {
  const { id } = view;

  assertUsableAsPathSegment(id, location);
  assertUsableOptions(id, location, options);

  // Ids are the registry's keys, so a second registration under one id
  // replaces the first. Warned and overwritten, which is the policy
  // `registerCommand` has: a view and a command behave the same way on a
  // duplicate id.
  //
  // The location index is cleared of the replaced entry as well. It is a
  // separate map, so leaving the old id behind leaves a location reporting a
  // view that is no longer registered there -- and at `global.page` that is
  // not merely stale: the page host resolves the id and would render the
  // replacement, which sits at another location and is therefore not gated
  // by the page's permission.
  const previous = viewRegistry.get(id);
  if (previous) {
    logging.warn(
      `View "${id}" is already registered. Overwriting the existing view.`,
    );
    locationIndex.get(previous.location)?.delete(id);
  }

  const entry = { view, location, component, options };
  viewRegistry.set(id, entry);

  const ids = locationIndex.get(location) ?? new Set();
  ids.add(id);
  locationIndex.set(location, ids);
  notifyRegister({ view, location });

  return new Disposable(() => {
    // Only if this registration still holds the id. Disposing one that has
    // since been replaced would remove the replacement instead, so an
    // extension tearing down its own view would take another's with it.
    if (viewRegistry.get(id) !== entry) {
      return;
    }
    viewRegistry.delete(id);
    locationIndex.get(location)?.delete(id);
    notifyUnregister({ view, location });
  });
};

/**
 * The permission a registered view named, if it named one.
 *
 * Host-internal: it is not on the `views` object an extension receives,
 * because an extension states its own page's permission and has no business
 * reading another's.
 */
export const getViewOptions = (id: string): ViewOptions | undefined =>
  viewRegistry.get(id)?.options;

/**
 * Renders the component registered under `id`, inside an error boundary.
 *
 * `props` is forwarded to that component. Locations that render once per item
 * -- a list view's rows -- use it to say which item is being rendered, which
 * the component has no other way to know.
 */
export const resolveView = (
  id: string,
  props?: Record<string, unknown>,
): React.ReactElement => {
  const entry = viewRegistry.get(id);
  if (!entry) {
    return React.createElement(ExtensionPlaceholder, { id });
  }
  return React.createElement(
    ErrorBoundary,
    null,
    React.createElement(entry.component, props),
  );
};

const getViews: typeof viewsApi.getViews = (
  location: string,
): View[] | undefined => {
  const ids = locationIndex.get(location);
  if (!ids || ids.size === 0) return undefined;

  return Array.from(ids)
    .map(id => viewRegistry.get(id)?.view)
    .filter((c): c is View => !!c);
};

export const useViews = (location: string): View[] | undefined =>
  useSyncExternalStore(
    subscribe,
    () => {
      if (!viewsCache.has(location)) {
        viewsCache.set(location, getViews(location));
      }
      return viewsCache.get(location);
    },
    () => undefined,
  );

export const onDidRegisterView: typeof viewsApi.onDidRegisterView = (
  listener: (e: ViewRegisteredEvent) => void,
): Disposable => registerEmitter.subscribe(listener);

export const onDidUnregisterView: typeof viewsApi.onDidUnregisterView = (
  listener: (e: ViewUnregisteredEvent) => void,
): Disposable => unregisterEmitter.subscribe(listener);

export const views: typeof viewsApi = {
  registerView,
  getViews,
  PAGE_LOCATION,
  onDidRegisterView,
  onDidUnregisterView,
};
