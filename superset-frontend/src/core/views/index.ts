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

const registerView: typeof viewsApi.registerView = (
  view: View,
  location: string,
  provider: () => ReactElement,
): Disposable => {
  const { id } = view;

  viewRegistry.set(id, { view, location, provider });

  const ids = locationIndex.get(location) ?? new Set();
  ids.add(id);
  locationIndex.set(location, ids);

  return new Disposable(() => {
    viewRegistry.delete(id);
    locationIndex.get(location)?.delete(id);
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
 * Host-internal accessor that returns the registered `provider` for a view id
 * at a given location.
 *
 * This is deliberately NOT part of the public `@apache-superset/core` `views`
 * API. The public `getViews` returns descriptors only (`id`/`name`/...), so an
 * extension can discover what is registered but cannot obtain — and therefore
 * cannot render — another extension's view outside the host's mount point,
 * lifecycle, and fault-isolation boundary.
 *
 * The host uses this accessor to render exclusive (singleton) contribution
 * areas such as `superset.chatbot`, where it must enumerate the candidates and
 * then render exactly one. See `getActiveChatbot` in `src/core/chatbot`.
 *
 * @param location The contribution location (e.g. `superset.chatbot`).
 * @param id The registered view id.
 * @returns The provider function, or undefined if no matching view is
 *   registered at that location.
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

/**
 * Host-internal accessor that returns the ordered list of view ids registered
 * at a location, in registration order.
 *
 * Registration order is meaningful for exclusive locations: the host's
 * deterministic fallback policy ("first to register wins") relies on it.
 * Like {@link getViewProvider}, this is host-internal and not part of the
 * public API.
 *
 * @param location The contribution location.
 * @returns View ids in registration order, or an empty array if none.
 */
export const getRegisteredViewIds = (location: string): string[] => {
  const ids = locationIndex.get(location);
  return ids ? Array.from(ids) : [];
};

export const views: typeof viewsApi = {
  registerView,
  getViews,
};
