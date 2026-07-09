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
import { act, renderHook, waitFor } from '@testing-library/react';
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

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('useSchemas hook', () => {
  beforeEach(() => {
    fetchMock.clearHistory().removeRoutes();
    store.dispatch(api.util.resetApiState());
  });

  test('returns api response mapping json result', async () => {
    const expectDbId = 'db1';
    const forceRefresh = false;
    const schemaApiRoute = `glob:*/api/v1/database/${expectDbId}/schemas/*`;
    fetchMock.get(schemaApiRoute, fakeApiResult);
    const onSuccess = jest.fn();
    const { result } = renderHook(
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
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(schemaApiRoute).length).toBe(1),
    );
    expect(result.current.data).toEqual(expectedResult);
    expect(
      fetchMock.callHistory.calls(
        `end:/api/v1/database/${expectDbId}/schemas/?q=${rison.encode({
          force: forceRefresh,
        })}`,
      ).length,
    ).toBe(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.refetch();
    });
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(schemaApiRoute).length).toBe(2),
    );
    expect(
      fetchMock.callHistory.calls(
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
    const { result, rerender } = renderHook(
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
    expect(fetchMock.callHistory.calls(schemaApiRoute).length).toBe(1);
    rerender();
    await waitFor(() => expect(result.current.data).toEqual(expectedResult));
    expect(fetchMock.callHistory.calls(schemaApiRoute).length).toBe(1);
  });

  test('returns refreshed data after expires', async () => {
    const expectDbId = 'db1';
    const schemaApiRoute = `glob:*/api/v1/database/*/schemas/*`;
    fetchMock.get(schemaApiRoute, ({ url }) =>
      url.includes(expectDbId) ? fakeApiResult : fakeApiResult2,
    );
    const onSuccess = jest.fn();
    const { result, rerender } = renderHook(
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
    expect(fetchMock.callHistory.calls(schemaApiRoute).length).toBe(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    rerender({ dbId: 'db2' });
    await waitFor(() =>
      expect(result.current.currentData).toEqual(expectedResult2),
    );
    expect(fetchMock.callHistory.calls(schemaApiRoute).length).toBe(2);
    expect(onSuccess).toHaveBeenCalledTimes(2);

    rerender({ dbId: expectDbId });
    await waitFor(() =>
      expect(result.current.currentData).toEqual(expectedResult),
    );
    expect(fetchMock.callHistory.calls(schemaApiRoute).length).toBe(2);
    expect(onSuccess).toHaveBeenCalledTimes(2);

    // clean up cache
    act(() => {
      store.dispatch(api.util.invalidateTags(['Schemas']));
    });

    // Only the currently subscribed query (expectDbId) is refetched on
    // invalidation; the previously visited db2 entry is no longer subscribed.
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(schemaApiRoute).length).toBe(3),
    );
    expect(fetchMock.callHistory.calls(schemaApiRoute)[2].url).toContain(
      expectDbId,
    );
    await waitFor(() =>
      expect(result.current.currentData).toEqual(expectedResult),
    );
  });

  test('fires onSuccess when the subscribed query refetches after invalidateTags', async () => {
    // Regression test for the OAuth2 retry-after-redirect path (PR #41101).
    // The redirect handler dispatches invalidateTags, which refetches the
    // SUBSCRIBED query (not the lazy trigger). onSuccess must still fire so
    // consumers holding local state (e.g. an auth error banner) get cleared.
    const expectDbId = 'db1';
    const schemaApiRoute = `glob:*/api/v1/database/${expectDbId}/schemas/*`;
    fetchMock.get(schemaApiRoute, fakeApiResult);
    const onSuccess = jest.fn();
    const { result } = renderHook(
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

    await waitFor(() =>
      expect(fetchMock.callHistory.calls(schemaApiRoute).length).toBe(1),
    );
    expect(result.current.currentData).toEqual(expectedResult);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    act(() => {
      store.dispatch(
        api.util.invalidateTags([{ type: 'Schemas', id: 'LIST' }]),
      );
    });

    await waitFor(() =>
      expect(fetchMock.callHistory.calls(schemaApiRoute).length).toBe(2),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(2));
    // isRefetched must be false so the selectors don't emit a "List refreshed"
    // toast for an automatic refetch the user did not request.
    expect(onSuccess).toHaveBeenLastCalledWith(expectedResult, false);
  });

  test('recovers from an error when the subscribed query refetches (OAuth2 retry)', async () => {
    const expectDbId = 'db1';
    const schemaApiRoute = `glob:*/api/v1/database/${expectDbId}/schemas/*`;
    let shouldFail = true;
    fetchMock.get(schemaApiRoute, () =>
      shouldFail ? { status: 500, body: {} } : fakeApiResult,
    );
    const onSuccess = jest.fn();
    const onError = jest.fn();
    renderHook(
      () =>
        useSchemas({
          dbId: expectDbId,
          onSuccess,
          onError,
        }),
      {
        wrapper: createWrapper({
          useRedux: true,
          store,
        }),
      },
    );

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();

    // The OAuth2 redirect completes and the token is stored: the next fetch
    // succeeds, and onSuccess must fire to clear the error banner.
    shouldFail = false;
    act(() => {
      store.dispatch(
        api.util.invalidateTags([{ type: 'Schemas', id: 'LIST' }]),
      );
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSuccess).toHaveBeenLastCalledWith(expectedResult, false);
  });

  test('returns correct schema list by a catalog', async () => {
    const dbId = '1';
    const expectCatalog = 'catalog3';
    const schemaApiRoute = `glob:*/api/v1/database/*/schemas/*`;
    fetchMock.get(schemaApiRoute, ({ url }) =>
      url.includes(`catalog:${expectCatalog}`)
        ? fakeApiResult3
        : fakeApiResult2,
    );
    const onSuccess = jest.fn();
    const { result, rerender } = renderHook(
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

    await waitFor(() =>
      expect(fetchMock.callHistory.calls(schemaApiRoute).length).toBe(1),
    );
    expect(result.current.data).toEqual(expectedResult3);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    rerender({ dbId, catalog: 'catalog2' });
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(schemaApiRoute).length).toBe(2),
    );
    expect(result.current.data).toEqual(expectedResult2);

    rerender({ dbId, catalog: expectCatalog });
    expect(result.current.data).toEqual(expectedResult3);
    expect(fetchMock.callHistory.calls(schemaApiRoute).length).toBe(2);
  });
});
