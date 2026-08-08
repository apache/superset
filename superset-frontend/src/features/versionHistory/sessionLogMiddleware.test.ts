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
import { isFeatureEnabled } from '@superset-ui/core';
import { versionSessionLogMiddleware } from './sessionLogMiddleware';
import {
  APPEND_VERSION_SESSION_LOG,
  CLEAR_VERSION_SESSION_LOG,
} from './reducer';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const buildStore = (state: object = {}) => ({
  getState: jest.fn(() => state),
  dispatch: jest.fn(),
});

const run = (store: ReturnType<typeof buildStore>, action: object) => {
  const next = jest.fn(value => value);
  versionSessionLogMiddleware(store)(next)(action);
  return next;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedIsFeatureEnabled.mockReturnValue(true);
});

test('logs a session entry with the control label on SET_FIELD_VALUE', () => {
  const store = buildStore({
    user: { firstName: 'Ada', lastName: 'Lovelace' },
    explore: { controls: { metrics: { label: 'Metrics' } } },
  });
  run(store, { type: 'SET_FIELD_VALUE', controlName: 'metrics', value: [] });
  expect(store.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: APPEND_VERSION_SESSION_LOG,
      entry: expect.objectContaining({
        label: "Changed 'Metrics'",
        controlName: 'metrics',
        user: 'Ada Lovelace',
      }),
    }),
  );
});

test('falls back to a humanized control name when no label exists', () => {
  const store = buildStore({ explore: { controls: {} } });
  run(store, { type: 'SET_FIELD_VALUE', controlName: 'row_limit', value: 10 });
  expect(store.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      entry: expect.objectContaining({
        label: "Changed 'row limit'",
        user: null,
      }),
    }),
  );
});

test('skips programmatic control writes so untouched charts stay clean', async () => {
  // Effects rewrite controls with no user gesture (transferred-control
  // cleanup after load, derived margins); logging them would report unsaved
  // edits the user never made. Built with the REAL action creator so the
  // `programmatic` key is pinned across modules — a rename on either side
  // fails here rather than silently reviving phantom entries.
  const { setControlValue } =
    await import('src/explore/actions/exploreActions');
  const store = buildStore({
    explore: { controls: { metrics: { label: 'Metrics' } } },
  });
  run(store, setControlValue('metrics', [], undefined, { programmatic: true }));
  expect(store.dispatch).not.toHaveBeenCalled();

  // The same creator without the mark still logs.
  run(store, setControlValue('metrics', []));
  expect(store.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ type: APPEND_VERSION_SESSION_LOG }),
  );
});

test('clears the session log when the explore page hydrates', () => {
  const store = buildStore();
  run(store, { type: 'HYDRATE_EXPLORE', data: {} });
  expect(store.dispatch).toHaveBeenCalledWith({
    type: CLEAR_VERSION_SESSION_LOG,
  });
});

test('a chart rename is logged as an unsaved change', () => {
  // Renames travel through UPDATE_CHART_TITLE, not SET_FIELD_VALUE; without
  // this the restore gate's dirty signal missed them and a restore silently
  // discarded the rename.
  const store = buildStore({
    user: { firstName: 'Ada', lastName: 'Lovelace' },
  });
  run(store, { type: 'UPDATE_CHART_TITLE', sliceName: 'New name' });
  expect(store.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: APPEND_VERSION_SESSION_LOG,
      entry: expect.objectContaining({
        label: 'Renamed chart',
        controlName: 'slice_name',
        user: 'Ada Lovelace',
      }),
    }),
  );
});

test('a dataset reconciliation is logged as an unsaved change', async () => {
  // Editing a dataset in place reconciles the chart's form data against the
  // new columns but dispatches nothing the control branches record — only a
  // *swap* emits its own control change. Without this the restore gate saw
  // an empty log while the form had changed, and a restore discarded the
  // reconciled values with no warning. Built with the REAL action creator so
  // the shape is pinned across modules.
  const { updateFormDataByDatasource } =
    await import('src/explore/actions/exploreActions');
  const store = buildStore({
    user: { firstName: 'Ada', lastName: 'Lovelace' },
    explore: { controls: { datasource: { label: 'Dataset' } } },
  });
  const datasource = { id: 1, type: 'table' } as never;
  run(store, updateFormDataByDatasource(datasource, datasource));
  expect(store.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: APPEND_VERSION_SESSION_LOG,
      entry: expect.objectContaining({
        label: "Changed 'Dataset'",
        controlName: 'datasource',
        user: 'Ada Lovelace',
      }),
    }),
  );
});

test('a browser history step is logged as an unsaved change', async () => {
  // Explore's own history entries carry chart state, so a back/forward
  // between them is an undo/redo that rebuilds the whole control map without
  // emitting a single control change. Unrecorded, a save (which clears the
  // log) followed by a step back to the pre-save controls left the restore
  // gate seeing a clean form that had in fact moved — and the restore
  // discarded it silently. Built with the REAL action creator: the constant
  // is named SET_EXPLORE_CONTROLS but its literal is
  // 'UPDATE_EXPLORE_CONTROLS'.
  const { setExploreControls } =
    await import('src/explore/actions/exploreActions');
  const store = buildStore({
    user: { firstName: 'Ada', lastName: 'Lovelace' },
  });
  run(store, setExploreControls({ viz_type: 'table' } as never));
  expect(store.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: APPEND_VERSION_SESSION_LOG,
      entry: expect.objectContaining({
        label: 'Undid or redid a change',
        controlName: '__history__',
        user: 'Ada Lovelace',
      }),
    }),
  );
});

test('a history step cannot collapse into an adjacent control entry', async () => {
  // Collapsing is by controlName, so the sentinel must not collide with a
  // real control — otherwise a history step would silently replace the
  // preceding genuine edit rather than adding to it.
  const { setExploreControls } =
    await import('src/explore/actions/exploreActions');
  const store = buildStore({ explore: { controls: {} } });
  run(store, setExploreControls({} as never));
  const { entry } = store.dispatch.mock.calls[0][0];
  expect(entry.controlName).not.toMatch(/^[a-z]/);
});

test('does nothing when the feature flag is disabled', () => {
  mockedIsFeatureEnabled.mockReturnValue(false);
  const store = buildStore();
  run(store, { type: 'SET_FIELD_VALUE', controlName: 'metrics', value: [] });
  expect(store.dispatch).not.toHaveBeenCalled();
});

test('passes every action through to the next middleware', () => {
  const store = buildStore();
  const action = { type: 'UNRELATED' };
  const next = run(store, action);
  expect(next).toHaveBeenCalledWith(action);
  expect(store.dispatch).not.toHaveBeenCalled();
});

test('inlined action-type literals match the real explore constants', async () => {
  // The middleware inlines these to keep explore out of the global
  // bundle; a rename in explore must fail here, not silently kill the
  // session log. Test code can afford the real imports.
  const middleware = await import('./sessionLogMiddleware');
  const exploreActions = await import('src/explore/actions/exploreActions');
  const hydrateExplore = await import('src/explore/actions/hydrateExplore');
  expect(middleware.SET_FIELD_VALUE).toBe(exploreActions.SET_FIELD_VALUE);
  expect(middleware.UPDATE_CHART_TITLE).toBe(exploreActions.UPDATE_CHART_TITLE);
  expect(middleware.UPDATE_FORM_DATA_BY_DATASOURCE).toBe(
    exploreActions.UPDATE_FORM_DATA_BY_DATASOURCE,
  );
  expect(middleware.SET_EXPLORE_CONTROLS).toBe(
    exploreActions.SET_EXPLORE_CONTROLS,
  );
  expect(middleware.HYDRATE_EXPLORE).toBe(hydrateExplore.HYDRATE_EXPLORE);
});
