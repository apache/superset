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
import versionHistoryReducer, {
  appendVersionSessionLog,
  clearVersionPreview,
  clearVersionSessionLog,
  closeVersionHistoryPanel,
  openVersionHistoryPanel,
  selectIsChartVersionPreviewActive,
  selectIsDashboardVersionPreviewActive,
  selectVersionHistory,
  setVersionHistoryInclude,
  setVersionPreview,
  versionRestored,
  VersionHistoryRootState,
} from './reducer';
import type { SessionLogEntry, VersionPreviewState } from './types';

const initial = versionHistoryReducer(undefined, { type: 'INIT' } as never);

const preview: VersionPreviewState = {
  entityUuid: 'entity-uuid',
  versionUuid: 'version-uuid',
  transactionId: 7,
  headline: 'Dec 5, 2025, 5:18 PM',
  issuedAt: '2025-12-05T17:18:00',
};

const entry = (overrides: Partial<SessionLogEntry> = {}): SessionLogEntry => ({
  label: "Changed 'Metrics'",
  controlName: 'metrics',
  ts: 1,
  user: 'Ada Lovelace',
  ...overrides,
});

test('opening the panel records the entity type', () => {
  const state = versionHistoryReducer(
    initial,
    openVersionHistoryPanel('dashboard'),
  );
  expect(state.isPanelOpen).toBe(true);
  expect(state.entityType).toBe('dashboard');
});

test('closing the panel also exits any active preview', () => {
  let state = versionHistoryReducer(initial, openVersionHistoryPanel('chart'));
  state = versionHistoryReducer(state, setVersionPreview(preview));
  state = versionHistoryReducer(state, closeVersionHistoryPanel());
  expect(state.isPanelOpen).toBe(false);
  expect(state.preview).toBeNull();
});

test('set and clear preview', () => {
  let state = versionHistoryReducer(initial, setVersionPreview(preview));
  expect(state.preview).toEqual(preview);
  state = versionHistoryReducer(state, clearVersionPreview());
  expect(state.preview).toBeNull();
});

test('include filter persists', () => {
  const state = versionHistoryReducer(
    initial,
    setVersionHistoryInclude('related'),
  );
  expect(state.include).toBe('related');
});

test('versionRestored increments the restore counter', () => {
  let state = versionHistoryReducer(initial, versionRestored());
  state = versionHistoryReducer(state, versionRestored());
  expect(state.restoreCount).toBe(2);
});

test('session log collapses consecutive edits of the same control', () => {
  let state = versionHistoryReducer(
    initial,
    appendVersionSessionLog(entry({ ts: 1 })),
  );
  state = versionHistoryReducer(
    state,
    appendVersionSessionLog(entry({ ts: 2 })),
  );
  state = versionHistoryReducer(
    state,
    appendVersionSessionLog(entry({ controlName: 'row_limit', ts: 3 })),
  );
  expect(state.sessionLog).toHaveLength(2);
  expect(state.sessionLog[0].ts).toBe(2);
  state = versionHistoryReducer(state, clearVersionSessionLog());
  expect(state.sessionLog).toHaveLength(0);
});

test('selectors fall back to the initial state when the slice is missing', () => {
  const state = {} as VersionHistoryRootState;
  expect(selectVersionHistory(state).isPanelOpen).toBe(false);
  expect(selectIsChartVersionPreviewActive(state)).toBe(false);
});

test('per-entity preview selectors only match their own entity type', () => {
  let slice = versionHistoryReducer(initial, openVersionHistoryPanel('chart'));
  slice = versionHistoryReducer(slice, setVersionPreview(preview));
  const state: VersionHistoryRootState = { versionHistory: slice };
  expect(selectIsChartVersionPreviewActive(state)).toBe(true);
  expect(selectIsDashboardVersionPreviewActive(state)).toBe(false);
});
