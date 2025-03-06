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
});
