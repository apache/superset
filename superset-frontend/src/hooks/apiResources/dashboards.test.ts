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
import { renderHook } from '@testing-library/react-hooks';
import fetchMock from 'fetch-mock';
import { useDashboardDatasets } from './dashboards';

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
    fetchMock.reset();
  });

  it('adds currencyFormats to datasets', async () => {
    fetchMock.get('glob:*/api/v1/dashboard/*/datasets', {
      result: mockDatasets,
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useDashboardDatasets(1),
    );
    await waitForNextUpdate();

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
    expect(result.current.result).toEqual(expectedContent);
  });
});
