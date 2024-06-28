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
import { useSchemas } from './schemas';

const fakeApiResult = {
  result: ['test schema 1', 'test schema b'],
};
const fakeApiResult2 = {
  result: ['test schema 2', 'test schema a'],
};
const fakeApiResult3 = {
  result: ['test schema 3', 'test schema c'],
};

const expectedResult = fakeApiResult.result.map((value: string) => ({
  value,
  label: value,
  title: value,
}));
const expectedResult2 = fakeApiResult2.result.map((value: string) => ({
  value,
  label: value,
  title: value,
}));
const expectedResult3 = fakeApiResult3.result.map((value: string) => ({
  value,
  label: value,
  title: value,
}));

describe('useSchemas hook', () => {
  afterEach(() => {
    fetchMock.reset();
    act(() => {
      store.dispatch(api.util.resetApiState());
    });
  });

  test('returns api response mapping json result', async () => {
    const expectDbId = 'db1';
    const forceRefresh = false;
    const schemaApiRoute = `glob:*/api/v1/database/${expectDbId}/schemas/*`;
    fetchMock.get(schemaApiRoute, fakeApiResult);
    const onSuccess = jest.fn();
    const { result, waitFor } = renderHook(
      () =>
        useSchemas({
          dbId: expectDbId,
          onSuccess,
        }),
      {
        wrapper: createWrapper({
          useRedux: true,
          store,
        }),
      },
    );
    await waitFor(() => expect(fetchMock.calls(schemaApiRoute).length).toBe(1));
    expect(result.current.data).toEqual(expectedResult);
    expect(
      fetchMock.calls(
        `end:/api/v1/database/${expectDbId}/schemas/?q=${rison.encode({
          force: forceRefresh,
        })}`,
      ).length,
    ).toBe(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(fetchMock.calls(schemaApiRoute).length).toBe(2));
    expect(
      fetchMock.calls(
        `end:/api/v1/database/${expectDbId}/schemas/?q=${rison.encode({
          force: true,
        })}`,
      ).length,
    ).toBe(1);
    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(expectedResult);
  });

  test('returns cached data without api request', async () => {
    const expectDbId = 'db1';
    const schemaApiRoute = `glob:*/api/v1/database/${expectDbId}/schemas/*`;
    fetchMock.get(schemaApiRoute, fakeApiResult);
    const { result, rerender, waitFor } = renderHook(
      () =>
        useSchemas({
          dbId: expectDbId,
        }),
      {
        wrapper: createWrapper({
          useRedux: true,
          store,
        }),
      },
    );
    await waitFor(() => expect(result.current.data).toEqual(expectedResult));
    expect(fetchMock.calls(schemaApiRoute).length).toBe(1);
    rerender();
    await waitFor(() => expect(result.current.data).toEqual(expectedResult));
    expect(fetchMock.calls(schemaApiRoute).length).toBe(1);
  });

  test('returns refreshed data after expires', async () => {
    const expectDbId = 'db1';
    const schemaApiRoute = `glob:*/api/v1/database/*/schemas/*`;
    fetchMock.get(schemaApiRoute, url =>
      url.includes(expectDbId) ? fakeApiResult : fakeApiResult2,
    );
    const onSuccess = jest.fn();
    const { result, rerender, waitFor } = renderHook(
      ({ dbId }) =>
        useSchemas({
          dbId,
          onSuccess,
        }),
      {
        initialProps: { dbId: expectDbId },
        wrapper: createWrapper({
          useRedux: true,
          store,
        }),
      },
    );

    await waitFor(() =>
      expect(result.current.currentData).toEqual(expectedResult),
    );
    expect(fetchMock.calls(schemaApiRoute).length).toBe(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    rerender({ dbId: 'db2' });
    await waitFor(() =>
      expect(result.current.currentData).toEqual(expectedResult2),
    );
    expect(fetchMock.calls(schemaApiRoute).length).toBe(2);
    expect(onSuccess).toHaveBeenCalledTimes(2);

    rerender({ dbId: expectDbId });
    await waitFor(() =>
      expect(result.current.currentData).toEqual(expectedResult),
    );
    expect(fetchMock.calls(schemaApiRoute).length).toBe(2);
    expect(onSuccess).toHaveBeenCalledTimes(2);

    // clean up cache
    act(() => {
      store.dispatch(api.util.invalidateTags(['Schemas']));
    });

    await waitFor(() => expect(fetchMock.calls(schemaApiRoute).length).toBe(4));
    expect(fetchMock.calls(schemaApiRoute)[2][0]).toContain(expectDbId);
    await waitFor(() =>
      expect(result.current.currentData).toEqual(expectedResult),
    );
  });

  test('returns correct schema list by a catalog', async () => {
    const dbId = '1';
    const expectCatalog = 'catalog3';
    const schemaApiRoute = `glob:*/api/v1/database/*/schemas/*`;
    fetchMock.get(schemaApiRoute, url =>
      url.includes(`catalog:${expectCatalog}`)
        ? fakeApiResult3
        : fakeApiResult2,
    );
    const onSuccess = jest.fn();
    const { result, rerender, waitFor } = renderHook(
      ({ dbId, catalog }) =>
        useSchemas({
          dbId,
          catalog,
          onSuccess,
        }),
      {
        initialProps: { dbId, catalog: expectCatalog },
        wrapper: createWrapper({
          useRedux: true,
          store,
        }),
      },
    );

    await waitFor(() => expect(fetchMock.calls(schemaApiRoute).length).toBe(1));
    expect(result.current.data).toEqual(expectedResult3);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    rerender({ dbId, catalog: 'catalog2' });
    await waitFor(() => expect(fetchMock.calls(schemaApiRoute).length).toBe(2));
    expect(result.current.data).toEqual(expectedResult2);

    rerender({ dbId, catalog: expectCatalog });
    expect(result.current.data).toEqual(expectedResult3);
    expect(fetchMock.calls(schemaApiRoute).length).toBe(2);
  });
});
