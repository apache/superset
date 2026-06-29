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
import { renderHook } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { queryClient } from 'src/queries/queryClient';
import { useAccessOptions } from './useAccessOptions';

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  queryClient.clear();
});

test('loadAccessOptions fetches owners, filters inactive, and reports the API count', async () => {
  fetchMock.get('glob:*/api/v1/dashboard/related/owners*', {
    result: [
      {
        value: 1,
        text: 'Alice',
        extra: { active: true, email: 'a@example.com' },
      },
      { value: 2, text: 'Bob', extra: { active: false } },
    ],
    count: 25,
  });

  const { result } = renderHook(() => useAccessOptions());
  const out = await result.current.loadAccessOptions('owners', '', 0, 100);

  // inactive owner (Bob) is filtered out; the API count (not the page length) is used
  expect(out.data).toHaveLength(1);
  expect(out.data[0]).toMatchObject({ value: 1 });
  expect(out.totalCount).toBe(25);
});

test('loadAccessOptions maps roles to plain value/label options', async () => {
  fetchMock.get('glob:*/api/v1/dashboard/related/roles*', {
    result: [{ value: 9, text: 'Admin', extra: {} }],
    count: 1,
  });

  const { result } = renderHook(() => useAccessOptions());
  const out = await result.current.loadAccessOptions('roles', '', 0, 100);

  expect(out.data[0]).toEqual({ value: 9, label: 'Admin' });
});
