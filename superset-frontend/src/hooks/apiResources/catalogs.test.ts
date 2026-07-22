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
import { useCatalogs } from './catalogs';

const fakeApiResult = {
  result: ['test catalog 1', 'test catalog b'],
};

const expectedResult = fakeApiResult.result.map((value: string) => ({
  value,
  label: value,
  title: value,
}));

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('useCatalogs hook', () => {
  beforeEach(() => {
    fetchMock.clearHistory().removeRoutes();
    store.dispatch(api.util.resetApiState());
  });

  test('returns api response mapping json result', async () => {
    const expectDbId = 'db1';
    const forceRefresh = false;
    const catalogApiRoute = `glob:*/api/v1/database/${expectDbId}/catalogs/*`;
    fetchMock.get(catalogApiRoute, fakeApiResult);
    const onSuccess = jest.fn();
    const { result } = renderHook(
      () =>
        useCatalogs({
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
      expect(fetchMock.callHistory.calls(catalogApiRoute).length).toBe(1),
    );
    expect(result.current.data).toEqual(expectedResult);
    expect(
      fetchMock.callHistory.calls(
        `end:/api/v1/database/${expectDbId}/catalogs/?q=${rison.encode({
          force: forceRefresh,
        })}`,
      ).length,
    ).toBe(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.refetch();
    });
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(catalogApiRoute).length).toBe(2),
    );
    expect(
      fetchMock.callHistory.calls(
        `end:/api/v1/database/${expectDbId}/catalogs/?q=${rison.encode({
          force: true,
        })}`,
      ).length,
    ).toBe(1);
    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(expectedResult);
  });

  test('fires onSuccess when the subscribed query refetches after invalidateTags', async () => {
    // Regression test for the OAuth2 retry-after-redirect path (PR #41101).
    // The redirect handler dispatches invalidateTags, which refetches the
    // SUBSCRIBED query (not the lazy trigger). onSuccess must still fire so
    // consumers holding local state (e.g. an auth error banner) get cleared.
    const expectDbId = 'db1';
    const catalogApiRoute = `glob:*/api/v1/database/${expectDbId}/catalogs/*`;
    fetchMock.get(catalogApiRoute, fakeApiResult);
    const onSuccess = jest.fn();
    const { result } = renderHook(
      () =>
        useCatalogs({
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
      expect(fetchMock.callHistory.calls(catalogApiRoute).length).toBe(1),
    );
    expect(result.current.currentData).toEqual(expectedResult);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    act(() => {
      store.dispatch(
        api.util.invalidateTags([{ type: 'Catalogs', id: 'LIST' }]),
      );
    });

    await waitFor(() =>
      expect(fetchMock.callHistory.calls(catalogApiRoute).length).toBe(2),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(2));
    // isRefetched must be false so the selectors don't emit a "List refreshed"
    // toast for an automatic refetch the user did not request.
    expect(onSuccess).toHaveBeenLastCalledWith(expectedResult, false);
  });

  test('recovers from an error when the subscribed query refetches (OAuth2 retry)', async () => {
    const expectDbId = 'db1';
    const catalogApiRoute = `glob:*/api/v1/database/${expectDbId}/catalogs/*`;
    let shouldFail = true;
    fetchMock.get(catalogApiRoute, () =>
      shouldFail ? { status: 500, body: {} } : fakeApiResult,
    );
    const onSuccess = jest.fn();
    const onError = jest.fn();
    renderHook(
      () =>
        useCatalogs({
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
        api.util.invalidateTags([{ type: 'Catalogs', id: 'LIST' }]),
      );
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSuccess).toHaveBeenLastCalledWith(expectedResult, false);
  });

  test('fires callbacks on invalidation refetch even after a failed force refresh (OAuth2 refresh button)', async () => {
    // Reviewer regression: serializeQueryArgs strips forceRefresh, so the
    // subscribed query and the lazy force-refresh trigger share one cache entry.
    // A failed refresh-button click (forceRefresh:true) leaves the entry's
    // originalArgs.forceRefresh sticky-true. The old `!originalArgs.forceRefresh`
    // guard then suppressed onSuccess/onError on the later invalidation refetch,
    // so the banner stayed stuck. The ref-based flag must fire the callbacks.
    const expectDbId = 'db1';
    const catalogApiRoute = `glob:*/api/v1/database/${expectDbId}/catalogs/*`;
    let mode: 'ok' | 'fail' = 'ok';
    fetchMock.get(catalogApiRoute, () =>
      mode === 'fail' ? { status: 500, body: {} } : fakeApiResult,
    );
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(
      () =>
        useCatalogs({
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

    // Initial subscribed load succeeds (not a manual refresh: isRefetched=false).
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSuccess).toHaveBeenLastCalledWith(expectedResult, false);

    // User clicks the refresh button (force refresh) and hits the OAuth2 wall.
    // This makes the shared entry's originalArgs.forceRefresh sticky-true.
    mode = 'fail';
    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    // User authorizes: invalidateTags refetches the subscribed query, which now
    // succeeds. onSuccess must fire (isRefetched=false: not a manual refresh).
    mode = 'ok';
    act(() => {
      store.dispatch(
        api.util.invalidateTags([{ type: 'Catalogs', id: 'LIST' }]),
      );
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(2));
    expect(onSuccess).toHaveBeenLastCalledWith(expectedResult, false);
  });
});
