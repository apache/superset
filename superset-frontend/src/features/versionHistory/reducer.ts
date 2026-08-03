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
import type {
  ActivityInclude,
  SessionLogEntry,
  VersionedEntityType,
  VersionHistoryState,
  VersionPreviewState,
} from './types';

export const OPEN_VERSION_HISTORY_PANEL = 'OPEN_VERSION_HISTORY_PANEL';
export const CLOSE_VERSION_HISTORY_PANEL = 'CLOSE_VERSION_HISTORY_PANEL';
export const SET_VERSION_HISTORY_INCLUDE = 'SET_VERSION_HISTORY_INCLUDE';
export const SET_VERSION_PREVIEW = 'SET_VERSION_PREVIEW';
export const CLEAR_VERSION_PREVIEW = 'CLEAR_VERSION_PREVIEW';
export const VERSION_PREVIEW_APPLIED = 'VERSION_PREVIEW_APPLIED';
export const VERSION_RESTORED = 'VERSION_RESTORED';
export const APPEND_VERSION_SESSION_LOG = 'APPEND_VERSION_SESSION_LOG';
export const CLEAR_VERSION_SESSION_LOG = 'CLEAR_VERSION_SESSION_LOG';

/** Upper bound on retained unsaved-edit entries; older ones drop off. */
export const MAX_SESSION_LOG_ENTRIES = 50;

interface OpenPanelAction {
  type: typeof OPEN_VERSION_HISTORY_PANEL;
  entityType: VersionedEntityType;
}

interface ClosePanelAction {
  type: typeof CLOSE_VERSION_HISTORY_PANEL;
}

interface SetIncludeAction {
  type: typeof SET_VERSION_HISTORY_INCLUDE;
  include: ActivityInclude;
}

interface SetPreviewAction {
  type: typeof SET_VERSION_PREVIEW;
  preview: VersionPreviewState;
}

interface ClearPreviewAction {
  type: typeof CLEAR_VERSION_PREVIEW;
  entityUuid: string | undefined;
}

interface PreviewAppliedAction {
  type: typeof VERSION_PREVIEW_APPLIED;
}

interface VersionRestoredAction {
  type: typeof VERSION_RESTORED;
  /**
   * The entity the restore happened to. The store outlives SPA navigation
   * and a restore is a multi-request sequence, so an unscoped broadcast
   * resolving after the user moved on would make the *next* page rehydrate —
   * clearing its filters and edits for a restore that happened elsewhere.
   * Consumers compare this against their own entity before reacting.
   */
  entityUuid: string;
}

interface AppendSessionLogAction {
  type: typeof APPEND_VERSION_SESSION_LOG;
  entry: SessionLogEntry;
}

interface ClearSessionLogAction {
  type: typeof CLEAR_VERSION_SESSION_LOG;
}

export type VersionHistoryAction =
  | OpenPanelAction
  | ClosePanelAction
  | SetIncludeAction
  | SetPreviewAction
  | ClearPreviewAction
  | PreviewAppliedAction
  | VersionRestoredAction
  | AppendSessionLogAction
  | ClearSessionLogAction;

export const openVersionHistoryPanel = (
  entityType: VersionedEntityType,
): OpenPanelAction => ({
  type: OPEN_VERSION_HISTORY_PANEL,
  entityType,
});

export const closeVersionHistoryPanel = (): ClosePanelAction => ({
  type: CLOSE_VERSION_HISTORY_PANEL,
});

export const setVersionHistoryInclude = (
  include: ActivityInclude,
): SetIncludeAction => ({
  type: SET_VERSION_HISTORY_INCLUDE,
  include,
});

export const setVersionPreview = (
  preview: VersionPreviewState,
): SetPreviewAction => ({
  type: SET_VERSION_PREVIEW,
  preview,
});

/**
 * Exits the preview of *entityUuid*. The uuid is required rather than
 * optional so an asynchronous dispatcher has to think about identity: the
 * slice is global and outlives any one page, so a restore or a failed apply
 * settling after the user moved to another entity would otherwise clear the
 * preview they just opened there. The reducer no-ops on a mismatch.
 */
export const clearVersionPreview = (
  entityUuid: string | undefined,
): ClearPreviewAction => ({
  type: CLEAR_VERSION_PREVIEW,
  entityUuid,
});

/**
 * Marks the requested preview as fully applied. Dispatched when the snapshot
 * has been hydrated, or when applying it failed -- either way the page has
 * stopped being in-between states.
 */
export const versionPreviewApplied = (): PreviewAppliedAction => ({
  type: VERSION_PREVIEW_APPLIED,
});

export const versionRestored = (entityUuid: string): VersionRestoredAction => ({
  type: VERSION_RESTORED,
  entityUuid,
});

export const appendVersionSessionLog = (
  entry: SessionLogEntry,
): AppendSessionLogAction => ({
  type: APPEND_VERSION_SESSION_LOG,
  entry,
});

export const clearVersionSessionLog = (): ClearSessionLogAction => ({
  type: CLEAR_VERSION_SESSION_LOG,
});

const initialState: VersionHistoryState = {
  isPanelOpen: false,
  entityType: null,
  include: 'all',
  preview: null,
  isPreviewApplying: false,
  sessionLog: [],
  restoreCount: 0,
  lastRestoredEntityUuid: null,
};

export default function versionHistoryReducer(
  state: VersionHistoryState = initialState,
  action: VersionHistoryAction,
): VersionHistoryState {
  switch (action.type) {
    case OPEN_VERSION_HISTORY_PANEL:
      return { ...state, isPanelOpen: true, entityType: action.entityType };
    case CLOSE_VERSION_HISTORY_PANEL:
      // Closing the panel also exits any active preview.
      return {
        ...state,
        isPanelOpen: false,
        preview: null,
        isPreviewApplying: false,
      };
    case SET_VERSION_HISTORY_INCLUDE:
      return { ...state, include: action.include };
    case SET_VERSION_PREVIEW:
      // Re-selecting the version already being previewed must be a no-op.
      // The appliers' effects key on versionUuid and would never re-run for
      // an identical value, so re-entering the applying state here would
      // leave it stuck: the banner reporting a load forever and Restore
      // withheld until the preview is exited.
      if (action.preview.versionUuid === state.preview?.versionUuid) {
        return state;
      }
      // A newly requested preview is by definition not on screen yet: the
      // snapshot takes several round trips to fetch and hydrate, and until it
      // lands the page still shows live data. Starting in the applying state
      // means no caller can forget to announce it.
      return { ...state, preview: action.preview, isPreviewApplying: true };
    case VERSION_PREVIEW_APPLIED:
      return { ...state, isPreviewApplying: false };
    case CLEAR_VERSION_PREVIEW:
      // Only the entity whose preview this is may exit it. A restore (or a
      // failed apply) resolving after the user moved to another entity and
      // opened a preview there must leave that preview alone.
      if (state.preview && state.preview.entityUuid !== action.entityUuid) {
        return state;
      }
      return { ...state, preview: null, isPreviewApplying: false };
    case VERSION_RESTORED:
      return {
        ...state,
        restoreCount: state.restoreCount + 1,
        lastRestoredEntityUuid: action.entityUuid,
      };
    case APPEND_VERSION_SESSION_LOG: {
      const last = state.sessionLog[state.sessionLog.length - 1];
      // Collapse consecutive edits of the same control into one entry.
      if (last && last.controlName === action.entry.controlName) {
        return {
          ...state,
          sessionLog: [...state.sessionLog.slice(0, -1), action.entry],
        };
      }
      // Alternating edits never collapse, so cap the log — the middleware
      // appends on every control change for the lifetime of the page, and
      // only the most recent entries are meaningful in the panel.
      return {
        ...state,
        sessionLog: [...state.sessionLog, action.entry].slice(
          -MAX_SESSION_LOG_ENTRIES,
        ),
      };
    }
    case CLEAR_VERSION_SESSION_LOG:
      return { ...state, sessionLog: [] };
    default:
      return state;
  }
}

export interface VersionHistoryRootState {
  versionHistory: VersionHistoryState;
}

export const selectVersionHistory = (state: VersionHistoryRootState) =>
  state.versionHistory ?? initialState;

export const selectIsVersionHistoryPanelOpen = (
  state: VersionHistoryRootState,
) => selectVersionHistory(state).isPanelOpen;

export const selectVersionHistoryInclude = (state: VersionHistoryRootState) =>
  selectVersionHistory(state).include;

export const selectVersionPreview = (state: VersionHistoryRootState) =>
  selectVersionHistory(state).preview;

/**
 * True while a requested preview is still being fetched and hydrated -- the
 * window in which the banner is up but the page below it is still live data.
 */
export const selectIsVersionPreviewApplying = (
  state: VersionHistoryRootState,
) => selectVersionHistory(state).isPreviewApplying;

export const selectIsChartVersionPreviewActive = (
  state: VersionHistoryRootState,
) => {
  const { entityType, preview } = selectVersionHistory(state);
  return entityType === 'chart' && preview !== null;
};

export const selectIsDashboardVersionPreviewActive = (
  state: VersionHistoryRootState,
) => {
  const { entityType, preview } = selectVersionHistory(state);
  return entityType === 'dashboard' && preview !== null;
};

export const selectVersionRestoreCount = (state: VersionHistoryRootState) =>
  selectVersionHistory(state).restoreCount;

export const selectVersionLastRestoredUuid = (state: VersionHistoryRootState) =>
  selectVersionHistory(state).lastRestoredEntityUuid;

export const selectVersionSessionLog = (state: VersionHistoryRootState) =>
  selectVersionHistory(state).sessionLog;
