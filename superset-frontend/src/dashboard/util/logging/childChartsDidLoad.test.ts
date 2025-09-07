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
import { ChartState } from 'src/explore/types';
import { Layout } from 'src/dashboard/types';
import childChartsDidLoad from './childChartsDidLoad';

import mockFindNonTabChildChartIdsImport from './findNonTabChildChartIds';

// Mock the findNonTabChildChartIds dependency
jest.mock('./findNonTabChildChartIds', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockFindNonTabChildChartIds =
  mockFindNonTabChildChartIdsImport as jest.MockedFunction<
    typeof mockFindNonTabChildChartIdsImport
  >;

describe('childChartsDidLoad', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns didLoad true when all charts are in completed states', () => {
    const chartIds = [1, 2, 3];
    const layout: Layout = {};
    const chartQueries: Record<string, Partial<ChartState>> = {
      '1': { chartStatus: 'rendered', chartUpdateStartTime: 100 },
      '2': { chartStatus: 'stopped', chartUpdateStartTime: 200 },
      '3': { chartStatus: 'failed', chartUpdateStartTime: 150 },
    };

    mockFindNonTabChildChartIds.mockReturnValue(chartIds);

    const result = childChartsDidLoad({
      chartQueries,
      layout,
      id: 'test-id',
    });

    expect(result.didLoad).toBe(true);
    expect(result.minQueryStartTime).toBe(100);
    expect(mockFindNonTabChildChartIds).toHaveBeenCalledWith({
      id: 'test-id',
      layout,
    });
  });

  test('returns didLoad false when some charts are in loading state', () => {
    const chartIds = [1, 2, 3];
    const layout: Layout = {};
    const chartQueries: Record<string, Partial<ChartState>> = {
      '1': { chartStatus: 'rendered', chartUpdateStartTime: 100 },
      '2': { chartStatus: 'loading', chartUpdateStartTime: 200 },
      '3': { chartStatus: 'failed', chartUpdateStartTime: 150 },
    };

    mockFindNonTabChildChartIds.mockReturnValue(chartIds);

    const result = childChartsDidLoad({
      chartQueries,
      layout,
      id: 'test-id',
    });

    expect(result.didLoad).toBe(false);
    expect(result.minQueryStartTime).toBe(100);
  });

  test('handles missing chart queries gracefully', () => {
    const chartIds = [1, 2, 3];
    const layout: Layout = {};
    const chartQueries: Record<string, Partial<ChartState>> = {
      '1': { chartStatus: 'rendered', chartUpdateStartTime: 100 },
      // Chart 2 is missing from queries
      '3': { chartStatus: 'failed', chartUpdateStartTime: 150 },
    };

    mockFindNonTabChildChartIds.mockReturnValue(chartIds);

    const result = childChartsDidLoad({
      chartQueries,
      layout,
      id: 'test-id',
    });

    expect(result.didLoad).toBe(false);
    expect(result.minQueryStartTime).toBe(0);
  });

  test('handles empty chart queries object', () => {
    const chartIds = [1, 2, 3];
    const layout: Layout = {};
    const chartQueries: Record<string, Partial<ChartState>> = {};

    mockFindNonTabChildChartIds.mockReturnValue(chartIds);

    const result = childChartsDidLoad({
      chartQueries,
      layout,
      id: 'test-id',
    });

    expect(result.didLoad).toBe(false);
    expect(result.minQueryStartTime).toBe(0);
  });

  test('handles empty chart IDs array', () => {
    const chartIds: number[] = [];
    const layout: Layout = {};
    const chartQueries: Record<string, Partial<ChartState>> = {
      '1': { chartStatus: 'rendered', chartUpdateStartTime: 100 },
    };

    mockFindNonTabChildChartIds.mockReturnValue(chartIds);

    const result = childChartsDidLoad({
      chartQueries,
      layout,
      id: 'test-id',
    });

    expect(result.didLoad).toBe(true); // every() returns true for empty array
    expect(result.minQueryStartTime).toBe(Infinity);
  });

  test('calculates minimum query start time correctly', () => {
    const chartIds = [1, 2, 3, 4];
    const layout: Layout = {};
    const chartQueries: Record<string, Partial<ChartState>> = {
      '1': { chartStatus: 'rendered', chartUpdateStartTime: 500 },
      '2': { chartStatus: 'stopped', chartUpdateStartTime: 100 },
      '3': { chartStatus: 'failed', chartUpdateStartTime: 300 },
      '4': { chartStatus: 'rendered', chartUpdateStartTime: 200 },
    };

    mockFindNonTabChildChartIds.mockReturnValue(chartIds);

    const result = childChartsDidLoad({
      chartQueries,
      layout,
      id: 'test-id',
    });

    expect(result.didLoad).toBe(true);
    expect(result.minQueryStartTime).toBe(100);
  });

  test('handles charts with missing chartUpdateStartTime', () => {
    const chartIds = [1, 2];
    const layout: Layout = {};
    const chartQueries: Record<string, Partial<ChartState>> = {
      '1': { chartStatus: 'rendered' }, // Missing chartUpdateStartTime
      '2': { chartStatus: 'stopped', chartUpdateStartTime: 200 },
    };

    mockFindNonTabChildChartIds.mockReturnValue(chartIds);

    const result = childChartsDidLoad({
      chartQueries,
      layout,
      id: 'test-id',
    });

    expect(result.didLoad).toBe(true);
    expect(result.minQueryStartTime).toBe(0);
  });

  test('handles charts with null chartStatus', () => {
    const chartIds = [1, 2];
    const layout: Layout = {};
    const chartQueries: Record<string, Partial<ChartState>> = {
      '1': { chartStatus: null, chartUpdateStartTime: 100 },
      '2': { chartStatus: 'stopped', chartUpdateStartTime: 200 },
    };

    mockFindNonTabChildChartIds.mockReturnValue(chartIds);

    const result = childChartsDidLoad({
      chartQueries,
      layout,
      id: 'test-id',
    });

    expect(result.didLoad).toBe(false); // null chartStatus is not in the completed states
    expect(result.minQueryStartTime).toBe(100);
  });

  test('recognizes all valid completed chart states', () => {
    const chartIds = [1, 2, 3];
    const layout: Layout = {};
    const chartQueries: Record<string, Partial<ChartState>> = {
      '1': { chartStatus: 'stopped', chartUpdateStartTime: 100 },
      '2': { chartStatus: 'failed', chartUpdateStartTime: 200 },
      '3': { chartStatus: 'rendered', chartUpdateStartTime: 150 },
    };

    mockFindNonTabChildChartIds.mockReturnValue(chartIds);

    const result = childChartsDidLoad({
      chartQueries,
      layout,
      id: 'test-id',
    });

    expect(result.didLoad).toBe(true);
    expect(result.minQueryStartTime).toBe(100);
  });

  test('does not recognize incomplete chart states', () => {
    const chartIds = [1, 2];
    const layout: Layout = {};
    const chartQueries: Record<string, Partial<ChartState>> = {
      '1': { chartStatus: 'loading', chartUpdateStartTime: 100 },
      '2': { chartStatus: 'success', chartUpdateStartTime: 200 },
    };

    mockFindNonTabChildChartIds.mockReturnValue(chartIds);

    const result = childChartsDidLoad({
      chartQueries,
      layout,
      id: 'test-id',
    });

    expect(result.didLoad).toBe(false); // 'loading' and 'success' are not in completed states
    expect(result.minQueryStartTime).toBe(100);
  });
});
