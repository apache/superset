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

/** Per-tab localStorage key storing the active northPane view ID. */
export const NORTH_PANE_VIEW_KEY = (tabId: string) =>
  `sqllab.northPaneView.${tabId}`;

// The northPane keys are dynamic per-tab strings rather than members of the
// typed LocalStorageKeys enum, so the typed helpers don't apply. Guard the raw
// access here so a storage-restricted browser can't crash the editor mount.
export const readNorthPaneStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeNorthPaneStorage = (
  key: string,
  value: string | null,
): void => {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // localStorage may be unavailable (blocked/quota/private mode); ignore.
  }
};

/**
 * Resolves the per-tab localStorage key the same way every consumer does
 * (`tabViewId ?? id`), so the value written, read back, and observed via the
 * `storage` event all agree once a tab is backend-persisted.
 */
export const northPaneStorageId = (queryEditor: {
  id: string;
  tabViewId?: string;
}): string => queryEditor.tabViewId ?? queryEditor.id;

/** Removes a closed tab's northPane entry so it doesn't linger forever. */
export const clearNorthPaneStorage = (queryEditor: {
  id: string;
  tabViewId?: string;
}): void => {
  writeNorthPaneStorage(
    NORTH_PANE_VIEW_KEY(northPaneStorageId(queryEditor)),
    null,
  );
};
