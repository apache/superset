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
export const VERSION_RESTORED = 'VERSION_RESTORED';
export const APPEND_VERSION_SESSION_LOG = 'APPEND_VERSION_SESSION_LOG';
export const CLEAR_VERSION_SESSION_LOG = 'CLEAR_VERSION_SESSION_LOG';

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
}

interface VersionRestoredAction {
  type: typeof VERSION_RESTORED;
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

export const clearVersionPreview = (): ClearPreviewAction => ({
  type: CLEAR_VERSION_PREVIEW,
});

export const versionRestored = (): VersionRestoredAction => ({
  type: VERSION_RESTORED,
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
  sessionLog: [],
  restoreCount: 0,
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
      return { ...state, isPanelOpen: false, preview: null };
    case SET_VERSION_HISTORY_INCLUDE:
      return { ...state, include: action.include };
    case SET_VERSION_PREVIEW:
      return { ...state, preview: action.preview };
    case CLEAR_VERSION_PREVIEW:
      return { ...state, preview: null };
    case VERSION_RESTORED:
      return { ...state, restoreCount: state.restoreCount + 1 };
    case APPEND_VERSION_SESSION_LOG: {
      const last = state.sessionLog[state.sessionLog.length - 1];
      // Collapse consecutive edits of the same control into one entry.
      if (last && last.controlName === action.entry.controlName) {
        return {
          ...state,
          sessionLog: [...state.sessionLog.slice(0, -1), action.entry],
        };
      }
      return { ...state, sessionLog: [...state.sessionLog, action.entry] };
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

export const selectIsVersionPreviewActive = (state: VersionHistoryRootState) =>
  selectVersionHistory(state).preview !== null;

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

export const selectVersionSessionLog = (state: VersionHistoryRootState) =>
  selectVersionHistory(state).sessionLog;
