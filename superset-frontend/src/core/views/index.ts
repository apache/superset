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
 * Stores view and view container metadata as module-level state. Extensions
 * register both as side effects at import time.
 *
 * Mirrors VS Code's `viewsContainers` + `views`: a container (registered via
 * `registerViewContainer`) is a slot — e.g. an icon in a rail-style
 * sidebar's icon strip — with no content of its own. Views register into it
 * via the ordinary `registerView`, using the container's `id` as their
 * `location`. A rail-style host therefore needs no bespoke registration
 * function of its own: it reads `getViewContainers(location)` for the strip
 * and `getViews(containerId)` for that container's content.
 */

import React, { ComponentType, useSyncExternalStore } from 'react';
import type { views as viewsApi } from '@apache-superset/core';
import { logging } from '@apache-superset/core/utils';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import ExtensionPlaceholder from 'src/extensions/ExtensionPlaceholder';
import { ViewLocations } from 'src/SqlLab/contributions';
import { Disposable } from '../models';
import { createEventEmitter } from '../utils';

type View = viewsApi.View;
export type ViewContainer = viewsApi.ViewContainer;
type ViewRegisteredEvent = viewsApi.ViewRegisteredEvent;
type ViewUnregisteredEvent = viewsApi.ViewUnregisteredEvent;

/**
 * The closed set of built-in locations the host itself knows how to render,
 * independent of any container an extension might register at runtime.
 * `registerView` accepts a `location` in this set, or the id of a
 * currently-registered container; `registerViewContainer` refuses an id
 * that collides with one of these.
 */
const STATIC_LOCATIONS: ReadonlySet<string> = new Set(
  Object.values(ViewLocations).flatMap(group => Object.values(group)),
);

const viewRegistry: Map<
  string,
  { view: View; location: string; component: ComponentType }
> = new Map();

const locationIndex: Map<string, Set<string>> = new Map();

/** Sort weight applied to containers that declare no explicit `order`. */
const DEFAULT_CONTAINER_ORDER = 100;

interface ViewContainerRegistration {
  container: ViewContainer;
  location: string;
}

const containerRegistry: Map<string, ViewContainerRegistration> = new Map();
const containerLocationIndex: Map<string, Set<string>> = new Map();

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
 * Referentially stable empty snapshot. `useSyncExternalStore` compares
 * snapshots with Object.is, so returning a fresh `[]` would re-render
 * forever.
 */
const NO_CONTAINERS: ViewContainer[] = [];

const containersCache = new Map<string, ViewContainer[]>();
const notifyContainers = () => {
  containersCache.clear();
  syncListeners.forEach(l => l());
};

/**
 * Deterministic render order: ascending `order`, then ascending `id`, so
 * the strip order is identical on every page load regardless of which
 * extension's bundle happened to finish loading first.
 */
const byRenderOrder = (a: ViewContainer, b: ViewContainer) =>
  (a.order ?? DEFAULT_CONTAINER_ORDER) - (b.order ?? DEFAULT_CONTAINER_ORDER) ||
  a.id.localeCompare(b.id);

const isKnownLocation = (location: string): boolean =>
  STATIC_LOCATIONS.has(location) || containerRegistry.has(location);

const registerView: typeof viewsApi.registerView = (
  view: View,
  location: string,
  component: ComponentType,
): Disposable => {
  if (!isKnownLocation(location)) {
    logging.warn(
      `[Superset] Cannot register view "${view.id}" at unknown location ` +
        `"${location}". Register a view container with this id first (see ` +
        "registerViewContainer), or use one of the host's built-in locations.",
    );
    return new Disposable(() => {});
  }

  const { id } = view;

  viewRegistry.set(id, { view, location, component });

  const ids = locationIndex.get(location) ?? new Set();
  ids.add(id);
  locationIndex.set(location, ids);
  notifyRegister({ view, location });

  return new Disposable(() => {
    viewRegistry.delete(id);
    locationIndex.get(location)?.delete(id);
    notifyUnregister({ view, location });
  });
};

export const resolveView = (id: string): React.ReactElement => {
  const entry = viewRegistry.get(id);
  if (!entry) {
    return React.createElement(ExtensionPlaceholder, { id });
  }
  return React.createElement(
    ErrorBoundary,
    null,
    React.createElement(entry.component),
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

const registerViewContainer: typeof viewsApi.registerViewContainer = (
  location: string,
  container: ViewContainer,
): Disposable => {
  const { id } = container;

  if (STATIC_LOCATIONS.has(id)) {
    logging.warn(
      `[Superset] A view container cannot use id "${id}" — it collides ` +
        "with one of the host's built-in location names. Choose a " +
        'different id.',
    );
    return new Disposable(() => {});
  }

  const existing = containerRegistry.get(id);
  if (existing) {
    // First registration wins. Overwriting would silently swap the trigger
    // behind an icon the user may already have open, and — because
    // extensions load in parallel — which registration won would vary
    // between loads.
    logging.warn(
      `[Superset] A view container with id "${id}" is already registered ` +
        `("${existing.container.name}"). Ignoring the registration of ` +
        `"${container.name}".`,
    );
    return new Disposable(() => {});
  }

  containerRegistry.set(id, { container, location });
  const ids = containerLocationIndex.get(location) ?? new Set();
  ids.add(id);
  containerLocationIndex.set(location, ids);
  notifyContainers();

  return new Disposable(() => {
    // Identity guard: makes double-dispose, and dispose after a reset, no-ops.
    if (containerRegistry.get(id)?.container !== container) return;
    containerRegistry.delete(id);
    containerLocationIndex.get(location)?.delete(id);
    notifyContainers();
  });
};

const getViewContainers: typeof viewsApi.getViewContainers = (
  location: string,
): ViewContainer[] => {
  const ids = containerLocationIndex.get(location);
  if (!ids || ids.size === 0) return NO_CONTAINERS;

  return Array.from(ids)
    .map(id => containerRegistry.get(id)?.container)
    .filter((c): c is ViewContainer => !!c)
    .sort(byRenderOrder);
};

/**
 * Host-internal hook. Returns every view container registered at
 * `location`, in render order. The array identity is stable until a
 * container at this location is registered or unregistered.
 */
export const useViewContainers = (location: string): ViewContainer[] =>
  useSyncExternalStore(
    subscribe,
    () => {
      if (!containersCache.has(location)) {
        containersCache.set(location, getViewContainers(location));
      }
      return containersCache.get(location) ?? NO_CONTAINERS;
    },
    () => NO_CONTAINERS,
  );

/**
 * Host-internal, test-only. Clears both registries, every memoized
 * snapshot, and all subscribers. Not exposed on `window.superset`.
 */
export const resetViews = (): void => {
  viewRegistry.clear();
  locationIndex.clear();
  viewsCache.clear();
  containerRegistry.clear();
  containerLocationIndex.clear();
  containersCache.clear();
  syncListeners.clear();
};

export const views: typeof viewsApi = {
  registerView,
  getViews,
  onDidRegisterView,
  onDidUnregisterView,
  registerViewContainer,
  getViewContainers,
};
