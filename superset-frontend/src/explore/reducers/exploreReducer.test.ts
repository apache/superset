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

import {
  DatasourceType,
  getChartControlPanelRegistry,
  QueryFormData,
} from '@superset-ui/core';
import {
  sections,
  ControlPanelConfig,
  ControlStateMapping,
  CustomControlItem,
  Dataset,
} from '@superset-ui/chart-controls';
import {
  getControlStateFromControlConfig,
  getFormDataFromControls,
} from 'src/explore/controlUtils';
import { getControlsState } from 'src/explore/store';
import { Slice } from 'src/types/Chart';
import exploreReducer, { ExploreState } from './exploreReducer';
import { buildHistoryFrame, MAX_HISTORY } from './exploreUndoHistory';
import {
  createNewSlice,
  redoExploreAction,
  setCompatibility,
  setControlValue,
  setExploreControls,
  setFormData,
  setStashFormData,
  sliceUpdated,
  undoExploreAction,
  updateFormDataByDatasource,
} from '../actions/exploreActions';
import { HYDRATE_EXPLORE } from '../actions/hydrateExplore';
import { CompatibilityResult } from '../types';

const EMPTY_UNDO_HISTORY = { past: [], future: [], restoreEpoch: 0 };

test('reset hiddenFormData on SET_STASH_FORM_DATA', () => {
  const initialState: ExploreState = {
    form_data: { a: 3, c: 4 } as unknown as QueryFormData,
    controls: {},
    undoHistory: EMPTY_UNDO_HISTORY,
  };
  const action = setStashFormData(true, ['a', 'c']) as Parameters<
    typeof exploreReducer
  >[1];
  const newState = exploreReducer(initialState, action);
  expect(newState.form_data).toEqual({});
  expect(newState.hiddenFormData).toEqual({ a: 3, c: 4 });
  const restoreAction = setStashFormData(false, ['c']) as Parameters<
    typeof exploreReducer
  >[1];
  const newState2 = exploreReducer(newState, restoreAction);
  expect(newState2.form_data).toEqual({ c: 4 });
  expect(newState2.hiddenFormData).toEqual({ a: 3 });
});

test('SET_COMPATIBILITY stores each mutually exclusive request state', () => {
  const initialState: ExploreState = {
    form_data: {} as unknown as QueryFormData,
    controls: {},
    undoHistory: EMPTY_UNDO_HISTORY,
  };

  const states: CompatibilityResult[] = [
    { status: 'loading' },
    { status: 'verified', metrics: ['m1'], dimensions: ['d1'] },
    { status: 'verified', metrics: [], dimensions: [] },
    { status: 'failed' },
    { status: 'idle' },
  ];

  states.forEach(compatibility => {
    const newState = exploreReducer(
      initialState,
      setCompatibility(compatibility) as Parameters<typeof exploreReducer>[1],
    );
    expect(newState.compatibility).toEqual(compatibility);
  });
});

test('SET_COMPATIBILITY replaces the previous result instead of merging', () => {
  const initialState: ExploreState = {
    form_data: {} as unknown as QueryFormData,
    controls: {},
    undoHistory: EMPTY_UNDO_HISTORY,
    compatibility: { status: 'verified', metrics: ['m1'], dimensions: ['d1'] },
  };

  const newState = exploreReducer(
    initialState,
    setCompatibility({ status: 'failed' }) as Parameters<
      typeof exploreReducer
    >[1],
  );

  expect(newState.compatibility).toEqual({ status: 'failed' });
});

test('skips updates when the field is already updated on SET_STASH_FORM_DATA', () => {
  const initialState: ExploreState = {
    form_data: { a: 3, c: 4 } as unknown as QueryFormData,
    hiddenFormData: { b: 2 } as unknown as Partial<QueryFormData>,
    controls: {},
    undoHistory: EMPTY_UNDO_HISTORY,
  };
  const restoreAction = setStashFormData(false, ['c', 'd']) as Parameters<
    typeof exploreReducer
  >[1];
  const newState = exploreReducer(initialState, restoreAction);
  expect(newState).toBe(initialState);
});

// Regression guard for the shared Time Comparison section (used by the Table
// chart, among others): selecting "Custom date" for Time shift and then
// clearing "Shift start date" raises a required-date validation error. When the
// user then switches Time shift to a non-custom preset the error must clear.
// Because `start_date_offset` did not declare `validationDependencies` on
// `time_compare`, SET_FIELD_VALUE never re-ran its mapStateToProps and the stale
// error survived in Redux, blocking further chart updates until a page refresh.
test('SET_FIELD_VALUE clears the custom-shift date error when time_compare leaves "custom"', () => {
  const REQUIRED_DATE_ERROR = 'A date is required when using custom date shift';
  const timeComparisonSection = sections.timeComparisonControls({
    multi: false,
    showCalculationType: false,
    showFullChoices: false,
  });
  const timeCompareConfig = (
    timeComparisonSection.controlSetRows[0][0] as CustomControlItem
  ).config;
  const startDateOffsetConfig = (
    timeComparisonSection.controlSetRows[1][0] as CustomControlItem
  ).config;

  const form_data = {
    time_compare: 'custom',
    start_date_offset: '2021-01-01',
  } as unknown as QueryFormData;

  // Build the control states the way the explore store does so they carry the
  // real mapStateToProps / validationDependencies from the control config.
  const controlPanelState = { controls: {}, form_data };
  const initialState: ExploreState = {
    form_data,
    controls: {
      time_compare: getControlStateFromControlConfig(
        timeCompareConfig,
        controlPanelState,
        'custom',
      )!,
      start_date_offset: getControlStateFromControlConfig(
        startDateOffsetConfig,
        controlPanelState,
        '2021-01-01',
      )!,
    },
    undoHistory: EMPTY_UNDO_HISTORY,
  };

  // A valid custom date starts without a validation error.
  expect(initialState.controls.start_date_offset.validationErrors).toEqual([]);

  // 1) Clearing "Shift start date" raises the required-date error (expected).
  const afterClear = exploreReducer(
    initialState,
    setControlValue('start_date_offset', '') as Parameters<
      typeof exploreReducer
    >[1],
  );
  expect(afterClear.controls.start_date_offset.validationErrors).toEqual([
    REQUIRED_DATE_ERROR,
  ]);

  // 2) Switching Time shift to a non-custom preset must clear the stale error.
  const afterSwitch = exploreReducer(
    afterClear,
    setControlValue('time_compare', '1 week ago') as Parameters<
      typeof exploreReducer
    >[1],
  );
  expect(afterSwitch.controls.start_date_offset.validationErrors).toEqual([]);
});

// ---------------------------------------------------------------------------
// Undo / redo history
// ---------------------------------------------------------------------------

type ReducerAction = Parameters<typeof exploreReducer>[1];

const VIZ_A = 'undo-test-viz-a';
const VIZ_B = 'undo-test-viz-b';

const textControl = (
  name: string,
  defaultValue: string,
): CustomControlItem => ({
  name,
  config: { type: 'TextControl', label: name, default: defaultValue },
});

const panelA: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: 'A',
      expanded: true,
      controlSetRows: [
        [textControl('alpha', 'a0')],
        [textControl('beta', 'b0')],
      ],
    },
  ],
};

const panelB: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: 'B',
      expanded: true,
      controlSetRows: [
        [textControl('alpha', 'a0')],
        [textControl('gamma', 'g0')],
      ],
    },
  ],
};

beforeAll(() => {
  getChartControlPanelRegistry().registerValue(VIZ_A, panelA);
  getChartControlPanelRegistry().registerValue(VIZ_B, panelB);
});

afterAll(() => {
  getChartControlPanelRegistry().remove(VIZ_A);
  getChartControlPanelRegistry().remove(VIZ_B);
});

const testDatasource = {
  id: 1,
  type: DatasourceType.Table,
  columns: [],
  metrics: [],
} as unknown as Dataset;

const reduce = (state: ExploreState, ...actions: unknown[]): ExploreState =>
  actions.reduce<ExploreState>(
    (acc, action) => exploreReducer(acc, action as ReducerAction),
    state,
  );

const edit = (controlName: string, value: unknown, programmatic = false) =>
  setControlValue(controlName, value, undefined, { programmatic });

const buildTestState = (
  formData: Record<string, unknown> = {},
  overrides: Partial<ExploreState> = {},
): ExploreState => {
  const inputFormData = {
    viz_type: VIZ_A,
    datasource: '1__table',
    ...formData,
  } as unknown as QueryFormData;
  const base = {
    datasource: testDatasource,
    common: { conf: {} },
    controls: {},
    form_data: inputFormData,
    undoHistory: { past: [], future: [], restoreEpoch: 0 },
    ...overrides,
  } as ExploreState;
  const controls = getControlsState(
    base as unknown as Parameters<typeof getControlsState>[0],
    inputFormData,
  ) as ControlStateMapping;
  return {
    ...base,
    controls,
    form_data: {
      ...inputFormData,
      ...getFormDataFromControls(controls),
    } as QueryFormData,
  };
};

const controlValue = (state: ExploreState, name: string) =>
  state.controls[name]?.value;

test('SET_FIELD_VALUE pushes a frame for a real change and not for an identical value', () => {
  const initial = buildTestState();

  const edited = reduce(initial, edit('alpha', 'a1'));
  expect(edited.undoHistory.past).toEqual([buildHistoryFrame(initial)]);
  expect(edited.undoHistory.future).toEqual([]);

  const unchanged = reduce(edited, edit('alpha', 'a1'));
  expect(unchanged.undoHistory.past).toHaveLength(1);
});

test('SET_FIELD_VALUE never pushes or clears redo for a programmatic dispatch', () => {
  const initial = buildTestState();
  const undone = reduce(initial, edit('alpha', 'a1'), undoExploreAction());
  expect(undone.undoHistory.future).toHaveLength(1);

  const afterProgrammatic = reduce(undone, edit('beta', 'b1', true));

  expect(controlValue(afterProgrammatic, 'beta')).toBe('b1');
  expect(afterProgrammatic.undoHistory.past).toEqual([]);
  expect(afterProgrammatic.undoHistory.future).toEqual(
    undone.undoHistory.future,
  );
});

test('an identical value preserves the redo stack', () => {
  const initial = buildTestState();
  const undone = reduce(initial, edit('alpha', 'a1'), undoExploreAction());

  const afterIdentical = reduce(undone, edit('alpha', 'a0'));

  expect(afterIdentical.undoHistory.future).toEqual(undone.undoHistory.future);
  expect(afterIdentical.undoHistory.past).toEqual([]);
});

test('editing after an undo clears the redo stack so redo becomes a no-op', () => {
  const initial = buildTestState();
  const undone = reduce(
    initial,
    edit('alpha', 'a1'),
    edit('alpha', 'a2'),
    undoExploreAction(),
  );
  expect(controlValue(undone, 'alpha')).toBe('a1');
  expect(undone.undoHistory.future).toHaveLength(1);

  const edited = reduce(undone, edit('alpha', 'a3'));
  expect(edited.undoHistory.future).toEqual([]);

  const redone = reduce(edited, redoExploreAction());
  expect(redone).toBe(edited);
  expect(controlValue(redone, 'alpha')).toBe('a3');
});

test('undo restores the prior form data, hidden form data and controls, and redo re-applies them', () => {
  const initial = buildTestState(
    {},
    { hiddenFormData: { hidden_a: 1 } as unknown as Partial<QueryFormData> },
  );
  const edited = reduce(
    initial,
    edit('alpha', 'a1'),
    setStashFormData(true, ['beta']),
  );
  expect(edited.hiddenFormData).toEqual({ hidden_a: 1, beta: 'b0' });

  const undone = reduce(edited, undoExploreAction());

  expect(undone.hiddenFormData).toEqual({ hidden_a: 1 });
  expect(undone.form_data).toEqual(buildHistoryFrame(initial).formData);
  expect(controlValue(undone, 'alpha')).toBe('a0');
  expect(undone.undoHistory.past).toEqual([]);
  expect(undone.undoHistory.future).toEqual([buildHistoryFrame(edited)]);

  const redone = reduce(undone, redoExploreAction());

  expect(redone.hiddenFormData).toEqual({ hidden_a: 1, beta: 'b0' });
  expect(controlValue(redone, 'alpha')).toBe('a1');
  expect(redone.form_data).toEqual(buildHistoryFrame(edited).formData);
  expect(redone.undoHistory.past).toEqual([buildHistoryFrame(initial)]);
  expect(redone.undoHistory.future).toEqual([]);
});

test('undoing a viz_type change restores the prior form data and the prior viz controls', () => {
  const initial = buildTestState();
  expect(initial.controls).toHaveProperty('beta');
  expect(initial.controls).not.toHaveProperty('gamma');

  const switched = reduce(initial, edit('viz_type', VIZ_B));
  expect(controlValue(switched, 'viz_type')).toBe(VIZ_B);
  expect(switched.controls).toHaveProperty('gamma');
  expect(switched.controls).not.toHaveProperty('beta');

  const undone = reduce(switched, undoExploreAction());

  expect(undone.form_data.viz_type).toBe(VIZ_A);
  expect(controlValue(undone, 'viz_type')).toBe(VIZ_A);
  expect(undone.controls).toHaveProperty('beta');
  expect(undone.controls).not.toHaveProperty('gamma');

  const redone = reduce(undone, redoExploreAction());

  expect(redone.form_data.viz_type).toBe(VIZ_B);
  expect(redone.controls).toHaveProperty('gamma');
  expect(redone.controls).not.toHaveProperty('beta');
});

test('a viz switch followed by SET_STASH_FORM_DATA stays undoable and redoable', () => {
  const initial = buildTestState();

  const switched = reduce(
    initial,
    edit('viz_type', VIZ_B),
    setStashFormData(true, ['gamma']),
  );
  expect(switched.undoHistory.past).toHaveLength(1);
  expect(switched.hiddenFormData).toEqual({ gamma: 'g0' });
  expect(switched.form_data).not.toHaveProperty('gamma');

  const undone = reduce(switched, undoExploreAction());

  expect(undone.hiddenFormData).toEqual({});
  expect(undone.form_data.viz_type).toBe(VIZ_A);
  expect(undone.controls).toHaveProperty('beta');

  const redone = reduce(undone, redoExploreAction());

  expect(redone.hiddenFormData).toEqual({ gamma: 'g0' });
  expect(redone.form_data.viz_type).toBe(VIZ_B);
  expect(redone.controls).toHaveProperty('gamma');
});

test('non-control form data survives an undo', () => {
  const initial = buildTestState({
    dashboardId: '9',
    layer_filter_scope: { 1: { scope: ['ROOT_ID'] } },
  });

  const undone = reduce(initial, edit('alpha', 'a1'), undoExploreAction());

  expect(undone.form_data.dashboardId).toBe('9');
  expect(undone.form_data.layer_filter_scope).toEqual({
    1: { scope: ['ROOT_ID'] },
  });
  expect(controlValue(undone, 'alpha')).toBe('a0');
});

test('history is capped at MAX_HISTORY and undo walks newest to oldest survivor', () => {
  let state = buildTestState();
  for (let i = 1; i <= MAX_HISTORY + 1; i += 1) {
    state = reduce(state, edit('alpha', `v${i}`));
  }
  expect(state.undoHistory.past).toHaveLength(MAX_HISTORY);
  // the very first frame (alpha === 'a0') was evicted, not the newest
  expect(state.undoHistory.past[0].formData.alpha).toBe('v1');

  for (let i = MAX_HISTORY; i >= 1; i -= 1) {
    state = reduce(state, undoExploreAction());
    expect(controlValue(state, 'alpha')).toBe(`v${i}`);
    expect(state.undoHistory.past).toHaveLength(i - 1);
  }

  const atOldest = reduce(state, undoExploreAction());
  expect(atOldest).toBe(state);
  expect(state.undoHistory.future).toHaveLength(MAX_HISTORY);
});

test('undo and redo on an empty stack return the state unchanged', () => {
  const initial = buildTestState();

  expect(reduce(initial, undoExploreAction())).toBe(initial);
  expect(reduce(initial, redoExploreAction())).toBe(initial);
});

test('restoreEpoch is bumped by undo and redo only', () => {
  const initial = buildTestState();
  const edited = reduce(initial, edit('alpha', 'a1'));
  expect(edited.undoHistory.restoreEpoch).toBe(0);

  const undone = reduce(edited, undoExploreAction());
  expect(undone.undoHistory.restoreEpoch).toBe(1);

  const redone = reduce(undone, redoExploreAction());
  expect(redone.undoHistory.restoreEpoch).toBe(2);

  const noop = reduce(redone, redoExploreAction());
  expect(noop.undoHistory.restoreEpoch).toBe(2);
});

const stateWithBothStacks = (): ExploreState => {
  const state = reduce(
    buildTestState(),
    edit('alpha', 'a1'),
    edit('alpha', 'a2'),
    edit('alpha', 'a3'),
    undoExploreAction(),
    undoExploreAction(),
  );
  expect(state.undoHistory.past.length).toBeGreaterThan(0);
  expect(state.undoHistory.future.length).toBeGreaterThan(0);
  expect(state.undoHistory.restoreEpoch).toBe(2);
  return state;
};

const clearTriggers: [string, () => unknown][] = [
  [
    'UPDATE_FORM_DATA_BY_DATASOURCE',
    () =>
      updateFormDataByDatasource(testDatasource, {
        ...testDatasource,
        id: 2,
        uid: '2__table',
      } as unknown as Dataset),
  ],
  ['SET_EXPLORE_CONTROLS', () => setExploreControls({} as QueryFormData)],
  ['SET_FORM_DATA', () => setFormData({ viz_type: VIZ_A } as QueryFormData)],
  [
    'CREATE_NEW_SLICE',
    () =>
      createNewSlice(
        true,
        true,
        true,
        { slice_id: 1 } as Slice,
        {
          viz_type: VIZ_A,
        } as QueryFormData,
      ),
  ],
  [
    'SLICE_UPDATED',
    () => sliceUpdated({ slice_id: 1, slice_name: 'renamed' } as Slice),
  ],
];

test.each(clearTriggers)(
  '%s clears both stacks and preserves restoreEpoch',
  (_name, buildAction) => {
    const state = stateWithBothStacks();

    const cleared = reduce(state, buildAction());

    expect(cleared.undoHistory).toEqual({
      past: [],
      future: [],
      restoreEpoch: 2,
    });
  },
);

test('HYDRATE_EXPLORE clears both stacks and resets restoreEpoch', () => {
  const state = stateWithBothStacks();

  const hydrated = reduce(state, {
    type: HYDRATE_EXPLORE,
    data: { explore: { controls: {}, form_data: {} } },
  });

  expect(hydrated.undoHistory).toEqual({
    past: [],
    future: [],
    restoreEpoch: 0,
  });
});

test('SET_STASH_FORM_DATA does not clear undoHistory', () => {
  const state = stateWithBothStacks();

  const stashed = reduce(state, setStashFormData(true, ['beta']));

  expect(stashed.undoHistory).toEqual(state.undoHistory);
});
