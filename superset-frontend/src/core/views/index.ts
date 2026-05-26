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

import React, { ReactElement } from 'react';
import type { views as viewsApi } from '@apache-superset/core';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import ExtensionPlaceholder from 'src/extensions/ExtensionPlaceholder';
import { Disposable } from '../models';

type View = viewsApi.View;

const viewRegistry: Map<
  string,
  { view: View; location: string; provider: () => ReactElement }
> = new Map();

const locationIndex: Map<string, Set<string>> = new Map();

/** Listeners notified whenever a view is registered or unregistered at a location. */
const locationListeners: Map<string, Set<() => void>> = new Map();

const notifyListeners = (location: string) => {
  locationListeners.get(location)?.forEach(fn => fn());
};

/**
 * Subscribe to registration changes at a specific location.
 * Returns an unsubscribe function.
 */
export const subscribeToLocation = (
  location: string,
  listener: () => void,
): (() => void) => {
  const listeners = locationListeners.get(location) ?? new Set();
  listeners.add(listener);
  locationListeners.set(location, listeners);
  return () => listeners.delete(listener);
};

const registerView: typeof viewsApi.registerView = (
  view: View,
  location: string,
  provider: () => ReactElement,
): Disposable => {
  const { id } = view;

  const previousLocation = viewRegistry.get(id)?.location;
  if (previousLocation && previousLocation !== location) {
    locationIndex.get(previousLocation)?.delete(id);
    notifyListeners(previousLocation);
  }

  viewRegistry.set(id, { view, location, provider });

  const ids = locationIndex.get(location) ?? new Set();
  ids.add(id);
  locationIndex.set(location, ids);

  notifyListeners(location);

  return new Disposable(() => {
    const registeredLocation = viewRegistry.get(id)?.location ?? location;
    viewRegistry.delete(id);
    locationIndex.get(registeredLocation)?.delete(id);
    notifyListeners(registeredLocation);
  });
};

export const resolveView = (id: string): ReactElement => {
  const provider = viewRegistry.get(id)?.provider;
  if (!provider) {
    return React.createElement(ExtensionPlaceholder, { id });
  }
  return React.createElement(ErrorBoundary, null, provider());
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

/**
 * Host-internal: returns the provider for a registered view id at a location.
 * Not part of the public `@apache-superset/core` API — `getViews` stays
 * descriptor-only so extensions cannot render each other's views directly.
 */
export const getViewProvider = (
  location: string,
  id: string,
): (() => ReactElement) | undefined => {
  const entry = viewRegistry.get(id);
  if (entry?.location !== location) {
    return undefined;
  }
  return entry.provider;
};

/** Host-internal: view ids at a location in registration order. */
export const getRegisteredViewIds = (location: string): string[] => {
  const ids = locationIndex.get(location);
  return ids ? Array.from(ids) : [];
};

export const views: typeof viewsApi = {
  registerView,
  getViews,
};
