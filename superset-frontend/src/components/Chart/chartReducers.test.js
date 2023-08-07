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
import sinon from 'sinon';
import chartReducer, { chart } from 'src/components/Chart/chartReducer';
import * as actions from 'src/components/Chart/chartAction';

describe('chart reducers', () => {
  const chartKey = 1;
  let testChart;
  let charts;
  beforeEach(() => {
    testChart = {
      ...chart,
      id: chartKey,
    };
    charts = { [chartKey]: testChart };
  });

  it('should update endtime on fail', () => {
    const newState = chartReducer(charts, actions.chartUpdateStopped(chartKey));
    expect(newState[chartKey].chartUpdateEndTime).toBeGreaterThan(0);
    expect(newState[chartKey].chartStatus).toEqual('stopped');
  });

  it('should update endtime on timeout', () => {
    const newState = chartReducer(
      charts,
      actions.chartUpdateFailed(
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
        },
        chartKey,
      ),
    );
    expect(newState[chartKey].chartUpdateEndTime).toBeGreaterThan(0);
    expect(newState[chartKey].chartStatus).toEqual('failed');
  });
});

describe('async query reducers', () => {
  const chartKey = 1;
  const testJobId = 'test-job-id';
  let testChart;
  let charts;
  let stopAsyncJobStub;
  beforeEach(() => {
    testChart = {
      ...chart,
      id: chartKey,
    };
    charts = { [chartKey]: testChart };
    stopAsyncJobStub = sinon.stub(actions, 'stopAsyncJob');
  });

  afterEach(() => {
    stopAsyncJobStub.restore();
  });

  it('should update job id when async query started', () => {
    const newState = chartReducer(
      charts,
      actions.asyncQueryStarted(testJobId, chartKey),
    );
    expect(newState[chartKey].asyncQueryJobId).toEqual(testJobId);
  });

  it('should remove job id when async query finished', () => {
    const newState = chartReducer(charts, actions.asyncQuerySuccess(chartKey));
    expect(newState[chartKey].asyncQueryJobId).toEqual(null);
  });

  it('should stop job when async query stopped', () => {
    const initState = chartReducer(
      charts,
      actions.asyncQueryStarted(testJobId, chartKey),
    );
    const newState = chartReducer(initState, actions.asyncQueryStop(chartKey));

    expect(newState[chartKey].asyncQueryJobId).toEqual(null);
    expect(stopAsyncJobStub.calledOnce).toBeTruthy();
    expect(stopAsyncJobStub.args[0][0]).toEqual(testJobId);
  });

  it('should not stop job when already succeeded', () => {
    const stateAfterStart = chartReducer(
      charts,
      actions.asyncQueryStarted(testJobId, chartKey),
    );
    const stateAfterSuccess = chartReducer(
      stateAfterStart,
      actions.asyncQuerySuccess(chartKey),
    );
    chartReducer(stateAfterSuccess, actions.asyncQueryStop(chartKey));

    expect(stopAsyncJobStub.notCalled).toBeTruthy();
  });
});
