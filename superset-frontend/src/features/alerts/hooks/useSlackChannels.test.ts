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
import { useSlackChannels } from './useSlackChannels';

// Mock SupersetClient
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    get: jest.fn(),
  },
  logging: {
    error: jest.fn(),
  },
}));

const mockChannels = [
  { id: 'C001', name: 'general', is_private: false },
  { id: 'C002', name: 'engineering', is_private: false },
  { id: 'C003', name: 'random', is_private: false },
];

beforeEach(() => {
  jest.clearAllMocks();
});

test('fetches channels successfully', async () => {
  (SupersetClient.get as jest.Mock).mockResolvedValue({
    json: {
      result: mockChannels,
      next_cursor: null,
      has_more: false,
    },
  });

  const { result } = renderHook(() => useSlackChannels());

  const channels = await result.current.fetchChannels('', 0, 100);

  expect(channels.data).toHaveLength(3);
  expect(channels.data[0]).toEqual({ label: 'general', value: 'C001' });
  expect(channels.totalCount).toBe(3);
});

test('caches results and avoids duplicate requests', async () => {
  (SupersetClient.get as jest.Mock).mockResolvedValue({
    json: {
      result: mockChannels,
      next_cursor: null,
      has_more: false,
    },
  });

  const { result } = renderHook(() => useSlackChannels());

  // First call
  await result.current.fetchChannels('', 0, 100);

  // Second call with same parameters
  await result.current.fetchChannels('', 0, 100);

  // Should only call API once
  expect(SupersetClient.get).toHaveBeenCalledTimes(1);
});

test('deduplicates concurrent requests', async () => {
  (SupersetClient.get as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve =>
        setTimeout(
          () =>
            resolve({
              json: {
                result: mockChannels,
                next_cursor: null,
                has_more: false,
              },
            }),
          100,
        ),
      ),
  );

  const { result } = renderHook(() => useSlackChannels());

  // Make concurrent requests
  const promise1 = result.current.fetchChannels('', 0, 100);
  const promise2 = result.current.fetchChannels('', 0, 100);

  const [result1, result2] = await Promise.all([promise1, promise2]);

  // Should return same data
  expect(result1).toEqual(result2);

  // Should only call API once
  expect(SupersetClient.get).toHaveBeenCalledTimes(1);
});

test('clears cache when search changes', async () => {
  (SupersetClient.get as jest.Mock).mockResolvedValue({
    json: {
      result: mockChannels,
      next_cursor: null,
      has_more: false,
    },
  });

  const { result } = renderHook(() => useSlackChannels());

  // First search
  await result.current.fetchChannels('eng', 0, 100);

  // Different search
  await result.current.fetchChannels('gen', 0, 100);

  // Should call API twice (once for each search)
  expect(SupersetClient.get).toHaveBeenCalledTimes(2);
});

test('handles pagination with cursors', async () => {
  (SupersetClient.get as jest.Mock)
    .mockResolvedValueOnce({
      json: {
        result: mockChannels.slice(0, 2),
        next_cursor: 'cursor_page_2',
        has_more: true,
      },
    })
    .mockResolvedValueOnce({
      json: {
        result: mockChannels.slice(2),
        next_cursor: null,
        has_more: false,
      },
    });

  const { result } = renderHook(() => useSlackChannels());

  // First page
  const page1 = await result.current.fetchChannels('', 0, 2);
  expect(page1.data).toHaveLength(2);
  expect(page1.has_more).toBe(true);

  // Second page
  const page2 = await result.current.fetchChannels('', 1, 2);
  expect(page2.data).toHaveLength(1);
});

test('refreshChannels clears cache and refetches', async () => {
  (SupersetClient.get as jest.Mock).mockResolvedValue({
    json: {
      result: mockChannels,
      next_cursor: null,
      has_more: false,
    },
  });

  const { result } = renderHook(() => useSlackChannels());

  // Initial fetch
  await result.current.fetchChannels('', 0, 100);

  // Cache hit - no new API call
  await result.current.fetchChannels('', 0, 100);
  expect(SupersetClient.get).toHaveBeenCalledTimes(1);

  // Refresh
  await result.current.refreshChannels();

  // Should call API again
  expect(SupersetClient.get).toHaveBeenCalledTimes(2);
});

test('isRefreshing state updates correctly', async () => {
  (SupersetClient.get as jest.Mock).mockResolvedValue({
    json: {
      result: mockChannels,
      next_cursor: null,
      has_more: false,
    },
  });

  const { result } = renderHook(() => useSlackChannels());

  expect(result.current.isRefreshing).toBe(false);

  await result.current.refreshChannels();

  // Should be false after refresh completes
  expect(result.current.isRefreshing).toBe(false);
});

test('calls onError callback when fetch fails', async () => {
  (SupersetClient.get as jest.Mock).mockRejectedValue(new Error('API Error'));

  const onError = jest.fn();
  const { result } = renderHook(() => useSlackChannels(onError));

  await result.current.fetchChannels('', 0, 100);

  expect(onError).toHaveBeenCalledWith(
    expect.stringContaining('Unable to load Slack channels'),
  );
});

test('returns empty data on error', async () => {
  (SupersetClient.get as jest.Mock).mockRejectedValue(new Error('API Error'));

  const { result } = renderHook(() => useSlackChannels());

  const channels = await result.current.fetchChannels('', 0, 100);

  expect(channels.data).toEqual([]);
  expect(channels.totalCount).toBe(0);
});

test('includes search_string in API params when provided', async () => {
  (SupersetClient.get as jest.Mock).mockResolvedValue({
    json: {
      result: [],
      next_cursor: null,
      has_more: false,
    },
  });

  const { result } = renderHook(() => useSlackChannels());

  await result.current.fetchChannels('engineering', 0, 100);

  expect(SupersetClient.get).toHaveBeenCalledWith({
    endpoint: expect.stringContaining('search_string'),
  });
});

test('includes cursor in API params for pagination', async () => {
  (SupersetClient.get as jest.Mock)
    .mockResolvedValueOnce({
      json: {
        result: mockChannels.slice(0, 2),
        next_cursor: 'test_cursor',
        has_more: true,
      },
    })
    .mockResolvedValueOnce({
      json: {
        result: mockChannels.slice(2),
        next_cursor: null,
        has_more: false,
      },
    });

  const { result } = renderHook(() => useSlackChannels());

  // First page
  await result.current.fetchChannels('', 0, 2);

  // Second page
  await result.current.fetchChannels('', 1, 2);

  expect(SupersetClient.get).toHaveBeenCalledWith({
    endpoint: expect.stringContaining('cursor'),
  });
});
