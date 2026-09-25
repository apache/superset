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

import { QueryFormData } from '@superset-ui/core';
import {
  sections,
  sharedControls,
  CustomControlItem,
} from '@superset-ui/chart-controls';
import { getControlStateFromControlConfig } from 'src/explore/controlUtils';
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
