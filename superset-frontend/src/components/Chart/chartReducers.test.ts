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
    const controller = new AbortController();
    charts[chartKey] = {
      ...charts[chartKey],
      queryController: controller,
    };
    const newState = chartReducer(
      charts,
      actions.chartUpdateStopped(chartKey, controller),
    );
    expect(newState[chartKey].chartUpdateEndTime).toBeGreaterThan(0);
    expect(newState[chartKey].chartStatus).toEqual('stopped');
  });

  test('should ignore stopped updates from stale controllers', () => {
    const controller = new AbortController();
    const staleController = new AbortController();
    charts[chartKey] = {
      ...charts[chartKey],
      chartStatus: 'loading',
      queryController: controller,
    };

    const newState = chartReducer(
      charts,
      actions.chartUpdateStopped(chartKey, staleController),
    );

    expect(newState[chartKey].chartStatus).toEqual('loading');
    expect(newState[chartKey].chartUpdateEndTime).toEqual(
      charts[chartKey].chartUpdateEndTime,
    );
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
