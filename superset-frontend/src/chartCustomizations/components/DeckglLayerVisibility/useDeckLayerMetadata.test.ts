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
import { renderHook } from '@testing-library/react-hooks';
import { SupersetClient } from '@superset-ui/core';
import { useDeckLayerMetadata } from './useDeckLayerMetadata';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    get: jest.fn(),
  },
}));

const mockSupersetClientGet = SupersetClient.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

test('returns empty layers when sliceIds is empty', () => {
  const { result } = renderHook(() => useDeckLayerMetadata([]));

  expect(result.current.layers).toEqual([]);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.error).toBe(null);
});

test('fetches layer metadata successfully', async () => {
  const mockResponse = {
    json: {
      result: [
        { id: 1, slice_name: 'Layer 1', viz_type: 'deck_scatter' },
        { id: 2, slice_name: 'Layer 2', viz_type: 'deck_arc' },
      ],
    },
  };
  mockSupersetClientGet.mockResolvedValue(mockResponse);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDeckLayerMetadata([1, 2]),
  );

  expect(result.current.isLoading).toBe(true);

  await waitForNextUpdate();

  expect(result.current.isLoading).toBe(false);
  expect(result.current.layers).toEqual([
    { sliceId: 1, name: 'Layer 1', type: 'deck_scatter' },
    { sliceId: 2, name: 'Layer 2', type: 'deck_arc' },
  ]);
  expect(result.current.error).toBe(null);
  expect(mockSupersetClientGet).toHaveBeenCalledWith({
    endpoint: expect.stringContaining('/api/v1/chart/?q='),
  });
});

test('handles API error and returns fallback layers', async () => {
  const errorMessage = 'Network error';
  mockSupersetClientGet.mockRejectedValue(new Error(errorMessage));

  const { result, waitForNextUpdate } = renderHook(() =>
    useDeckLayerMetadata([1, 2, 3]),
  );

  await waitForNextUpdate();

  expect(result.current.isLoading).toBe(false);
  expect(result.current.error).toBe(errorMessage);
  expect(result.current.layers).toEqual([
    { sliceId: 1, name: 'Layer 1', type: 'unknown' },
    { sliceId: 2, name: 'Layer 2', type: 'unknown' },
    { sliceId: 3, name: 'Layer 3', type: 'unknown' },
  ]);
});

test('handles non-Error object rejection', async () => {
  mockSupersetClientGet.mockRejectedValue('String error');

  const { result, waitForNextUpdate } = renderHook(() =>
    useDeckLayerMetadata([1]),
  );

  await waitForNextUpdate();

  expect(result.current.isLoading).toBe(false);
  expect(result.current.error).toBe('Unknown error');
  expect(result.current.layers).toEqual([
    { sliceId: 1, name: 'Layer 1', type: 'unknown' },
  ]);
});

test('refetches when sliceIds change', async () => {
  const mockResponse1 = {
    json: {
      result: [{ id: 1, slice_name: 'Layer 1', viz_type: 'deck_scatter' }],
    },
  };
  const mockResponse2 = {
    json: {
      result: [
        { id: 2, slice_name: 'Layer 2', viz_type: 'deck_arc' },
        { id: 3, slice_name: 'Layer 3', viz_type: 'deck_geojson' },
      ],
    },
  };

  mockSupersetClientGet
    .mockResolvedValueOnce(mockResponse1)
    .mockResolvedValueOnce(mockResponse2);

  const { result, rerender, waitForNextUpdate } = renderHook(
    ({ ids }) => useDeckLayerMetadata(ids),
    {
      initialProps: { ids: [1] },
    },
  );

  await waitForNextUpdate();

  expect(result.current.isLoading).toBe(false);
  expect(result.current.layers).toHaveLength(1);
  expect(result.current.layers[0].sliceId).toBe(1);

  rerender({ ids: [2, 3] });

  await waitForNextUpdate();

  expect(result.current.isLoading).toBe(false);
  expect(result.current.layers).toHaveLength(2);
  expect(result.current.layers[0].sliceId).toBe(2);
  expect(result.current.layers[1].sliceId).toBe(3);
  expect(mockSupersetClientGet).toHaveBeenCalledTimes(2);
});

test('handles empty result from API', async () => {
  const mockResponse = {
    json: {
      result: [],
    },
  };
  mockSupersetClientGet.mockResolvedValue(mockResponse);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDeckLayerMetadata([1, 2]),
  );

  await waitForNextUpdate();

  expect(result.current.isLoading).toBe(false);
  expect(result.current.layers).toEqual([]);
  expect(result.current.error).toBe(null);
});

test('does not refetch when sliceIds array has same values', async () => {
  const mockResponse = {
    json: {
      result: [{ id: 1, slice_name: 'Layer 1', viz_type: 'deck_scatter' }],
    },
  };
  mockSupersetClientGet.mockResolvedValue(mockResponse);

  const { result, rerender, waitForNextUpdate } = renderHook(
    ({ ids }) => useDeckLayerMetadata(ids),
    {
      initialProps: { ids: [1] },
    },
  );

  await waitForNextUpdate();

  expect(result.current.isLoading).toBe(false);

  const callCount = mockSupersetClientGet.mock.calls.length;

  rerender({ ids: [1] });

  expect(mockSupersetClientGet).toHaveBeenCalledTimes(callCount);
});
