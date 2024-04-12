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
import rison from 'rison';
import fetchMock from 'fetch-mock';
import { act, renderHook } from '@testing-library/react-hooks';
import {
  createWrapper,
  defaultStore as store,
} from 'spec/helpers/testing-library';
import { QueryState } from '@superset-ui/core';
import { api } from 'src/hooks/apiResources/queryApi';
import { mapQueryResponse, useEditorQueriesQuery } from './queries';

const fakeApiResult = {
  count: 4,
  ids: [692],
  result: [
    {
      changed_on: '2024-03-12T20:01:02.497775',
      client_id: 'b0ZDzRYzn',
      database: {
        database_name: 'examples',
        id: 1,
      },
      end_time: '1710273662496.047852',
      error_message: null,
      executed_sql: 'SELECT * from "FCC 2018 Survey"\nLIMIT 1001',
      id: 692,
      limit: 1000,
      limiting_factor: 'DROPDOWN',
      progress: 100,
      results_key: null,
      rows: 1000,
      schema: 'main',
      select_as_cta: false,
      sql: 'SELECT * from "FCC 2018 Survey" ',
      sql_editor_id: '22',
      start_time: '1710273662445.992920',
      status: QueryState.Success,
      tab_name: 'Untitled Query 16',
      tmp_table_name: null,
      tracking_url: null,
      user: {
        first_name: 'admin',
        id: 1,
        last_name: 'user',
      },
    },
  ],
};

afterEach(() => {
  fetchMock.reset();
  act(() => {
    store.dispatch(api.util.resetApiState());
  });
});

test('returns api response mapping camelCase keys', async () => {
  const editorId = '23';
  const editorQueryApiRoute = `glob:*/api/v1/query/?q=*`;
  fetchMock.get(editorQueryApiRoute, fakeApiResult);
  const { result, waitFor } = renderHook(
    () => useEditorQueriesQuery({ editorId }),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );
  await waitFor(() =>
    expect(fetchMock.calls(editorQueryApiRoute).length).toBe(1),
  );
  const expectedResult = {
    ...fakeApiResult,
    result: fakeApiResult.result.map(mapQueryResponse),
  };
  expect(
    rison.decode(fetchMock.calls(editorQueryApiRoute)[0][0].split('?q=')[1]),
  ).toEqual(
    expect.objectContaining({
      order_column: 'start_time',
      order_direction: 'desc',
      page: 0,
      page_size: 25,
      filters: [
        {
          col: 'sql_editor_id',
          opr: 'eq',
          value: expect.stringContaining(editorId),
        },
      ],
    }),
  );
  expect(result.current.data).toEqual(expectedResult);
});

test('merges paginated results', async () => {
  const editorId = '23';
  const editorQueryApiRoute = `glob:*/api/v1/query/?q=*`;
  fetchMock.get(editorQueryApiRoute, fakeApiResult);
  const { waitFor } = renderHook(() => useEditorQueriesQuery({ editorId }), {
    wrapper: createWrapper({
      useRedux: true,
      store,
    }),
  });
  await waitFor(() =>
    expect(fetchMock.calls(editorQueryApiRoute).length).toBe(1),
  );
  const { result: paginatedResult } = renderHook(
    () => useEditorQueriesQuery({ editorId, pageIndex: 1 }),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );
  await waitFor(() =>
    expect(fetchMock.calls(editorQueryApiRoute).length).toBe(2),
  );
  expect(
    rison.decode(fetchMock.calls(editorQueryApiRoute)[1][0].split('?q=')[1]),
  ).toEqual(
    expect.objectContaining({
      page: 1,
    }),
  );
  expect(paginatedResult.current.data).toEqual({
    ...fakeApiResult,
    result: [
      ...fakeApiResult.result.map(mapQueryResponse),
      ...fakeApiResult.result.map(mapQueryResponse),
    ],
  });
});
