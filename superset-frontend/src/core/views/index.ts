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
import ExtensionPlaceholder from 'src/extensions/ExtensionPlaceholder';
import { Disposable } from '../models';
import { createEventEmitter } from '../utils';

type View = viewsApi.View;
type ViewRegisteredEvent = viewsApi.ViewRegisteredEvent;
type ViewUnregisteredEvent = viewsApi.ViewUnregisteredEvent;

const viewRegistry: Map<
  string,
  { view: View; location: string; component: ComponentType }
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

const registerView: typeof viewsApi.registerView = (
  view: View,
  location: string,
  component: ComponentType,
): Disposable => {
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

export const views: typeof viewsApi = {
  registerView,
  getViews,
  onDidRegisterView,
  onDidUnregisterView,
};
