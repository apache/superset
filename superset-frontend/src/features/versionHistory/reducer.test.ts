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
  beginChartNormalizationSave,
  clearVersionPreview,
  clearVersionSessionLog,
  completeChartNormalizationSave,
  closeVersionHistoryPanel,
  openVersionHistoryPanel,
  hydrateChartNormalization,
  invalidateChartNormalizationControls,
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
  state = versionHistoryReducer(state, clearVersionPreview(preview.entityUuid));
  expect(state.preview).toBeNull();
});

test("another entity's clear leaves this preview alone", () => {
  // The slice is global and outlives any one page. A restore (or a failed
  // apply) settling after the user moved to another entity and previewed a
  // version there must not clear the preview they just opened — the guard
  // lives here so every dispatcher inherits it, rather than at each of the
  // five call sites.
  let state = versionHistoryReducer(initial, setVersionPreview(preview));
  state = versionHistoryReducer(state, clearVersionPreview('other-entity'));
  expect(state.preview).toEqual(preview);

  // ...and the owning entity still clears it.
  state = versionHistoryReducer(state, clearVersionPreview(preview.entityUuid));
  expect(state.preview).toBeNull();
});

test('a clear with no entity cannot exit another entity’s preview', () => {
  // An undefined uuid identifies nothing, so it must not act as a wildcard.
  let state = versionHistoryReducer(initial, setVersionPreview(preview));
  state = versionHistoryReducer(state, clearVersionPreview(undefined));
  expect(state.preview).toEqual(preview);
});

test('include filter persists', () => {
  const state = versionHistoryReducer(
    initial,
    setVersionHistoryInclude('related'),
  );
  expect(state.include).toBe('related');
});

test('versionRestored increments the counter and records the entity', () => {
  let state = versionHistoryReducer(initial, versionRestored('uuid-a'));
  state = versionHistoryReducer(state, versionRestored('uuid-b'));
  expect(state.restoreCount).toBe(2);
  // Consumers use this to ignore restores of entities other than the one
  // their page shows — the store outlives SPA navigation.
  expect(state.lastRestoredEntityUuid).toBe('uuid-b');
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

test('normalization tracking invalidates controls without re-adding transitions', () => {
  let state = versionHistoryReducer(
    initial,
    hydrateChartNormalization({
      chartId: 7,
      hydrationSessionId: 'session-a',
      transitions: {
        row_limit: {
          control: 'row_limit',
          from_present: true,
          from_value: null,
          to_present: true,
          to_value: 10000,
        },
      },
      invalidatedControls: {},
      saveAttemptId: null,
    }),
  );
  state = versionHistoryReducer(
    state,
    invalidateChartNormalizationControls(['row_limit']),
  );
  expect(state.chartNormalization?.invalidatedControls).toEqual({
    row_limit: true,
  });
  expect(state.chartNormalization?.transitions.row_limit).toBeDefined();
});

test('late save completion cannot rebase another hydration session', () => {
  let state = versionHistoryReducer(
    initial,
    hydrateChartNormalization({
      chartId: 7,
      hydrationSessionId: 'session-b',
      transitions: {},
      invalidatedControls: {},
      saveAttemptId: null,
    }),
  );
  state = versionHistoryReducer(
    state,
    beginChartNormalizationSave(7, 'session-b', 'attempt-b'),
  );
  const unchanged = versionHistoryReducer(
    state,
    completeChartNormalizationSave(7, 'session-a', 'attempt-a', {}),
  );
  expect(unchanged).toBe(state);
  expect(unchanged.chartNormalization?.saveAttemptId).toBe('attempt-b');
});
