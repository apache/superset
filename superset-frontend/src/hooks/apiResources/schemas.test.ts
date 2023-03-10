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
import QueryProvider, { queryClient } from 'src/views/QueryProvider';
import { useSchemas } from './schemas';

const fakeApiResult = {
  result: ['test schema 1', 'test schema b'],
};

const expectedResult = fakeApiResult.result.map((value: string) => ({
  value,
  label: value,
  title: value,
}));

describe('useSchemas hook', () => {
  beforeEach(() => {
    queryClient.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    fetchMock.reset();
    jest.useRealTimers();
  });

  test('returns api response mapping json result', async () => {
    const expectDbId = 'db1';
    const forceRefresh = false;
    const schemaApiRoute = `glob:*/api/v1/database/${expectDbId}/schemas/*`;
    fetchMock.get(schemaApiRoute, fakeApiResult);
    const { result } = renderHook(
      () =>
        useSchemas({
          dbId: expectDbId,
        }),
      {
        wrapper: QueryProvider,
      },
    );
    await act(async () => {
      jest.runAllTimers();
    });
    expect(fetchMock.calls(schemaApiRoute).length).toBe(1);
    expect(
      fetchMock.calls(
        `end:/api/v1/database/${expectDbId}/schemas/?q=${rison.encode({
          force: forceRefresh,
        })}`,
      ).length,
    ).toBe(1);
    expect(result.current.data).toEqual(expectedResult);
    await act(async () => {
      result.current.refetch();
    });
    expect(fetchMock.calls(schemaApiRoute).length).toBe(2);
    expect(
      fetchMock.calls(
        `end:/api/v1/database/${expectDbId}/schemas/?q=${rison.encode({
          force: true,
        })}`,
      ).length,
    ).toBe(1);
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
        wrapper: QueryProvider,
      },
    );
    await act(async () => {
      jest.runAllTimers();
    });
    expect(fetchMock.calls(schemaApiRoute).length).toBe(1);
    rerender();
    expect(fetchMock.calls(schemaApiRoute).length).toBe(1);
    expect(result.current.data).toEqual(expectedResult);
  });

  it('returns refreshed data after expires', async () => {
    const expectDbId = 'db1';
    const schemaApiRoute = `glob:*/api/v1/database/${expectDbId}/schemas/*`;
    fetchMock.get(schemaApiRoute, fakeApiResult);
    const { result, rerender } = renderHook(
      () =>
        useSchemas({
          dbId: expectDbId,
        }),
      {
        wrapper: QueryProvider,
      },
    );
    await act(async () => {
      jest.runAllTimers();
    });
    expect(fetchMock.calls(schemaApiRoute).length).toBe(1);
    rerender();
    await act(async () => {
      jest.runAllTimers();
    });
    expect(fetchMock.calls(schemaApiRoute).length).toBe(1);
    queryClient.clear();
    rerender();
    await act(async () => {
      jest.runAllTimers();
    });
    expect(fetchMock.calls(schemaApiRoute).length).toBe(2);
    expect(result.current.data).toEqual(expectedResult);
  });
});
