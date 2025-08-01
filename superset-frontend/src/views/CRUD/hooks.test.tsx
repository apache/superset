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
import { JsonResponse, SupersetClient } from '@superset-ui/core';

import { useListViewResource } from './hooks';

describe('useListViewResource', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fetch data with correct query parameters', async () => {
    const pageIndex = 0; // Declare and initialize the pageIndex variable
    const pageSize = 10; // Declare and initialize the pageSize variable
    const baseFilters = [{ id: 'status', operator: 'equals', value: 'active' }];

    const fetchSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
      json: {
        result: {
          dashboard_title: 'New Title',
          slug: '/new',
          json_metadata: '{"something":"foo"}',
          owners: [{ id: 1, first_name: 'Al', last_name: 'Pacino' }],
          roles: [],
        },
      },
    } as unknown as JsonResponse);

    const { result } = renderHook(() =>
      useListViewResource('example', 'Example', jest.fn()),
    );
    result.current.fetchData({
      pageIndex,
      pageSize,
      sortBy: [{ id: 'foo' }], // Change the type of sortBy from string to SortColumn[]
      filters: baseFilters,
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(2, {
      endpoint:
        '/api/v1/example/?q=(filters:!((col:status,opr:equals,value:active)),order_column:foo,order_direction:asc,page:0,page_size:10)',
    });
  });

  it('should pass the selectColumns to the fetch call', async () => {
    const pageIndex = 0; // Declare and initialize the pageIndex variable
    const pageSize = 10; // Declare and initialize the pageSize variable
    const baseFilters = [{ id: 'status', operator: 'equals', value: 'active' }];
    const selectColumns = ['id', 'name'];

    const fetchSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
      json: {
        result: {
          dashboard_title: 'New Title',
          slug: '/new',
          json_metadata: '{"something":"foo"}',
          owners: [{ id: 1, first_name: 'Al', last_name: 'Pacino' }],
          roles: [],
        },
      },
    } as unknown as JsonResponse);

    const { result } = renderHook(() =>
      useListViewResource(
        'example',
        'Example',
        jest.fn(),
        undefined,
        undefined,
        undefined,
        undefined,
        selectColumns,
      ),
    );

    result.current.fetchData({
      pageIndex,
      pageSize,
      sortBy: [{ id: 'foo' }], // Change the type of sortBy from string to SortColumn[]
      filters: baseFilters,
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(2, {
      endpoint:
        '/api/v1/example/?q=(filters:!((col:status,opr:equals,value:active)),order_column:foo,order_direction:asc,page:0,page_size:10,select_columns:!(id,name))',
    });
  });

  describe('ChartList-specific filter scenarios', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('converts Type filter to correct API call for charts', async () => {
      const fetchSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
        json: { result: [], count: 0 },
      } as unknown as JsonResponse);

      const { result } = renderHook(() =>
        useListViewResource('chart', 'Chart', jest.fn()),
      );

      const typeFilter = [{ id: 'viz_type', operator: 'eq', value: 'table' }];

      result.current.fetchData({
        pageIndex: 0,
        pageSize: 25,
        sortBy: [{ id: 'changed_on_delta_humanized', desc: true }],
        filters: typeFilter,
      });

      expect(fetchSpy).toHaveBeenNthCalledWith(2, {
        endpoint: expect.stringContaining('/api/v1/chart/?q='),
      });

      const call = fetchSpy.mock.calls[1];
      const { endpoint } = call[0];

      expect(endpoint).toMatch(/col:viz_type/);
      expect(endpoint).toMatch(/opr:eq/);
      expect(endpoint).toMatch(/value:table/);
      expect(endpoint).toMatch(/order_column:changed_on_delta_humanized/);
      expect(endpoint).toMatch(/order_direction:desc/);
    });

    it('converts chart search filter with ChartAllText operator', async () => {
      const fetchSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
        json: { result: [], count: 0 },
      } as unknown as JsonResponse);

      const { result } = renderHook(() =>
        useListViewResource('chart', 'Chart', jest.fn()),
      );

      const searchFilter = [
        {
          id: 'slice_name',
          operator: 'chart_all_text',
          value: 'test chart',
        },
      ];

      result.current.fetchData({
        pageIndex: 0,
        pageSize: 25,
        sortBy: [{ id: 'changed_on_delta_humanized', desc: true }],
        filters: searchFilter,
      });

      const call = fetchSpy.mock.calls[1];
      const { endpoint } = call[0];

      expect(endpoint).toContain('col%3Aslice_name');
      expect(endpoint).toContain('opr%3Achart_all_text');
      expect(endpoint).toContain("value%3A'test+chart'");
    });

    it('converts chart-specific favorite filter', async () => {
      const fetchSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
        json: { result: [], count: 0 },
      } as unknown as JsonResponse);

      const { result } = renderHook(() =>
        useListViewResource('chart', 'Chart', jest.fn()),
      );

      const favoriteFilter = [
        { id: 'id', operator: 'chart_is_favorite', value: true },
      ];

      result.current.fetchData({
        pageIndex: 0,
        pageSize: 25,
        sortBy: [{ id: 'changed_on_delta_humanized', desc: true }],
        filters: favoriteFilter,
      });

      const call = fetchSpy.mock.calls[1];
      const { endpoint } = call[0];

      expect(endpoint).toMatch(/col:id/);
      expect(endpoint).toMatch(/opr:chart_is_favorite/);
      expect(endpoint).toContain('value:!t');
    });

    it('handles multiple chart filters correctly', async () => {
      const fetchSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
        json: { result: [], count: 0 },
      } as unknown as JsonResponse);

      const { result } = renderHook(() =>
        useListViewResource('chart', 'Chart', jest.fn()),
      );

      const multipleFilters = [
        { id: 'viz_type', operator: 'eq', value: 'table' },
        { id: 'slice_name', operator: 'chart_all_text', value: 'test' },
      ];

      result.current.fetchData({
        pageIndex: 0,
        pageSize: 25,
        sortBy: [{ id: 'changed_on_delta_humanized', desc: true }],
        filters: multipleFilters,
      });

      const call = fetchSpy.mock.calls[1];
      const { endpoint } = call[0];

      // Should contain both filters
      expect(endpoint).toMatch(/col:viz_type/);
      expect(endpoint).toMatch(/value:table/);
      expect(endpoint).toMatch(/col:slice_name/);
      expect(endpoint).toMatch(/value:test/);
    });

    it('handles chart sorting scenarios', async () => {
      const fetchSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
        json: { result: [], count: 0 },
      } as unknown as JsonResponse);

      const { result } = renderHook(() =>
        useListViewResource('chart', 'Chart', jest.fn()),
      );

      // Test alphabetical sort (slice_name ASC)
      result.current.fetchData({
        pageIndex: 0,
        pageSize: 25,
        sortBy: [{ id: 'slice_name', desc: false }],
        filters: [],
      });

      const call = fetchSpy.mock.calls[1];
      const { endpoint } = call[0];

      expect(endpoint).toMatch(/order_column:slice_name/);
      expect(endpoint).toMatch(/order_direction:asc/);
    });
  });
});
