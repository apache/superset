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
  QueryFormData,
  getChartControlPanelRegistry,
} from '@superset-ui/core';
import {
  ControlConfig,
  ControlPanelState,
  ControlState,
  CustomControlItem,
  Dataset,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import {
  findControlItem,
  getControlStateFromControlConfig,
  getFormDataFromControls,
} from 'src/explore/controlUtils';
import tableControlPanel from '../../../plugins/plugin-chart-table/src/controlPanel';
import exploreReducer, { ExploreState } from './exploreReducer';
import {
  setCompatibility,
  setControlValue,
  setStashFormData,
} from '../actions/exploreActions';
import { CompatibilityResult } from '../types';

test('reset hiddenFormData on SET_STASH_FORM_DATA', () => {
  const initialState: ExploreState = {
    form_data: { a: 3, c: 4 } as unknown as QueryFormData,
    controls: {},
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

type ReducerAction = Parameters<typeof exploreReducer>[1];

type MirrorControlState = ControlState & { mirroredValue?: unknown };

// A control whose derived props depend on another control's current value.
const mirrorOf = (sourceControl: string): ControlConfig =>
  ({
    type: 'TextControl',
    mapStateToProps: (state: ControlPanelState) => ({
      mirroredValue: state.controls?.[sourceControl]?.value,
    }),
  }) as unknown as ControlConfig;

const buildControl = (
  config: ControlConfig,
  formData: QueryFormData,
  value: unknown,
  controls: Record<string, ControlState> = {},
) =>
  getControlStateFromControlConfig(
    config,
    { controls, form_data: formData },
    value as never,
  )!;

test('SET_FIELD_VALUE re-derives controls listed in `rerender` from the updated control value', () => {
  const form_data = {
    matrixify_mode_rows: 'disabled',
    matrixify_mode_columns: 'disabled',
  } as unknown as QueryFormData;
  const initialState: ExploreState = {
    form_data,
    controls: {
      matrixify_mode_rows: buildControl(
        sharedControls.matrixify_mode_rows as unknown as ControlConfig,
        form_data,
        'disabled',
      ),
      matrixify_mode_columns: buildControl(
        sharedControls.matrixify_mode_columns as unknown as ControlConfig,
        form_data,
        'disabled',
      ),
      matrixify_dimension_rows: buildControl(
        sharedControls.matrixify_dimension_rows as unknown as ControlConfig,
        form_data,
        { dimension: '', values: [] },
      ),
    },
  };
  const metricsOption = (state: ExploreState) =>
    (
      state.controls.matrixify_mode_columns.options as Array<{
        value: string;
        disabled?: boolean;
      }>
    ).find(option => option.value === 'metrics');

  // Columns offer "metrics" while the rows axis is not using it.
  expect(metricsOption(initialState)?.disabled).toBe(false);

  const newState = exploreReducer(
    initialState,
    setControlValue('matrixify_mode_rows', 'metrics') as ReducerAction,
  );

  // The rows axis now owns "metrics", so the columns control must be
  // re-derived without the user touching it.
  expect(metricsOption(newState)?.disabled).toBe(true);
  expect(newState.controls.matrixify_mode_columns.value).toBe('disabled');
});

test('SET_FIELD_VALUE leaves controls that are not listed in `rerender` stale', () => {
  const form_data = { source: 'a' } as unknown as QueryFormData;
  const plain = { type: 'TextControl' } as unknown as ControlConfig;
  const buildState = (rerender: string[]): ExploreState => {
    const source = buildControl(
      { ...plain, rerender } as unknown as ControlConfig,
      form_data,
      'a',
    );
    const controls = { source };
    return {
      form_data,
      controls: {
        source,
        listed: buildControl(mirrorOf('source'), form_data, null, controls),
        unlisted: buildControl(mirrorOf('source'), form_data, null, controls),
      },
    };
  };
  const mirrored = (state: ExploreState, name: string) =>
    (state.controls[name] as MirrorControlState).mirroredValue;

  const initialState = buildState(['listed']);
  expect(mirrored(initialState, 'listed')).toBe('a');
  expect(mirrored(initialState, 'unlisted')).toBe('a');

  const newState = exploreReducer(
    initialState,
    setControlValue('source', 'b') as ReducerAction,
  );

  expect(mirrored(newState, 'listed')).toBe('b');
  expect(mirrored(newState, 'unlisted')).toBe('a');
});

test('SET_FIELD_VALUE only re-validates controls that declare the changed control in `validationDependencies`', () => {
  const STALE_ERROR = 'Driven by the changed control';
  const requiresOk = (declaresDependency: boolean): ControlConfig =>
    ({
      type: 'TextControl',
      mapStateToProps: (state: ControlPanelState) => ({
        externalValidationErrors:
          state.form_data.source === 'bad' ? [STALE_ERROR] : [],
      }),
      ...(declaresDependency && { validationDependencies: ['source'] }),
    }) as unknown as ControlConfig;

  const form_data = { source: 'bad' } as unknown as QueryFormData;
  const initialState: ExploreState = {
    form_data,
    controls: {
      source: buildControl(
        { type: 'TextControl' } as unknown as ControlConfig,
        form_data,
        'bad',
      ),
      declared: buildControl(requiresOk(true), form_data, 'x'),
      undeclared: buildControl(requiresOk(false), form_data, 'x'),
    },
  };

  // Both dependents start out in error.
  expect(initialState.controls.declared.validationErrors).toEqual([
    STALE_ERROR,
  ]);
  expect(initialState.controls.undeclared.validationErrors).toEqual([
    STALE_ERROR,
  ]);

  const newState = exploreReducer(
    initialState,
    setControlValue('source', 'good') as ReducerAction,
  );

  // The declared dependent re-validates against the new value; the other one
  // keeps the error because nothing tells the reducer to re-run it.
  expect(newState.controls.declared.validationErrors).toEqual([]);
  expect(newState.controls.undeclared.validationErrors).toEqual([STALE_ERROR]);
});

test('SET_FIELD_VALUE raises a dependent control error when the changed control makes it invalid', () => {
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
    time_compare: '1 week ago',
    start_date_offset: '',
  } as unknown as QueryFormData;
  const controlPanelState = { controls: {}, form_data };
  const initialState: ExploreState = {
    form_data,
    controls: {
      time_compare: getControlStateFromControlConfig(
        timeCompareConfig,
        controlPanelState,
        '1 week ago',
      )!,
      start_date_offset: getControlStateFromControlConfig(
        startDateOffsetConfig,
        controlPanelState,
        '',
      )!,
    },
  };
  // An empty start date is fine until the shift becomes "custom".
  expect(initialState.controls.start_date_offset.validationErrors).toEqual([]);

  const newState = exploreReducer(
    initialState,
    setControlValue('time_compare', 'custom') as ReducerAction,
  );

  expect(newState.controls.start_date_offset.validationErrors).toEqual([
    REQUIRED_DATE_ERROR,
  ]);
});

test('explicit semantic reset removes stale fields and stash and persists only new generation', () => {
  const datasource = {
    id: 7,
    uid: 'cube:Orders',
    type: DatasourceType.SemanticView,
    semantic_selection_version: 'cube-member-id-v1',
    columns: [],
    metrics: [],
    verbose_map: {},
    column_formats: {},
    main_dttm_col: '',
    datasource_name: 'Orders',
    description: null,
  } as Dataset;
  getChartControlPanelRegistry().registerValue('identity-test', {
    // Exercise Explore's default section, without injecting the shared section.
    controlPanelSections: [],
  });
  const initial: ExploreState = {
    datasource,
    controls: {},
    form_data: {
      datasource: '7__semantic_view',
      viz_type: 'identity-test',
      slice_id: 12,
      metrics: ['Orders.b'],
      column_config: { 'Orders.b': {} },
    },
    hiddenFormData: { metrics: ['Orders.b'] },
  };
  const refreshed = exploreReducer(initial, {
    type: 'SYNC_DATASOURCE_METADATA',
    datasource,
  });
  expect(refreshed.form_data.semantic_selection_version).toBeUndefined();
  const reset = exploreReducer(initial, { type: 'RESET_SEMANTIC_SELECTIONS' });
  expect(reset.form_data).toEqual({
    datasource: '7__semantic_view',
    viz_type: 'identity-test',
    slice_id: 12,
    semantic_selection_version: 'cube-member-id-v1',
  });
  expect(reset.hiddenFormData).toEqual({});
  expect(
    getFormDataFromControls(reset.controls).semantic_selection_version,
  ).toBe('cube-member-id-v1');
  getChartControlPanelRegistry().remove('identity-test');
});

test('SET_FIELD_VALUE refreshes semantic ordering choices and removes stale sorts', () => {
  const allColumnsConfig = (
    findControlItem(
      tableControlPanel.controlPanelSections,
      'all_columns',
    ) as CustomControlItem | null
  )?.config;
  const orderingConfig = (
    findControlItem(
      tableControlPanel.controlPanelSections,
      'order_by_cols',
    ) as CustomControlItem | null
  )?.config;
  const form_data = {
    datasource: '1__semantic_view',
    viz_type: 'table',
    all_columns: ['song_name', 'artist_name'],
    order_by_cols: ['["song_name",true]', '["artist_name",false]'],
  } as QueryFormData;
  const datasource = {
    type: DatasourceType.SemanticView,
    columns: [
      { column_name: 'song_name' },
      { column_name: 'artist_name' },
      { column_name: 'played_at' },
    ],
  } as ExploreState['datasource'];
  const allColumns = getControlStateFromControlConfig(
    allColumnsConfig ?? null,
    { controls: {}, form_data, datasource },
    form_data.all_columns,
  );
  const initialState: ExploreState = {
    form_data,
    datasource,
    controls: {
      all_columns: allColumns!,
      order_by_cols: getControlStateFromControlConfig(
        orderingConfig ?? null,
        { controls: { all_columns: allColumns! }, form_data, datasource },
        form_data.order_by_cols,
      )!,
    },
  };

  expect(initialState.controls.order_by_cols.value).toEqual([
    '["song_name",true]',
    '["artist_name",false]',
  ]);

  const afterChange = exploreReducer(
    initialState,
    setControlValue('all_columns', ['song_name', 'played_at']) as Parameters<
      typeof exploreReducer
    >[1],
  );

  expect(afterChange.controls.order_by_cols.choices).toEqual([
    ['["song_name",true]', 'song_name [asc]'],
    ['["song_name",false]', 'song_name [desc]'],
    ['["played_at",true]', 'played_at [asc]'],
    ['["played_at",false]', 'played_at [desc]'],
  ]);
  expect(afterChange.controls.order_by_cols.value).toEqual([
    '["song_name",true]',
  ]);
  expect(afterChange.form_data.order_by_cols).toEqual(['["song_name",true]']);
});

// Regression guards for the standalone Time Range control.
//
// `time_range`'s mapStateToProps decides whether the range is mirrored onto a
// partition column, and its two inputs are handled by two different mechanisms.
// The temporal column lives on another control, so `validationDependencies`
// covers it here. The range itself is recomputed at render from the live
// explore state (`ControlPanelsContainer`), because a control that named itself
// as a dependency would be rebuilt by the reducer from its own superseded
// value -- which silently dropped every Time Range change on the charts that
// still carry this control. That transition is covered in
// `src/explore/components/ControlPanelsContainer.test.tsx`.
const PARTITION_FILTER_MAPPING = {
  partition_column: 'dt_epoch',
  mapped_column: 'event_time',
  active: true,
  is_monotonic: true,
  mirrorable_operators: ['<', '<=', '==', '>', '>=', 'IN', 'TEMPORAL_RANGE'],
};

function mirroredTimeRangeState(): ExploreState {
  const datasource = {
    main_dttm_col: 'event_time',
    always_filter_main_dttm: false,
    columns: [{ column_name: 'event_time', is_dttm: true }],
    metrics: [],
    partition_filter_mapping: PARTITION_FILTER_MAPPING,
  } as unknown as ExploreState['datasource'];
  const form_data = {
    granularity_sqla: 'event_time',
    time_range: '2026-01-01 : 2026-02-01',
  } as unknown as QueryFormData;
  const controlPanelState = { controls: {}, form_data, datasource };

  return {
    form_data,
    datasource,
    controls: {
      time_range: getControlStateFromControlConfig(
        sharedControls.time_range,
        controlPanelState,
        form_data.time_range,
      )!,
      granularity_sqla: getControlStateFromControlConfig(
        sharedControls.granularity_sqla,
        controlPanelState,
        form_data.granularity_sqla,
      )!,
    },
  } as ExploreState;
}

test('SET_FIELD_VALUE drops the time range partition mapping when the temporal column is not the mapped one', () => {
  const initialState = mirroredTimeRangeState();

  const afterColumnSwitch = exploreReducer(
    initialState,
    setControlValue('granularity_sqla', 'ingested_at') as Parameters<
      typeof exploreReducer
    >[1],
  );
  expect(afterColumnSwitch.controls.time_range.partitionMapping).toBeNull();
});

test('SET_FIELD_VALUE applies the new time range to the control, not just the form data', () => {
  const initialState = mirroredTimeRangeState();

  const afterRealRange = exploreReducer(
    initialState,
    setControlValue('time_range', '2026-03-01 : 2026-04-01') as Parameters<
      typeof exploreReducer
    >[1],
  );

  expect(afterRealRange.form_data.time_range).toBe('2026-03-01 : 2026-04-01');
  // The query is built from the controls, not from `form_data`, so a control
  // left holding the superseded range sends the superseded range.
  expect(afterRealRange.controls.time_range.value).toBe(
    '2026-03-01 : 2026-04-01',
  );
});

test('SET_FIELD_VALUE ignores a control that names itself as a dependency', () => {
  // `validationDependencies` names *other* controls. The rebuild it triggers
  // reuses the value held before the action, so a self-naming control would
  // overwrite the value just set. Nothing in the tree does this, and the
  // reducer makes sure nothing can.
  const selfDependentState = {
    form_data: { row_limit: 100 } as unknown as QueryFormData,
    controls: {
      row_limit: {
        type: 'SelectControl',
        value: 100,
        validationDependencies: ['row_limit'],
      },
    },
  } as unknown as ExploreState;

  const afterChange = exploreReducer(
    selfDependentState,
    setControlValue('row_limit', 500) as Parameters<typeof exploreReducer>[1],
  );

  expect(afterChange.controls.row_limit.value).toBe(500);
});
