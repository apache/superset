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
import { useDashboardStateStore } from 'src/dashboard/stores';

/** Per-field marker: was the dashboard clean when this title edit started? */
export type TitleDirtyRef = { current: boolean | undefined };

/**
 * Mark dirty as the title is typed; clear only on revert to `savedTitle` AND
 * when this edit was the sole change, so other pending edits stay dirty.
 */
export function flagTitleUnsavedChanges(
  savedTitle: string,
  value: string,
  wasCleanRef: TitleDirtyRef,
) {
  const state = useDashboardStateStore.getState();
  if (value !== savedTitle) {
    if (wasCleanRef.current === undefined) {
      wasCleanRef.current = !state.hasUnsavedChanges;
    }
    if (!state.hasUnsavedChanges) {
      state.setHasUnsavedChanges(true);
    }
  } else {
    if (wasCleanRef.current) {
      state.setHasUnsavedChanges(false);
    }
    wasCleanRef.current = undefined;
  }
}

/**
 * Reset on edit-end (blur) so the next edit re-reads the clean state instead of
 * clearing on a stale "was clean" value.
 */
export function resetTitleDirtyFlag(wasCleanRef: TitleDirtyRef) {
  wasCleanRef.current = undefined;
}
