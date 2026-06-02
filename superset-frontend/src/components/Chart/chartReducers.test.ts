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
import { JsonObject } from '@superset-ui/core';
import chartReducer, { chart } from 'src/components/Chart/chartReducer';
import * as actions from 'src/components/Chart/chartAction';
import { ChartState } from 'src/explore/types';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('chart reducers', () => {
  const chartKey = 1;
  let testChart: ChartState;
  let charts: Record<number, ChartState>;
  beforeEach(() => {
    testChart = {
      ...chart,
      id: chartKey,
    };
    charts = { [chartKey]: testChart };
  });

  test('should update endtime on fail', () => {
    const newState = chartReducer(charts, actions.chartUpdateStopped(chartKey));
    expect(newState[chartKey].chartUpdateEndTime).toBeGreaterThan(0);
    expect(newState[chartKey].chartStatus).toEqual('stopped');
  });

  test('should handle chartUpdateStopped without queryController', () => {
    const newState = chartReducer(charts, actions.chartUpdateStopped(chartKey));
    expect(newState[chartKey].chartStatus).toEqual('stopped');
    expect(newState[chartKey].chartAlert).toContain(
      'Updating chart was stopped',
    );
    expect(newState[chartKey].chartUpdateEndTime).toBeGreaterThan(0);
  });

  test('chartUpdateStopped sets state correctly', () => {
    const chartsWithController = {
      [chartKey]: {
        ...testChart,
        queryController: new AbortController(),
      },
    };
    const newState = chartReducer(
      chartsWithController,
      actions.chartUpdateStopped(chartKey),
    );
    // Verify the chart status and alert are set
    expect(newState[chartKey].chartStatus).toEqual('stopped');
    expect(newState[chartKey].chartAlert).toContain(
      'Updating chart was stopped',
    );
  });

  test('chartUpdateStopped is a no-op when the chart key is missing', () => {
    const empty: Record<number, ChartState> = {};
    const newState = chartReducer(empty, actions.chartUpdateStopped(999));
    expect(newState).toBe(empty);
  });

  test('chartUpdateStarted is a no-op when the chart key is missing', () => {
    const empty: Record<number, ChartState> = {};
    const newState = chartReducer(
      empty,
      actions.chartUpdateStarted(new AbortController(), {}, 999),
    );
    expect(newState).toBe(empty);
  });

  test('chartUpdateSucceeded is a no-op when the chart key is missing', () => {
    const empty: Record<number, ChartState> = {};
    const newState = chartReducer(empty, actions.chartUpdateSucceeded([], 999));
    expect(newState).toBe(empty);
  });

  test('chartUpdateFailed is a no-op when the chart key is missing', () => {
    const empty: Record<number, ChartState> = {};
    const newState = chartReducer(empty, actions.chartUpdateFailed([], 999));
    expect(newState).toBe(empty);
  });

  test('addChart still seeds an entry when no prior state exists', () => {
    const empty: Record<number, ChartState> = {};
    const newState = chartReducer(
      empty,
      actions.addChart({ id: 42, formData: {} } as unknown as ChartState, 42),
    );
    expect(newState[42]).toBeDefined();
    expect(newState[42].id).toEqual(42);
  });

  test('should update endtime on timeout', () => {
    const newState = chartReducer(
      charts,
      actions.chartUpdateFailed(
        [
          {
            statusText: 'timeout',
            error: 'Request timed out',
            errors: [
              {
                error_type: 'FRONTEND_TIMEOUT_ERROR',
                extra: { timeout: 1 },
                level: 'error',
                message: 'Request timed out',
              },
            ],
          } as JsonObject,
        ],
        chartKey,
      ),
    );
    expect(newState[chartKey].chartUpdateEndTime).toBeGreaterThan(0);
    expect(newState[chartKey].chartStatus).toEqual('failed');
  });
});
