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
import { sections, CustomControlItem } from '@superset-ui/chart-controls';
import { getControlStateFromControlConfig } from 'src/explore/controlUtils';
import exploreReducer, { ExploreState } from './exploreReducer';
import { setControlValue, setStashFormData } from '../actions/exploreActions';

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
