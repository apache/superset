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
 * @fileoverview User customization (order + visibility) for registered SQL
 * Lab left sidebar views, edited through the built-in Settings panel and
 * applied globally via localStorage. Global rather than per-tab, matching
 * `useLeftBarLayout` — a user's preferred rail layout isn't something they'd
 * expect to reset when switching SQL editor tabs.
 */
import { useSyncExternalStore } from 'react';
import {
  LocalStorageKeys,
  getItem,
  setItem,
} from 'src/utils/localStorageHelpers';

export interface LeftBarViewSettings {
  /**
   * View ids in the user's preferred order. Ids not listed (e.g. a newly
   * registered extension) sort after the listed ones, in their existing
   * relative order.
   */
  order: string[];
  /** Ids hidden from the rail by the visibility filter. */
  hidden: string[];
}

const DEFAULT_SETTINGS: LeftBarViewSettings = { order: [], hidden: [] };

let settings: LeftBarViewSettings = DEFAULT_SETTINGS;
let hydrated = false;
const listeners = new Set<() => void>();

const getSnapshot = (): LeftBarViewSettings => {
  if (!hydrated) {
    hydrated = true;
    settings = getItem(
      LocalStorageKeys.SqllabLeftbarViewSettings,
      DEFAULT_SETTINGS,
    );
  }
  return settings;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Persists the settings panel's "Apply" action and notifies the rail. */
export const applyLeftBarViewSettings = (next: LeftBarViewSettings): void => {
  settings = next;
  hydrated = true;
  setItem(LocalStorageKeys.SqllabLeftbarViewSettings, settings);
  listeners.forEach(listener => listener());
};

export const useLeftBarViewSettings = (): LeftBarViewSettings =>
  useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SETTINGS);

/**
 * Orders `views` by `order` (ids not listed sort after those that are, in
 * their existing relative order — a stable sort). Shared by the rail (which
 * also filters out `hidden` ids) and the settings panel (which lists every
 * view, hidden or not, so the user can toggle it back on).
 */
export function orderViewsBySettings<T extends { id: string }>(
  views: T[],
  order: string[],
): T[] {
  const position = new Map(order.map((id, index) => [id, index]));
  return [...views].sort((a, b) => {
    const ai = position.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bi = position.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
}

/** Test-only helper, mirrors resetLeftBarLayoutState. */
export const resetLeftBarViewSettings = (): void => {
  settings = DEFAULT_SETTINGS;
  hydrated = true;
  setItem(LocalStorageKeys.SqllabLeftbarViewSettings, DEFAULT_SETTINGS);
  listeners.forEach(listener => listener());
};
