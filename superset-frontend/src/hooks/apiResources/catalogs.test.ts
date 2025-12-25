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
import { useCatalogs } from './catalogs';

const fakeApiResult = {
  result: ['catalog_a', 'catalog_b'],
  default: 'catalog_a',
};
const fakeApiResult2 = {
  result: ['catalog_c', 'catalog_d'],
  default: null,
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

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('useCatalogs hook', () => {
  beforeEach(() => {
    fetchMock.reset();
    store.dispatch(api.util.resetApiState());
  });

  test('returns api response mapping json result with default catalog', async () => {
    const expectDbId = 'db1';
    const forceRefresh = false;
    const catalogApiRoute = `glob:*/api/v1/database/${expectDbId}/catalogs/*`;
    fetchMock.get(catalogApiRoute, fakeApiResult);
    const onSuccess = jest.fn();
    const { result, waitFor } = renderHook(
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
      expect(fetchMock.calls(catalogApiRoute).length).toBe(1),
    );
    expect(result.current.data).toEqual(expectedResult);
    expect(result.current.defaultCatalog).toBe('catalog_a');
    expect(
      fetchMock.calls(
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
      expect(fetchMock.calls(catalogApiRoute).length).toBe(2),
    );
    expect(
      fetchMock.calls(
        `end:/api/v1/database/${expectDbId}/catalogs/?q=${rison.encode({
          force: true,
        })}`,
      ).length,
    ).toBe(1);
    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(expectedResult);
    expect(result.current.defaultCatalog).toBe('catalog_a');
  });

  test('returns cached data without api request', async () => {
    const expectDbId = 'db1';
    const catalogApiRoute = `glob:*/api/v1/database/${expectDbId}/catalogs/*`;
    fetchMock.get(catalogApiRoute, fakeApiResult);
    const { result, rerender, waitFor } = renderHook(
      () =>
        useCatalogs({
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
    expect(result.current.defaultCatalog).toBe('catalog_a');
    expect(fetchMock.calls(catalogApiRoute).length).toBe(1);
    rerender();
    await waitFor(() => expect(result.current.data).toEqual(expectedResult));
    expect(result.current.defaultCatalog).toBe('catalog_a');
    expect(fetchMock.calls(catalogApiRoute).length).toBe(1);
  });

  test('returns refreshed data after switching databases', async () => {
    const expectDbId = 'db1';
    const catalogApiRoute = `glob:*/api/v1/database/*/catalogs/*`;
    fetchMock.get(catalogApiRoute, url =>
      url.includes(expectDbId) ? fakeApiResult : fakeApiResult2,
    );
    const onSuccess = jest.fn();
    const { result, rerender, waitFor } = renderHook(
      ({ dbId }) =>
        useCatalogs({
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

    await waitFor(() => expect(result.current.data).toEqual(expectedResult));
    expect(result.current.defaultCatalog).toBe('catalog_a');
    expect(fetchMock.calls(catalogApiRoute).length).toBe(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    rerender({ dbId: 'db2' });
    await waitFor(() => expect(result.current.data).toEqual(expectedResult2));
    expect(result.current.defaultCatalog).toBeNull();
    expect(fetchMock.calls(catalogApiRoute).length).toBe(2);
    expect(onSuccess).toHaveBeenCalledTimes(2);

    rerender({ dbId: expectDbId });
    await waitFor(() => expect(result.current.data).toEqual(expectedResult));
    expect(result.current.defaultCatalog).toBe('catalog_a');
    expect(fetchMock.calls(catalogApiRoute).length).toBe(2);
    expect(onSuccess).toHaveBeenCalledTimes(2);

    // clean up cache
    act(() => {
      store.dispatch(api.util.invalidateTags(['Catalogs']));
    });

    await waitFor(() =>
      expect(fetchMock.calls(catalogApiRoute).length).toBe(4),
    );
    expect(fetchMock.calls(catalogApiRoute)[2][0]).toContain(expectDbId);
    await waitFor(() => expect(result.current.data).toEqual(expectedResult));
    expect(result.current.defaultCatalog).toBe('catalog_a');
  });

  test('returns null defaultCatalog when API response has no default', async () => {
    const expectDbId = 'db-no-default';
    const catalogApiRoute = `glob:*/api/v1/database/${expectDbId}/catalogs/*`;
    fetchMock.get(catalogApiRoute, { result: ['catalog1', 'catalog2'] });
    const { result, waitFor } = renderHook(
      () =>
        useCatalogs({
          dbId: expectDbId,
        }),
      {
        wrapper: createWrapper({
          useRedux: true,
          store,
        }),
      },
    );
    await waitFor(() =>
      expect(fetchMock.calls(catalogApiRoute).length).toBe(1),
    );
    expect(result.current.defaultCatalog).toBeNull();
  });
});
