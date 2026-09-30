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
  ControlConfig,
  ControlPanelState,
  ControlState,
  CustomControlItem,
  sections,
  sharedControls,
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
