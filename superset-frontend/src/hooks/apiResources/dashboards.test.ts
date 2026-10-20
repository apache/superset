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
import { renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import rison from 'rison';
import { useDashboard, useDashboardDatasets } from './dashboards';

test('useDashboard excludes thumbnail_url from request', async () => {
  fetchMock.get('glob:*/api/v1/dashboard/5?q=*', {
    result: {
      id: 5,
      dashboard_title: 'Test',
      json_metadata: '{}',
      position_json: '{}',
      editors: [],
    },
  });

  renderHook(() => useDashboard(5));

  await waitFor(() => {
    const calledUrl = fetchMock.callHistory.lastCall()?.url ?? '';
    expect(calledUrl).toContain('?q=');
  });

  const calledUrl = fetchMock.callHistory.lastCall()?.url ?? '';
  expect(calledUrl).toContain('?q=');
  expect(calledUrl).not.toContain('thumbnail_url');

  fetchMock.clearHistory().removeRoutes();
});

test('useDashboard returns the saved description of each dashboard', async () => {
  const dashboards: Record<string, Record<string, unknown>> = {
    '1': {
      id: 1,
      dashboard_title: 'Dashboard A',
      description: 'Description for A',
      json_metadata: '{}',
      position_json: '{}',
    },
    '2': {
      id: 2,
      dashboard_title: 'Dashboard B',
      description: null,
      json_metadata: '{}',
      position_json: '{}',
    },
  };
  // Emulates the API honoring the requested `columns`: only listed fields
  // are present in the response, as with the real endpoint.
  fetchMock.get('glob:*/api/v1/dashboard/*', ({ url }) => {
    const { pathname, searchParams } = new URL(url, 'http://localhost');
    const dashboard = dashboards[pathname.split('/').pop() as string];
    const { columns } = rison.decode<{ columns: string[] }>(
      searchParams.get('q') as string,
    );
    return {
      result: Object.fromEntries(
        Object.entries(dashboard).filter(([key]) => columns.includes(key)),
      ),
    };
  });

  const { result: resultA } = renderHook(() => useDashboard(1));
  await waitFor(() => expect(resultA.current.status).toBe('complete'));
  expect(resultA.current.result).toEqual(
    expect.objectContaining({ description: 'Description for A' }),
  );

  // A dashboard without a description must carry an explicit empty value so
  // it cannot inherit the previously viewed dashboard's description.
  const { result: resultB } = renderHook(() => useDashboard(2));
  await waitFor(() => expect(resultB.current.status).toBe('complete'));
  expect(resultB.current.result).toHaveProperty('description', null);

  fetchMock.clearHistory().removeRoutes();
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('useDashboardDatasets', () => {
  const mockDatasets = [
    {
      id: 1,
      metrics: [
        {
          metric_name: 'count',
          currency: { symbol: 'GBP', symbolPosition: 'prefix' },
        },
        {
          metric_name: 'revenue',
          currency: { symbol: 'USD', symbolPosition: 'suffix' },
        },
        { metric_name: 'no_currency' },
      ],
    },
    {
      id: 2,
      metrics: [{ metric_name: 'no_currency' }],
    },
    {
      id: 3,
      metrics: [
        {
          metric_name: 'other_currency',
          currency: { symbol: 'CNY', symbolPosition: 'suffix' },
        },
      ],
    },
  ];

  beforeEach(() => {
    fetchMock.clearHistory().removeRoutes();
  });

  test('adds currencyFormats to datasets', async () => {
    fetchMock.get('glob:*/api/v1/dashboard/*/datasets', {
      result: mockDatasets,
    });

    const { result } = renderHook(() => useDashboardDatasets(1));

    const expectedContent = [
      {
        ...mockDatasets[0],
        currencyFormats: {
          count: { symbol: 'GBP', symbolPosition: 'prefix' },
          revenue: { symbol: 'USD', symbolPosition: 'suffix' },
        },
      },
      {
        ...mockDatasets[1],
        currencyFormats: {},
      },
      {
        ...mockDatasets[2],
        currencyFormats: {
          other_currency: { symbol: 'CNY', symbolPosition: 'suffix' },
        },
      },
    ];
    await waitFor(() => {
      expect(result.current.result).toEqual(expectedContent);
    });
  });
});
