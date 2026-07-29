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
import { isFeatureEnabled } from '@superset-ui/core';
import { addWarningToast } from 'src/components/MessageToasts/actions';
import {
  FORCE_IN_VIEW_EVENT,
  RESTORE_VIRTUALIZATION_EVENT,
} from 'src/dashboard/constants';
import { forceLoadAllCharts, restoreVirtualization } from './downloadUtils';

jest.mock('@superset-ui/core', () => ({
  isFeatureEnabled: jest.fn(),
  FeatureFlag: {
    DashboardVirtualization: 'DASHBOARD_VIRTUALIZATION',
  },
}));

jest.mock('src/dashboard/constants', () => ({
  FORCE_IN_VIEW_EVENT: 'superset-force-all-in-view',
  RESTORE_VIRTUALIZATION_EVENT: 'superset-restore-virtualization',
}));

jest.mock('@apache-superset/core/translation', () => ({
  t: (str: string) => str,
}));

jest.mock('@apache-superset/core/utils', () => ({
  logging: { warn: jest.fn() },
}));

jest.mock('src/components/MessageToasts/actions', () => ({
  addWarningToast: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

test('forceLoadAllCharts returns false and dispatches nothing when virtualization is disabled', async () => {
  mockIsFeatureEnabled.mockReturnValue(false);
  const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
  const container = document.createElement('div');

  const result = await forceLoadAllCharts(container);

  expect(result).toBe(false);
  expect(dispatchSpy).not.toHaveBeenCalled();
});

test('forceLoadAllCharts dispatches the force-in-view event and resolves true once charts finish loading', async () => {
  jest.useFakeTimers();
  mockIsFeatureEnabled.mockReturnValue(true);
  const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
  // No `.loading` elements => charts are considered loaded.
  const container = document.createElement('div');

  const promise = forceLoadAllCharts(container);

  expect(dispatchSpy).toHaveBeenCalledWith(
    expect.objectContaining({ type: FORCE_IN_VIEW_EVENT }),
  );

  await jest.advanceTimersByTimeAsync(1000);
  const result = await promise;

  expect(result).toBe(true);
  expect(addWarningToast).not.toHaveBeenCalled();
});

test('forceLoadAllCharts warns when charts never finish loading before the timeout', async () => {
  jest.useFakeTimers();
  mockIsFeatureEnabled.mockReturnValue(true);
  const container = document.createElement('div');
  const loadingChart = document.createElement('div');
  loadingChart.className = 'loading';
  container.appendChild(loadingChart);

  const promise = forceLoadAllCharts(container);

  // Advance past the 60s timeout while a `.loading` element is still present.
  await jest.advanceTimersByTimeAsync(61_000);
  const result = await promise;

  // Virtualization was active, so the caller must still restore it.
  expect(result).toBe(true);
  expect(addWarningToast).toHaveBeenCalledTimes(1);
});

test('restoreVirtualization dispatches the restore event', () => {
  const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

  restoreVirtualization();

  expect(dispatchSpy).toHaveBeenCalledWith(
    expect.objectContaining({ type: RESTORE_VIRTUALIZATION_EVENT }),
  );
});
