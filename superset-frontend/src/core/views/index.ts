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
import type { views as viewsApi } from '@apache-superset/core';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { findPermission } from 'src/utils/findPermission';
import type { UserRoles } from 'src/types/bootstrapTypes';
import ExtensionPlaceholder from 'src/extensions/ExtensionPlaceholder';
import { Disposable } from '../models';
import { createEventEmitter } from '../utils';

type View = viewsApi.View;
type ViewRegisteredEvent = viewsApi.ViewRegisteredEvent;
type ViewUnregisteredEvent = viewsApi.ViewUnregisteredEvent;

type ViewOptions = viewsApi.ViewOptions;

export interface RegisteredView {
  view: View;
  location: string;
  component: ComponentType;
  options?: ViewOptions;
}

/** Host view locations outside SQL Lab (see `views.Locations` in the SDK). */
export const ViewLocations: typeof viewsApi.Locations = {
  page: 'global.page',
};

const viewRegistry: Map<string, RegisteredView> = new Map();

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

const validateOptions = (id: string, options?: ViewOptions): void => {
  const hasClass = !!options?.classPermissionName;
  const hasMethod = !!options?.methodPermissionName;
  if (hasClass !== hasMethod) {
    throw new Error(
      `View "${id}" must set both "classPermissionName" and ` +
        '"methodPermissionName", or neither.',
    );
  }
};

const registerViewImpl = (
  view: View,
  location: string,
  component: ComponentType,
  options: ViewOptions | undefined,
  ownerId: string | undefined,
): Disposable => {
  const { id } = view;

  // The registry is keyed on id, so a second registration would silently
  // replace the first (including another extension's page).
  if (viewRegistry.has(id)) {
    throw new Error(`A view with id "${id}" is already registered.`);
  }
  // A page id is one path segment of `/extensions/pages/<id>/...`.
  if (location === ViewLocations.page && !/^[^/?#%\s]+$/.test(id)) {
    throw new Error(
      `Page id "${id}" must be a single URL path segment ` +
        '(no "/", "?", "#", "%" or whitespace).',
    );
  }
  if (
    ownerId !== undefined &&
    location === ViewLocations.page &&
    !id.startsWith(`${ownerId}.`)
  ) {
    throw new Error(
      `Page id "${id}" must start with the registering extension's id ` +
        `("${ownerId}.").`,
    );
  }
  validateOptions(id, options);

  const entry: RegisteredView = { view, location, component, options };
  viewRegistry.set(id, entry);

  const ids = locationIndex.get(location) ?? new Set();
  ids.add(id);
  locationIndex.set(location, ids);
  notifyRegister({ view, location });

  return new Disposable(() => {
    // Only remove what this registration added.
    if (viewRegistry.get(id) !== entry) return;
    viewRegistry.delete(id);
    locationIndex.get(location)?.delete(id);
    notifyUnregister({ view, location });
  });
};

const registerView: typeof viewsApi.registerView = (
  view,
  location,
  component,
  options,
) => registerViewImpl(view, location, component, options, undefined);

/**
 * `registerView` bound to one extension, injected into that extension's
 * scoped `@apache-superset/core` by the loader, so a `global.page` id must
 * be prefixed with the registering extension's id. One extension can't
 * register, or take over, another's page.
 */
export const createOwnedRegisterView =
  (ownerId: string): typeof viewsApi.registerView =>
  (view, location, component, options) =>
    registerViewImpl(view, location, component, options, ownerId);

/** The registry entry for `id`, if any. Not reactive; see `useRegisteredView`. */
export const getRegisteredView = (id: string): RegisteredView | undefined =>
  viewRegistry.get(id);

/**
 * Whether a user with `roles` may see the view, per the permission it
 * declared on `registerView` (checked against bootstrap data). A view that
 * declares none is visible to any signed-in user.
 */
export const canViewPage = (
  entry: RegisteredView,
  roles: UserRoles | null | undefined,
): boolean => {
  const { classPermissionName, methodPermissionName } = entry.options ?? {};
  if (!classPermissionName || !methodPermissionName) return true;
  return findPermission(
    `can_${methodPermissionName}`,
    classPermissionName,
    roles,
  );
};

export const resolveView = (id: string): React.ReactElement => {
  const entry = viewRegistry.get(id);
  if (!entry) {
    return React.createElement(ExtensionPlaceholder, { id });
  }
  return React.createElement(ErrorBoundary, {
    key: id,
    // No JSX in a .ts file; `key` requires a props object, so `children`
    // has to travel through it too.
    // oxlint-disable-next-line no-children-prop
    children: React.createElement(entry.component),
  });
};

/**
 * Reactive lookup of a single registered view's entry (its metadata and
 * component), or `undefined` while nothing is registered under `id`.
 * Re-renders the caller when that registration changes, so a host page
 * can tell "not registered (yet)" apart from "registered" and read the
 * view's `name` without resolving it.
 */
export const useRegisteredView = (id: string): RegisteredView | undefined =>
  useSyncExternalStore(
    subscribe,
    () => viewRegistry.get(id),
    () => undefined,
  );

/**
 * Reactive counterpart to `resolveView`, for hosting a single
 * extension-registered view (see `src/pages/ExtensionPage`).
 *
 * `resolveView` reads the registry once, synchronously, at call time.
 * That's a real gap for a host page reached by direct/full navigation
 * (a bookmark or a page refresh): the
 * extension providing the view loads asynchronously (its remote entry is
 * fetched over the network), so on first render the registry is still
 * empty and a plain `resolveView` call permanently commits to the
 * "could not be loaded" placeholder, with nothing to trigger a re-render
 * once the extension actually finishes loading and registers. Subscribing
 * via `useSyncExternalStore` (the same registry-change events `useViews`
 * already subscribes to) re-renders once that registration lands.
 *
 * Built on `useRegisteredView`, so the snapshot is the registry entry
 * itself rather than a freshly `React.createElement`-ed result --
 * `useSyncExternalStore` requires a `getSnapshot` that returns a stable
 * reference when nothing changed, and the stored entry is exactly that
 * (unlike a new element object created fresh on every call).
 */
export const useResolveView = (id: string): React.ReactElement => {
  const entry = useRegisteredView(id);
  if (!entry) {
    return React.createElement(ExtensionPlaceholder, { id });
  }
  return React.createElement(ErrorBoundary, {
    key: id,
    // No JSX in a .ts file; `key` requires a props object, so `children`
    // has to travel through it too.
    // oxlint-disable-next-line no-children-prop
    children: React.createElement(entry.component),
  });
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
  Locations: ViewLocations,
  registerView,
  getViews,
  onDidRegisterView,
  onDidUnregisterView,
};
