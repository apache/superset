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
  t: (str: string, values?: Record<string, unknown>) =>
    values ? `${str} ${JSON.stringify(values)}` : str,
}));

jest.mock('@apache-superset/core/utils', () => ({
  logging: { warn: jest.fn() },
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

function makeRow(id: string, loading = false): HTMLDivElement {
  const row = document.createElement('div');
  row.setAttribute('data-row-id', id);
  if (loading) {
    const spinner = document.createElement('div');
    spinner.className = 'loading';
    row.appendChild(spinner);
  }
  return row;
}

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
  const mockAddWarningToast = jest.fn();

  const promise = forceLoadAllCharts(container, undefined, mockAddWarningToast);

  expect(dispatchSpy).toHaveBeenCalledWith(
    expect.objectContaining({ type: FORCE_IN_VIEW_EVENT }),
  );

  await jest.advanceTimersByTimeAsync(1000);
  const result = await promise;

  expect(result).toBe(true);
  expect(mockAddWarningToast).not.toHaveBeenCalled();
});

test('forceLoadAllCharts warns via the bound callback when charts never finish loading before the timeout', async () => {
  jest.useFakeTimers();
  mockIsFeatureEnabled.mockReturnValue(true);
  const container = document.createElement('div');
  const loadingChart = document.createElement('div');
  loadingChart.className = 'loading';
  container.appendChild(loadingChart);
  const mockAddWarningToast = jest.fn();

  const promise = forceLoadAllCharts(container, undefined, mockAddWarningToast);

  // Advance past the 60s timeout while a `.loading` element is still present.
  await jest.advanceTimersByTimeAsync(61_000);
  const result = await promise;

  // Virtualization was active, so the caller must still restore it.
  expect(result).toBe(true);
  expect(mockAddWarningToast).toHaveBeenCalledWith(
    'Some charts did not finish loading. The export may be incomplete.',
  );
});

test('forceLoadAllCharts does not throw when charts time out and no toast callback is provided', async () => {
  jest.useFakeTimers();
  mockIsFeatureEnabled.mockReturnValue(true);
  const container = document.createElement('div');
  const loadingChart = document.createElement('div');
  loadingChart.className = 'loading';
  container.appendChild(loadingChart);

  const promise = forceLoadAllCharts(container);

  await jest.advanceTimersByTimeAsync(61_000);
  await expect(promise).resolves.toBe(true);
});

test('forceLoadAllCharts dispatches a single force-in-view event when rows fit in one batch', async () => {
  jest.useFakeTimers();
  mockIsFeatureEnabled.mockReturnValue(true);
  const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
  const container = document.createElement('div');
  container.append(makeRow('a'), makeRow('b'), makeRow('c'));

  const mockAddInfoToast = jest.fn();
  const promise = forceLoadAllCharts(
    container,
    undefined,
    undefined,
    mockAddInfoToast,
  );
  await jest.advanceTimersByTimeAsync(2000);
  const result = await promise;

  expect(result).toBe(true);
  expect(mockAddInfoToast).not.toHaveBeenCalled();
  const forceEvents = dispatchSpy.mock.calls
    .map(([event]) => event as Event)
    .filter(event => event.type === FORCE_IN_VIEW_EVENT);
  expect(forceEvents).toHaveLength(1);
  expect((forceEvents[0] as CustomEvent).detail).toBeUndefined();
});

test('forceLoadAllCharts batches rows in groups rather than forcing everything at once', async () => {
  jest.useFakeTimers();
  mockIsFeatureEnabled.mockReturnValue(true);
  const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
  const container = document.createElement('div');
  const rowIds = Array.from({ length: 12 }, (_, i) => `row-${i}`);
  rowIds.forEach(id => container.appendChild(makeRow(id)));

  const onProgress = jest.fn();
  const mockAddInfoToast = jest.fn();
  const promise = forceLoadAllCharts(
    container,
    onProgress,
    undefined,
    mockAddInfoToast,
  );

  // 3 sequential batch waits + the final whole-container check, ~1s each
  // since nothing is ever `.loading`.
  await jest.advanceTimersByTimeAsync(5000);
  const result = await promise;

  expect(result).toBe(true);
  // Goes through the bound callback, never the raw action creator (which
  // would only build an action object this module has no way to dispatch).
  expect(mockAddInfoToast).toHaveBeenCalledTimes(1);
  expect(mockAddInfoToast).toHaveBeenCalledWith(
    expect.stringContaining('Preparing %(count)s charts for export'),
  );

  const forceEvents = dispatchSpy.mock.calls
    .map(([event]) => event as CustomEvent<{ rowIds: string[] }>)
    .filter(event => event.type === FORCE_IN_VIEW_EVENT);

  expect(forceEvents).toHaveLength(3);
  expect(forceEvents[0].detail.rowIds).toEqual(rowIds.slice(0, 5));
  expect(forceEvents[1].detail.rowIds).toEqual(rowIds.slice(5, 10));
  expect(forceEvents[2].detail.rowIds).toEqual(rowIds.slice(10, 12));

  expect(onProgress).toHaveBeenNthCalledWith(1, {
    loadedBatches: 1,
    totalBatches: 3,
  });
  expect(onProgress).toHaveBeenNthCalledWith(2, {
    loadedBatches: 2,
    totalBatches: 3,
  });
  expect(onProgress).toHaveBeenNthCalledWith(3, {
    loadedBatches: 3,
    totalBatches: 3,
  });
});

test('forceLoadAllCharts moves on to the next batch even if the current one times out', async () => {
  jest.useFakeTimers();
  mockIsFeatureEnabled.mockReturnValue(true);
  const container = document.createElement('div');
  // Batch 1 (5 rows): one spinner is slow to clear.
  const stuck = makeRow('stuck', true);
  container.appendChild(stuck);
  for (let i = 1; i < 5; i += 1) {
    container.appendChild(makeRow(`row-${i}`));
  }
  // Batch 2 (1 row): loads fine.
  container.appendChild(makeRow('row-5'));

  const onProgress = jest.fn();
  const mockAddWarningToast = jest.fn();
  const promise = forceLoadAllCharts(
    container,
    onProgress,
    mockAddWarningToast,
  );

  // Batch 1 gives up waiting at the 10s per-batch cap since `stuck` hasn't
  // cleared yet, but moves on to batch 2 (which has nothing loading and
  // resolves on its own first poll) instead of blocking the whole export
  // on one slow chart.
  await jest.advanceTimersByTimeAsync(12_000);
  expect(onProgress).toHaveBeenCalledTimes(2);

  // The chart finishes just after its batch gave up on it. The final
  // whole-container check (a safety net for exactly this) should pick that
  // up on its next poll rather than needing its own full 60s timeout.
  stuck.querySelector('.loading')?.remove();
  await jest.advanceTimersByTimeAsync(1000);
  const result = await promise;

  expect(result).toBe(true);
  expect(mockAddWarningToast).not.toHaveBeenCalled();
});

test('forceLoadAllCharts caps the total wait across batches to the overall deadline', async () => {
  jest.useFakeTimers();
  mockIsFeatureEnabled.mockReturnValue(true);
  const container = document.createElement('div');
  // 8 batches of 5 rows, every row permanently `.loading`: with no overall
  // deadline this would burn a full 10s per batch (80s) plus another 60s on
  // the final whole-container check (140s total) before giving up.
  const rowIds = Array.from({ length: 40 }, (_, i) => `row-${i}`);
  rowIds.forEach(id => container.appendChild(makeRow(id, true)));
  const mockAddWarningToast = jest.fn();

  const promise = forceLoadAllCharts(container, undefined, mockAddWarningToast);

  // Comfortably past the 60s overall budget, but far short of the 140s the
  // unbounded, per-timeout-summed behavior would have required.
  await jest.advanceTimersByTimeAsync(65_000);
  const result = await promise;

  expect(result).toBe(true);
  expect(mockAddWarningToast).toHaveBeenCalledTimes(1);
});

test('restoreVirtualization dispatches the restore event', () => {
  const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

  restoreVirtualization();

  expect(dispatchSpy).toHaveBeenCalledWith(
    expect.objectContaining({ type: RESTORE_VIRTUALIZATION_EVENT }),
  );
});
