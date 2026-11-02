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
import { renderHook, waitFor } from '@testing-library/react';
import { logging } from '@apache-superset/core/utils';
import fetchMock from 'fetch-mock';
import { supersetGetCache } from 'src/utils/cachedSupersetGet';
import { useDatasetDrillInfo } from './datasets';

afterEach(() => {
  jest.restoreAllMocks();
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  supersetGetCache.clear();
});

test('drill metadata refetches after a transient failure', async () => {
  const endpoint = 'glob:*/api/v1/dataset/707/drill_info/*';
  const logError = jest.spyOn(logging, 'error').mockImplementation(() => {});
  fetchMock.getOnce(endpoint, 500);

  const first = renderHook(() => useDatasetDrillInfo(707, 1));
  await waitFor(() => expect(first.result.current.status).toBe('error'));

  fetchMock.get(endpoint, {
    result: { id: 707, columns: [], metrics: [] },
  });

  const second = renderHook(() => useDatasetDrillInfo(707, 1));
  await waitFor(() => expect(second.result.current.status).toBe('complete'));
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(2);
  expect(logError).toHaveBeenCalledTimes(1);
});
