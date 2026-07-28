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
import { QueryFormData, VizType } from '@superset-ui/core';
import {
  getChartStateFromHistoryState,
  isSameChartState,
  toChartStateHistoryState,
} from './exploreHistory';

const formData = {
  datasource: '1__table',
  viz_type: VizType.Table,
  slice_id: 7,
} as QueryFormData;

test('round trips form data through the history state', () => {
  expect(
    getChartStateFromHistoryState(toChartStateHistoryState(formData)),
  ).toEqual(formData);
});

test('stamps the chart id on form data that carries none', () => {
  const controlsFormData = { datasource: '1__table' } as QueryFormData;
  expect(
    getChartStateFromHistoryState(
      toChartStateHistoryState(controlsFormData, 7),
    ),
  ).toEqual({ ...controlsFormData, slice_id: 7 });
  expect(
    getChartStateFromHistoryState(toChartStateHistoryState(formData, 8)),
  ).toEqual(formData);
});

test('ignores history states that hold no chart state', () => {
  expect(getChartStateFromHistoryState(undefined)).toBeUndefined();
  expect(
    getChartStateFromHistoryState({ saveAction: 'overwrite' }),
  ).toBeUndefined();
  expect(getChartStateFromHistoryState(formData)).toBeUndefined();
});

test('matches chart states of the same chart and dataset only', () => {
  expect(isSameChartState(formData, { ...formData, row_limit: 10 })).toBe(true);
  expect(isSameChartState(formData, { ...formData, slice_id: 8 })).toBe(false);
  expect(
    isSameChartState(formData, { ...formData, datasource: '2__table' }),
  ).toBe(false);
  expect(isSameChartState(formData, undefined)).toBe(false);
});

test('treats a missing slice id as the unsaved chart', () => {
  const newChart = { datasource: '1__table' } as QueryFormData;
  expect(isSameChartState(newChart, { ...newChart, slice_id: 0 })).toBe(true);
  expect(isSameChartState(newChart, { ...newChart, slice_id: 7 })).toBe(false);
});
