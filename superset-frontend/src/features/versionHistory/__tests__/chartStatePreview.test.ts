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
import chartReducer from 'src/components/Chart/chartReducer';
import {
  REPLACE_CHART_STATE,
  replaceChartState,
} from 'src/components/Chart/chartAction';
import type { ChartState } from 'src/explore/types';

test('replaceChartState builds a REPLACE_CHART_STATE action with key + state', () => {
  const state = {
    id: 42,
    chartStatus: 'success',
    queriesResponse: [{ data: ['captured'] }],
    chartUpdateEndTime: 1,
  } as unknown as ChartState;
  expect(replaceChartState(42, state)).toEqual({
    type: REPLACE_CHART_STATE,
    key: 42,
    state,
  });
});

test('chart reducer overwrites the keyed entry on REPLACE_CHART_STATE, leaving others alone', () => {
  const captured = {
    id: 42,
    chartStatus: 'success',
    chartAlert: null,
    chartStackTrace: null,
    chartUpdateEndTime: 1,
    chartUpdateStartTime: 0,
    latestQueryFormData: { metric: 'count' },
    sliceFormData: null,
    queryController: null,
    queriesResponse: [{ data: ['captured'] }],
    triggerQuery: false,
    lastRendered: 0,
  } as unknown as ChartState;
  // Simulate state.charts after preview queries have polluted entry 42.
  const polluted = {
    42: {
      id: 42,
      chartStatus: 'success',
      latestQueryFormData: { metric: 'snapshot_metric' },
      queriesResponse: [{ data: ['snapshot data'] }],
    } as unknown as ChartState,
    99: {
      id: 99,
      chartStatus: 'rendered',
    } as unknown as ChartState,
  };
  const next = chartReducer(polluted, {
    type: REPLACE_CHART_STATE,
    key: 42,
    state: captured,
  } as unknown as Parameters<typeof chartReducer>[1]);
  // Entry 42 is the captured snapshot, byte-for-byte.
  expect(next[42]).toBe(captured);
  // Unrelated entry is untouched.
  expect(next[99]).toBe(polluted[99]);
});

test('chart reducer leaves charts untouched for unrelated action types', () => {
  const charts = {
    1: { id: 1, chartStatus: 'success' } as unknown as ChartState,
  };
  expect(chartReducer(charts, { type: 'SOMETHING_ELSE' })).toBe(charts);
});
