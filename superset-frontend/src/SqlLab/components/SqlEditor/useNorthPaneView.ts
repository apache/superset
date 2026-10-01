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
import { useEffect, useRef, useState } from 'react';
import type { QueryEditor } from 'src/SqlLab/types';
import { ViewLocations } from 'src/SqlLab/contributions';
import { useViews } from 'src/core/views';

/** Per-tab localStorage key storing the active northPane view ID. */
const NORTH_PANE_VIEW_KEY = (tabId: string) => `sqllab.northPaneView.${tabId}`;

// The northPane keys are dynamic per-tab strings rather than members of the
// typed LocalStorageKeys enum, so the typed helpers don't apply. Guard the raw
// access here so a storage-restricted browser can't crash the editor mount.
const readNorthPaneStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeNorthPaneStorage = (key: string, value: string | null): void => {
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
 * Tracks which view (if any) a tab's north pane should render, keeping it in
 * sync across reloads and other tabs via a per-tab localStorage entry.
 *
 * A tab created through the extension API carries the requested view on its
 * own query editor state, so it can never be picked up by another tab.
 * Editors hydrated from the backend on reload don't carry the field, so this
 * falls back to the per-tab localStorage entry kept in sync below.
 */
export default function useNorthPaneView(queryEditor: QueryEditor) {
  // Re-renders when an extension registers a northPane view after async load.
  const northPaneViews = useViews(ViewLocations.sqllab.northPane) || [];

  // Resolve the per-tab localStorage key the same way every other SQL Lab
  // consumer does (`tabViewId ?? id`), so the value written, read back, and
  // observed via the `storage` event all agree once a tab is backend-persisted.
  const northPaneStorageId = queryEditor.tabViewId ?? queryEditor.id;

  const [northPaneViewId, setNorthPaneViewId] = useState<string | null>(
    () =>
      queryEditor.northPaneViewId ??
      readNorthPaneStorage(NORTH_PANE_VIEW_KEY(northPaneStorageId)),
  );

  // Tracks the storage id last written so that, when a tab syncs to the
  // backend and `tabViewId` arrives, the entry under the old id-keyed key is
  // removed rather than left orphaned in localStorage.
  const northPaneStorageIdRef = useRef(northPaneStorageId);

  useEffect(() => {
    if (northPaneStorageIdRef.current !== northPaneStorageId) {
      writeNorthPaneStorage(
        NORTH_PANE_VIEW_KEY(northPaneStorageIdRef.current),
        null,
      );
      northPaneStorageIdRef.current = northPaneStorageId;
    }
    writeNorthPaneStorage(
      NORTH_PANE_VIEW_KEY(northPaneStorageId),
      northPaneViewId,
    );
  }, [northPaneStorageId, northPaneViewId]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === NORTH_PANE_VIEW_KEY(northPaneStorageId)) {
        setNorthPaneViewId(e.newValue || null);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [northPaneStorageId]);

  return { northPaneViewId, northPaneViews };
}
