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
import { api } from 'src/hooks/apiResources/queryApi';
import { useTables } from './tables';

const fakeApiResult = {
  count: 2,
  result: [
    {
      id: 1,
      name: 'fake api result1',
      label: 'fake api label1',
    },
    {
      id: 2,
      name: 'fake api result2',
      label: 'fake api label2',
    },
  ],
};

const fakeHasMoreApiResult = {
  count: 4,
  result: [
    {
      id: 1,
      name: 'fake api result1',
      label: 'fake api label1',
    },
    {
      id: 2,
      name: 'fake api result2',
      label: 'fake api label2',
    },
  ],
};

const expectedData = {
  options: fakeApiResult.result,
  hasMore: false,
};

const expectedHasMoreData = {
  options: fakeHasMoreApiResult.result,
  hasMore: true,
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('useTables hook', () => {
  beforeEach(() => {
    fetchMock.removeRoutes().clearHistory();
    store.dispatch(api.util.resetApiState());
  });

  test('returns api response mapping json options', async () => {
    const expectDbId = 'db1';
    const expectedSchema = 'schema1';
    const tableApiRoute = `glob:*/api/v1/database/${expectDbId}/tables/?q=*`;
    fetchMock.get(tableApiRoute, fakeApiResult);
    const { result, waitFor } = renderHook(
      () =>
        useTables({
          dbId: expectDbId,
          schema: expectedSchema,
        }),
      {
        wrapper: createWrapper({
          useRedux: true,
          store,
        }),
      },
    );
    await waitFor(() => expect(result.current.data).toEqual(expectedData));
    expect(
      fetchMock.callHistory.calls(
        `end:api/v1/database/${expectDbId}/tables/?q=${rison.encode({
          force: false,
          schema_name: expectedSchema,
        })}`,
      ).length,
    ).toBe(1);
    act(() => {
      result.current.refetch();
    });
    await waitFor(() =>
      expect(
        fetchMock.callHistory.calls(
          `end:api/v1/database/${expectDbId}/tables/?q=${rison.encode({
            force: true,
            schema_name: expectedSchema,
          })}`,
        ).length,
      ).toBe(1),
    );
    expect(result.current.data).toEqual(expectedData);
  });

  test('skips the query when dbId is missing', async () => {
    const tableApiRoute = `glob:*/api/v1/database/*/tables/?q=*`;
    fetchMock.get(tableApiRoute, fakeApiResult);
    const { result } = renderHook(
      () =>
        useTables({
          dbId: undefined,
          schema: 'schema1',
        }),
      {
        wrapper: createWrapper({
          useRedux: true,
          store,
        }),
      },
    );
    // Give it a tick to settle
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(result.current.data).toEqual(undefined);
    expect(fetchMock.callHistory.calls(tableApiRoute).length).toBe(0);
  });

  test('skips the query when schema is missing', async () => {
    const expectDbId = 'db1';
    const tableApiRoute = `glob:*/api/v1/database/${expectDbId}/tables/?q=*`;
    fetchMock.get(tableApiRoute, fakeApiResult);
    const { result } = renderHook(
      () =>
        useTables({
          dbId: expectDbId,
          schema: undefined,
        }),
      {
        wrapper: createWrapper({
          useRedux: true,
          store,
        }),
      },
    );
    // Give it a tick to settle
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(result.current.data).toEqual(undefined);
    expect(fetchMock.callHistory.calls(tableApiRoute).length).toBe(0);
  });

  test('returns hasMore when total is larger than result size', async () => {
    const expectDbId = 'db1';
    const expectedSchema = 'schema2';
    const tableApiRoute = `glob:*/api/v1/database/${expectDbId}/tables/?q=*`;
    fetchMock.get(tableApiRoute, fakeHasMoreApiResult, { name: tableApiRoute });
    const { result, waitFor } = renderHook(
      () =>
        useTables({
          dbId: expectDbId,
          schema: expectedSchema,
        }),
      {
        wrapper: createWrapper({
          useRedux: true,
          store,
        }),
      },
    );
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(tableApiRoute).length).toBe(1),
    );
    expect(result.current.data).toEqual(expectedHasMoreData);
  });

  test('returns cached data without api request', async () => {
    const expectDbId = 'db1';
    const expectedSchema = 'schema1';
    const tableApiRoute = `glob:*/api/v1/database/${expectDbId}/tables/?q=*`;
    fetchMock.get(tableApiRoute, fakeApiResult);
    const { result, rerender, waitFor } = renderHook(
      () =>
        useTables({
          dbId: expectDbId,
          schema: expectedSchema,
        }),
      {
        wrapper: createWrapper({
          useRedux: true,
          store,
        }),
      },
    );
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(tableApiRoute).length).toBe(1),
    );
    rerender();
    await waitFor(() => expect(result.current.data).toEqual(expectedData));
    expect(fetchMock.callHistory.calls(tableApiRoute).length).toBe(1);
  });

  test('returns refreshed data after expires', async () => {
    const expectDbId = 'db1';
    const expectedSchema = 'schema1';
    const tableApiRoute = `glob:*/api/v1/database/${expectDbId}/tables/?q=*`;
    fetchMock.get(
      tableApiRoute,
      ({ url }) =>
        url.includes(expectedSchema) ? fakeApiResult : fakeHasMoreApiResult,
      { name: tableApiRoute },
    );
    const { result, rerender, waitFor } = renderHook(
      ({ schema }) =>
        useTables({
          dbId: expectDbId,
          schema,
        }),
      {
        initialProps: { schema: expectedSchema },
        wrapper: createWrapper({
          useRedux: true,
          store,
        }),
      },
    );

    await waitFor(() => expect(result.current.data).toEqual(expectedData));
    expect(fetchMock.callHistory.calls(tableApiRoute).length).toBe(1);

    rerender({ schema: 'schema2' });
    await waitFor(() =>
      expect(result.current.data).toEqual(expectedHasMoreData),
    );
    expect(fetchMock.callHistory.calls(tableApiRoute).length).toBe(2);

    rerender({ schema: expectedSchema });
    await waitFor(() => expect(result.current.data).toEqual(expectedData));
    expect(fetchMock.callHistory.calls(tableApiRoute).length).toBe(2);

    // clean up cache
    act(() => {
      store.dispatch(api.util.invalidateTags(['Tables']));
    });

    await waitFor(() =>
      expect(fetchMock.callHistory.calls(tableApiRoute).length).toBe(3),
    );
    await waitFor(() => expect(result.current.data).toEqual(expectedData));

    rerender({ schema: 'schema2' });
    await waitFor(() =>
      expect(result.current.data).toEqual(expectedHasMoreData),
    );
    expect(fetchMock.callHistory.calls(tableApiRoute).length).toBe(4);

    rerender({ schema: expectedSchema });
    await waitFor(() => expect(result.current.data).toEqual(expectedData));
    expect(fetchMock.callHistory.calls(tableApiRoute).length).toBe(4);
  });
});
