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
import fetchMock from 'fetch-mock';
import { useCanvasId } from './useCanvasId';

const listEndpoint = 'glob:*/api/v1/canvas/?q=*';

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('a numeric parameter is the id, with no request', () => {
  const { result } = renderHook(() => useCanvasId('42'));

  expect(result.current).toEqual({ status: 'complete', id: 42 });
  expect(fetchMock.callHistory.calls()).toHaveLength(0);
});

test('a slug is resolved through the list endpoint', async () => {
  fetchMock.get(listEndpoint, { result: [{ id: 7 }] });

  const { result } = renderHook(() => useCanvasId('sales-overview'));

  await waitFor(() =>
    expect(result.current).toEqual({ status: 'complete', id: 7 }),
  );
  expect(fetchMock.callHistory.calls()[0].url).toContain(
    'value:sales-overview',
  );
});

test('an unknown slug is an error', async () => {
  fetchMock.get(listEndpoint, { result: [] });

  const { result } = renderHook(() => useCanvasId('nope'));

  await waitFor(() => expect(result.current).toEqual({ status: 'error' }));
});
