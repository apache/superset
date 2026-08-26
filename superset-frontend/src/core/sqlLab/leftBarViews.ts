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
 * @fileoverview Host implementation of SQL Lab's left sidebar view registry.
 *
 * Extensions register via the public `sqlLab.registerLeftBarView()` and the
 * host owns the icon strip, selection, and mounting. Registration happens as
 * a module-level side effect at extension import time, so state lives at
 * module scope (as in `../views`) rather than in a provider class.
 *
 * Unlike `../views`, the rendered order is derived from the descriptors
 * (`order`, then `id`) rather than from insertion order: extensions are
 * loaded in parallel by ExtensionsLoader, so insertion order varies between
 * page loads and would shuffle the icon strip.
 *
 * `useLeftBarViews` and `useLeftBarView` are host-internal and NOT part of
 * the public `@apache-superset/core` API.
 */

import { ComponentType, useSyncExternalStore } from 'react';
import type { sqlLab as sqlLabApi } from '@apache-superset/core';
import { logging } from '@apache-superset/core/utils';
import { Disposable } from '../models';

type LeftBarView = sqlLabApi.LeftBarView;

/** A view descriptor together with the components it was registered with. */
export interface LeftBarViewRegistration {
  view: LeftBarView;
  trigger: ComponentType;
  panel: ComponentType;
}

/** Sort weight applied to views that declare no explicit `order`. */
const DEFAULT_ORDER = 100;

/**
 * Referentially stable empty snapshot. `useSyncExternalStore` compares
 * snapshots with Object.is, so returning a fresh `[]` would re-render forever.
 */
const NO_VIEWS: LeftBarView[] = [];

/** id -> registration. Insertion order is deliberately not relied upon. */
const registry = new Map<string, LeftBarViewRegistration>();

const syncListeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
};

/** Memoized sorted snapshot; invalidated on every registry mutation. */
let snapshot: LeftBarView[] | undefined;

/**
 * Deterministic render order: ascending `order`, then ascending `id`. Both
 * keys come from the manifest, so the order does not depend on which
 * extension's bundle happened to load first.
 */
const byRenderOrder = (a: LeftBarView, b: LeftBarView) =>
  (a.order ?? DEFAULT_ORDER) - (b.order ?? DEFAULT_ORDER) ||
  a.id.localeCompare(b.id);

const getSnapshot = (): LeftBarView[] => {
  if (!snapshot) {
    snapshot =
      registry.size === 0
        ? NO_VIEWS
        : Array.from(registry.values(), entry => entry.view).sort(
            byRenderOrder,
          );
  }
  return snapshot;
};

const getRegistrationSnapshot = (id: string) => registry.get(id);

const getUndefined = () => undefined;

const notify = () => {
  snapshot = undefined;
  syncListeners.forEach(listener => listener());
};

export const registerLeftBarView: typeof sqlLabApi.registerLeftBarView = (
  view: LeftBarView,
  trigger: ComponentType,
  panel: ComponentType,
): Disposable => {
  const existing = registry.get(view.id);
  if (existing) {
    // First registration wins. Overwriting would silently swap the panel
    // behind an icon the user may already have open, and — because
    // extensions load in parallel — which registration won would vary
    // between loads.
    logging.warn(
      `[Superset] A left sidebar view with id "${view.id}" is already ` +
        `registered ("${existing.view.name}"). Ignoring the registration ` +
        `of "${view.name}".`,
    );
    return new Disposable(() => {});
  }

  registry.set(view.id, { view, trigger, panel });
  notify();

  return new Disposable(() => {
    // Identity guard: makes double-dispose, and dispose after a reset, no-ops.
    if (registry.get(view.id)?.view !== view) return;
    registry.delete(view.id);
    notify();
  });
};

export const getLeftBarViews: typeof sqlLabApi.getLeftBarViews = () =>
  // Defensive copy: the cached snapshot is shared with `useLeftBarViews`,
  // and extension code must not be able to mutate it.
  getSnapshot().slice();

/**
 * Host-internal hook. Returns every registered left sidebar view in render
 * order. The array identity is stable until a view is registered or
 * unregistered.
 */
export const useLeftBarViews = (): LeftBarView[] =>
  useSyncExternalStore(subscribe, getSnapshot, () => NO_VIEWS);

/**
 * Host-internal hook. Returns the registration for `id` — descriptor,
 * trigger, and panel — or undefined when nothing is registered under that id.
 */
export const useLeftBarView = (
  id: string,
): LeftBarViewRegistration | undefined =>
  useSyncExternalStore(
    subscribe,
    () => getRegistrationSnapshot(id),
    getUndefined,
  );

/**
 * Host-internal, test-only. Clears the registry, the memoized snapshot, and
 * all subscribers. Not exposed on `window.superset`.
 */
export const resetLeftBarViews = (): void => {
  registry.clear();
  snapshot = undefined;
  syncListeners.clear();
};
