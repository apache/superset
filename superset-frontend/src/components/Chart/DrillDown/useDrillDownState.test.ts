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
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryFormData } from '@superset-ui/core';
import { useDrillDownState, clearDrillDownState } from './useDrillDownState';

jest.mock('src/components/Chart/chartAction', () => ({
  getChartDataRequest: jest.fn(() =>
    Promise.resolve({ response: {}, json: { result: [{ data: [] }] } }),
  ),
  handleChartDataResponse: jest.fn(() =>
    Promise.resolve([{ data: [{ col1: 'val1' }] }]),
  ),
}));

jest.mock('src/explore/exploreUtils', () => ({
  getQuerySettings: jest.fn(() => [false]),
}));

jest.mock('src/utils/simpleFilterToAdhoc', () => ({
  simpleFilterToAdhoc: jest.fn(filter => ({
    expressionType: 'SIMPLE',
    clause: 'WHERE',
    operator: filter.op,
    subject: filter.col,
    comparator: filter.val,
  })),
}));

const baseFormData: QueryFormData = {
  datasource: '1__table',
  viz_type: 'echarts_timeseries_bar',
  slice_id: 42,
  x_axis: 'country',
  groupby: [],
  adhoc_filters: [],
};

beforeEach(() => {
  // Drill state persists in a module-level store keyed by chart id; clear it
  // so each test starts from a clean slate (tests reuse slice_id 42).
  clearDrillDownState();
});

afterEach(() => {
  jest.useRealTimers();
});

test('hierarchy is empty when x_axis is a single string with no drilldown_hierarchy', () => {
  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData: baseFormData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  expect(result.current.hierarchy).toEqual([]);
  expect(result.current.hasHierarchy).toBe(false);
});

test('hierarchy is built from drilldown_hierarchy field', () => {
  const formData = {
    ...baseFormData,
    x_axis: 'country',
    drilldown_hierarchy: ['country', 'region', 'city'],
  };

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  expect(result.current.hierarchy).toEqual(['country', 'region', 'city']);
  expect(result.current.hasHierarchy).toBe(true);
});

test('drillDown() pushes a level onto the stack', async () => {
  const formData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region', 'city'],
  };

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });

  expect(result.current.drillStack).toHaveLength(1);
  expect(result.current.drillStack[0]).toEqual({
    filters: [{ col: 'country', op: '==', val: 'USA' }],
    label: 'USA',
  });
  expect(result.current.isDrilling).toBe(true);
});

test('drillDown() at last level sets selectedLeaf instead of pushing', () => {
  const formData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region'],
  };

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  // Drill to depth 1 (only one more level available: 'region')
  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });

  expect(result.current.drillStack).toHaveLength(1);

  // Now we're at the last level; next drill should set selectedLeaf
  act(() => {
    result.current.drillDown(
      [{ col: 'region', op: '==', val: 'Texas' }],
      'Texas',
    );
  });

  expect(result.current.drillStack).toHaveLength(1);
  expect(result.current.selectedLeaf).toBe('Texas');
});

test('resetTo(0) clears the stack', () => {
  const formData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region', 'city'],
  };

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });

  expect(result.current.drillStack).toHaveLength(1);

  act(() => {
    result.current.resetTo(0);
  });

  expect(result.current.drillStack).toHaveLength(0);
  expect(result.current.isDrilling).toBe(false);
  expect(result.current.selectedLeaf).toBeUndefined();
});

test('effectiveFormData swaps x_axis when drilling', () => {
  const formData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region', 'city'],
    groupby: [],
  };

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });

  // After drilling one level, the effective x_axis should be 'region'
  const effective = result.current.effectiveFormData as Record<string, unknown>;
  expect(effective.x_axis).toBe('region');
});

test('effectiveFormData adds adhoc_filters from drill stack', () => {
  const formData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region', 'city'],
    groupby: [],
    adhoc_filters: [
      {
        expressionType: 'SIMPLE' as const,
        clause: 'WHERE' as const,
        subject: 'year',
        operator: '==' as const,
        comparator: '2023',
      },
    ],
  };

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });

  const effective = result.current.effectiveFormData as Record<string, unknown>;
  const adhocFilters = effective.adhoc_filters as unknown[];

  // Should contain the original filter plus the drill filter
  expect(adhocFilters).toHaveLength(2);
  // The first should be the original filter
  expect(adhocFilters[0]).toEqual(expect.objectContaining({ subject: 'year' }));
  // The second should be generated from the drill filter via simpleFilterToAdhoc
  expect(adhocFilters[1]).toEqual(
    expect.objectContaining({
      subject: 'country',
      operator: '==',
      comparator: 'USA',
    }),
  );
});

test('effectiveFormData swaps groupby when chart uses groupby', () => {
  const formData = {
    ...baseFormData,
    x_axis: undefined,
    groupby: ['country'],
    drilldown_hierarchy: ['country', 'region', 'city'],
    adhoc_filters: [],
  };

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });

  const effective = result.current.effectiveFormData as Record<string, unknown>;
  expect(effective.groupby).toEqual(['region']);
});

test('fetches data when drilling and returns it as effectiveQueriesResponse', async () => {
  const formData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region', 'city'],
    groupby: [],
    adhoc_filters: [],
  };

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [{ country: 'USA' }] }],
    }),
  );

  // Before drilling, effectiveQueriesResponse is the base data
  expect(result.current.effectiveQueriesResponse).toEqual([
    { data: [{ country: 'USA' }] },
  ]);

  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.effectiveQueriesResponse).toEqual([
    { data: [{ col1: 'val1' }] },
  ]);
});

test('drill state survives a remount (persisted per chart id)', async () => {
  const formData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region', 'city'],
  };

  const first = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  act(() => {
    first.result.current.drillDown(
      [{ col: 'country', op: '==', val: 'USA' }],
      'USA',
    );
  });

  await waitFor(() => {
    expect(first.result.current.isLoading).toBe(false);
  });
  expect(first.result.current.drillStack).toHaveLength(1);

  // Simulate the dashboard grid remounting the chart (e.g. an unrelated
  // filter change). The drill navigation must be restored, not lost.
  first.unmount();

  const second = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  expect(second.result.current.drillStack).toHaveLength(1);
  expect(second.result.current.drillStack[0].label).toEqual('USA');
  expect(second.result.current.isDrilling).toBe(true);
});

test('reconfiguring the chart (viz type change) clears persisted drill state', async () => {
  const formData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region', 'city'],
  };

  const { result, rerender } = renderHook(
    ({ fd }) =>
      useDrillDownState({
        chartId: 42,
        formData: fd,
        baseQueriesResponse: [{ data: [] }],
      }),
    { initialProps: { fd: formData } },
  );

  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });
  expect(result.current.drillStack).toHaveLength(1);

  // A genuine reconfiguration (different viz type) resets the drill.
  rerender({ fd: { ...formData, viz_type: 'echarts_timeseries_line' } });

  expect(result.current.drillStack).toHaveLength(0);
  expect(result.current.isDrilling).toBe(false);
});

test('effectiveFormData narrows to the selected leaf at the deepest level', () => {
  const formData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region'],
    groupby: [],
  };

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  // Drill into 'country' — now showing the 'region' level.
  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });

  // Pick a value at the deepest level ('region').
  act(() => {
    result.current.drillDown(
      [{ col: 'region', op: '==', val: 'Texas' }],
      'Texas',
    );
  });

  expect(result.current.selectedLeaf).toBe('Texas');

  const effective = result.current.effectiveFormData as Record<string, unknown>;
  // The x_axis stays on the deepest column.
  expect(effective.x_axis).toBe('region');

  const adhocFilters = effective.adhoc_filters as Record<string, unknown>[];
  // Both the accumulated ancestor filter and the picked leaf filter apply,
  // so the chart narrows to the single selected leaf.
  expect(adhocFilters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ subject: 'country', comparator: 'USA' }),
      expect.objectContaining({ subject: 'region', comparator: 'Texas' }),
    ]),
  );
});

test('resetTo clears the selected leaf filter', () => {
  const formData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region'],
    groupby: [],
  };

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });
  act(() => {
    result.current.drillDown(
      [{ col: 'region', op: '==', val: 'Texas' }],
      'Texas',
    );
  });

  expect(result.current.selectedLeaf).toBe('Texas');

  // Navigating back to the top level clears the leaf selection and its filter.
  act(() => {
    result.current.resetTo(1);
  });

  expect(result.current.selectedLeaf).toBeUndefined();
  const effective = result.current.effectiveFormData as Record<string, unknown>;
  const adhocFilters = effective.adhoc_filters as Record<string, unknown>[];
  expect(adhocFilters).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ subject: 'region', comparator: 'Texas' }),
    ]),
  );
});

test('hierarchy prepends the first groupby column for groupby-based charts', () => {
  const formData = {
    ...baseFormData,
    x_axis: undefined,
    groupby: ['parent'],
    drilldown_hierarchy: ['id', 'city'],
  } as unknown as QueryFormData;

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  // The chart's first groupby column is the top level, prepended when the
  // author lists only the deeper levels.
  expect(result.current.hierarchy).toEqual(['parent', 'id', 'city']);
});

test('effectiveFormData advances x_axis (not groupby) when the chart has both', () => {
  const formData = {
    ...baseFormData,
    x_axis: 'country',
    groupby: ['gender'],
    drilldown_hierarchy: ['country', 'region'],
  } as unknown as QueryFormData;

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });

  const effective = result.current.effectiveFormData as Record<string, unknown>;
  // The hierarchy is x-axis driven: advance x_axis and keep the groupby as a
  // series breakdown (do NOT drill on the series dimension).
  expect(effective.x_axis).toBe('region');
  expect(effective.groupby).toEqual(['gender']);
});

test('a single-level hierarchy is not drillable', () => {
  const formData = {
    ...baseFormData,
    x_axis: 'country',
    drilldown_hierarchy: ['country'],
  } as unknown as QueryFormData;

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  // Only the chart's own dimension — nothing to drill into.
  expect(result.current.hasHierarchy).toBe(false);
});

test('retry logic: succeeds on second attempt after a transient failure', async () => {
  const { getChartDataRequest } = jest.requireMock(
    'src/components/Chart/chartAction',
  );
  getChartDataRequest
    .mockRejectedValueOnce(new Error('transient'))
    .mockResolvedValueOnce({ response: {}, json: { result: [{ data: [] }] } });

  const formData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region'],
  } as unknown as QueryFormData;

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.error).toBeUndefined();
  expect(result.current.effectiveQueriesResponse).not.toBeNull();
});

test('retry logic: surfaces error after all attempts are exhausted', async () => {
  jest.useFakeTimers();
  const { getChartDataRequest } = jest.requireMock(
    'src/components/Chart/chartAction',
  );
  getChartDataRequest.mockRejectedValue(new Error('persistent failure'));

  const formData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region'],
  } as unknown as QueryFormData;

  const { result } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });

  // Advance through the retry delays (400ms * attempt for each of 2 retries)
  for (let i = 0; i < 3; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
  }

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.error).toBeDefined();
  expect(result.current.effectiveQueriesResponse).toBeNull();

  // Restore
  jest.useRealTimers();
  getChartDataRequest.mockResolvedValue({
    response: {},
    json: { result: [{ data: [] }] },
  });
});

test('isLoading resets to false on unmount during in-flight query', () => {
  const formData = {
    ...baseFormData,
    drilldown_hierarchy: ['country', 'region'],
  } as unknown as QueryFormData;

  const { result, unmount } = renderHook(() =>
    useDrillDownState({
      chartId: 42,
      formData,
      baseQueriesResponse: [{ data: [] }],
    }),
  );

  act(() => {
    result.current.drillDown([{ col: 'country', op: '==', val: 'USA' }], 'USA');
  });

  // isLoading should be true while the query is in-flight
  expect(result.current.isLoading).toBe(true);

  // Unmount while still loading — should not leave isLoading stuck
  unmount();
  // No assertion on result.current after unmount (React cleans up); the key
  // guarantee is that setIsLoading(false) in the cleanup doesn't throw.
});
