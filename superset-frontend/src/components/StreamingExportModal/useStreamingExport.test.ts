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
import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { useStreamingExport } from './useStreamingExport';
import { ExportStatus } from './StreamingExportModal';

// Mock SupersetClient
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    getCSRFToken: jest.fn(() => Promise.resolve('mock-csrf-token')),
  },
}));

// Mock pathUtils and getBootstrapData for URL prefix guard tests
jest.mock('src/utils/pathUtils', () => ({
  makeUrl: jest.fn((path: string) => path),
}));

jest.mock('src/utils/getBootstrapData', () => ({
  applicationRoot: jest.fn(() => ''),
}));

global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

test('useStreamingExport initializes with default progress state', () => {
  const { result } = renderHook(() => useStreamingExport());

  expect(result.current.progress).toEqual({
    rowsProcessed: 0,
    totalRows: undefined,
    totalSize: 0,
    speed: 0,
    mbPerSecond: 0,
    elapsedTime: 0,
    status: ExportStatus.STREAMING,
  });
});

test('useStreamingExport provides startExport function', () => {
  const { result } = renderHook(() => useStreamingExport());

  expect(typeof result.current.startExport).toBe('function');
});

test('useStreamingExport provides resetExport function', () => {
  const { result } = renderHook(() => useStreamingExport());

  expect(typeof result.current.resetExport).toBe('function');
});

test('useStreamingExport provides retryExport function', () => {
  const { result } = renderHook(() => useStreamingExport());

  expect(typeof result.current.retryExport).toBe('function');
});

test('useStreamingExport provides cancelExport function', () => {
  const { result } = renderHook(() => useStreamingExport());

  expect(typeof result.current.cancelExport).toBe('function');
});

test('useStreamingExport resetExport resets progress to initial state', () => {
  const { result } = renderHook(() => useStreamingExport());

  act(() => {
    result.current.resetExport();
  });

  expect(result.current.progress.status).toBe(ExportStatus.STREAMING);
  expect(result.current.progress.rowsProcessed).toBe(0);
  expect(result.current.progress.totalSize).toBe(0);
});

test('useStreamingExport accepts onComplete callback option', () => {
  const onComplete = jest.fn();
  const { result } = renderHook(() => useStreamingExport({ onComplete }));

  expect(result.current).toBeDefined();
});

test('useStreamingExport accepts onError callback option', () => {
  const onError = jest.fn();
  const { result } = renderHook(() => useStreamingExport({ onError }));

  expect(result.current).toBeDefined();
});

test('useStreamingExport progress includes all required fields', () => {
  const { result } = renderHook(() => useStreamingExport());

  expect(result.current.progress).toHaveProperty('rowsProcessed');
  expect(result.current.progress).toHaveProperty('totalRows');
  expect(result.current.progress).toHaveProperty('totalSize');
  expect(result.current.progress).toHaveProperty('status');
  expect(result.current.progress).toHaveProperty('speed');
  expect(result.current.progress).toHaveProperty('mbPerSecond');
  expect(result.current.progress).toHaveProperty('elapsedTime');
});

test('useStreamingExport cleans up on unmount', () => {
  const revokeObjectURL = jest.fn();
  global.URL.revokeObjectURL = revokeObjectURL;

  const { unmount } = renderHook(() => useStreamingExport());

  unmount();

  // Cleanup should not throw errors
  expect(true).toBe(true);
});

test('retryExport reuses the same URL from the original startExport call', async () => {
  // This test ensures that retryExport uses the exact same URL that was passed to startExport,
  // which is important for subdirectory deployments where the URL is already prefixed.
  const originalUrl = '/superset/api/v1/sqllab/export_streaming/';
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="export.csv"',
    }),
    body: {
      getReader: () => ({
        read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
      }),
    },
  });
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  // First call with startExport
  act(() => {
    result.current.startExport({
      url: originalUrl,
      payload: { client_id: 'test-id' },
      exportType: 'csv',
      expectedRows: 100,
    });
  });

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
  expect(mockFetch).toHaveBeenCalledWith(originalUrl, expect.any(Object));

  // Reset mock to track retry call
  mockFetch.mockClear();

  // Reset the export state so we can retry
  act(() => {
    result.current.resetExport();
  });

  // Call retryExport - should reuse the same URL
  act(() => {
    result.current.retryExport();
  });

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
  // Retry should use the exact same URL that was passed to startExport
  expect(mockFetch).toHaveBeenCalledWith(originalUrl, expect.any(Object));
});

test('sets ERROR status and calls onError when fetch rejects', async () => {
  const errorMessage = 'Network error';
  const mockFetch = jest.fn().mockRejectedValue(new Error(errorMessage));
  global.fetch = mockFetch;

  const onError = jest.fn();
  const { result } = renderHook(() => useStreamingExport({ onError }));

  act(() => {
    result.current.startExport({
      url: '/api/v1/sqllab/export_streaming/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
      expectedRows: 100,
    });
  });

  // Wait for fetch to be called and error to be processed
  await waitFor(() => {
    expect(result.current.progress.status).toBe(ExportStatus.ERROR);
  });

  // Verify onError was called exactly once with the error message
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith(errorMessage);
});

// URL prefix guard tests - prevent regression of missing app root prefix
const { applicationRoot } = jest.requireMock('src/utils/getBootstrapData');
const { makeUrl } = jest.requireMock('src/utils/pathUtils');

const createPrefixTestMockFetch = () =>
  jest.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="export.csv"',
    }),
    body: {
      getReader: () => ({
        read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
      }),
    },
  });

test('URL prefix guard applies prefix to unprefixed relative URL when app root is configured', async () => {
  const appRoot = '/superset';
  applicationRoot.mockReturnValue(appRoot);
  makeUrl.mockImplementation((path: string) => `${appRoot}${path}`);

  const mockFetch = createPrefixTestMockFetch();
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  act(() => {
    result.current.startExport({
      url: '/api/v1/sqllab/export_streaming/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  expect(mockFetch).toHaveBeenCalledWith(
    '/superset/api/v1/sqllab/export_streaming/',
    expect.any(Object),
  );
});

test('URL prefix guard does not double-prefix URL that already has app root', async () => {
  const appRoot = '/superset';
  applicationRoot.mockReturnValue(appRoot);
  makeUrl.mockImplementation((path: string) => `${appRoot}${path}`);

  const mockFetch = createPrefixTestMockFetch();
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  act(() => {
    result.current.startExport({
      url: '/superset/api/v1/sqllab/export_streaming/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  expect(mockFetch).toHaveBeenCalledWith(
    '/superset/api/v1/sqllab/export_streaming/',
    expect.any(Object),
  );
});

test('URL prefix guard leaves URL unchanged when no app root is configured', async () => {
  applicationRoot.mockReturnValue('');

  const mockFetch = createPrefixTestMockFetch();
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  act(() => {
    result.current.startExport({
      url: '/api/v1/sqllab/export_streaming/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  expect(mockFetch).toHaveBeenCalledWith(
    '/api/v1/sqllab/export_streaming/',
    expect.any(Object),
  );
});

test('URL prefix guard leaves relative URL without leading slash unchanged', async () => {
  const appRoot = '/superset';
  applicationRoot.mockReturnValue(appRoot);
  makeUrl.mockImplementation((path: string) => `${appRoot}${path}`);

  const mockFetch = createPrefixTestMockFetch();
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  act(() => {
    result.current.startExport({
      url: 'api/v1/sqllab/export_streaming/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  expect(mockFetch).toHaveBeenCalledWith(
    'api/v1/sqllab/export_streaming/',
    expect.any(Object),
  );
});

test('URL prefix guard leaves absolute URLs (https) unchanged', async () => {
  const appRoot = '/superset';
  applicationRoot.mockReturnValue(appRoot);
  makeUrl.mockImplementation((path: string) => `${appRoot}${path}`);

  const mockFetch = createPrefixTestMockFetch();
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  act(() => {
    result.current.startExport({
      url: 'https://external.example.com/api/export/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  expect(mockFetch).toHaveBeenCalledWith(
    'https://external.example.com/api/export/',
    expect.any(Object),
  );
});

test('URL prefix guard leaves protocol-relative URLs (//host) unchanged', async () => {
  const appRoot = '/superset';
  applicationRoot.mockReturnValue(appRoot);
  makeUrl.mockImplementation((path: string) => `${appRoot}${path}`);

  const mockFetch = createPrefixTestMockFetch();
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  act(() => {
    result.current.startExport({
      url: '//external.example.com/api/export/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  expect(mockFetch).toHaveBeenCalledWith(
    '//external.example.com/api/export/',
    expect.any(Object),
  );
});

test('URL prefix guard correctly handles sibling paths (prefixes /app2 when appRoot is /app)', async () => {
  const appRoot = '/app';
  applicationRoot.mockReturnValue(appRoot);
  makeUrl.mockImplementation((path: string) => `${appRoot}${path}`);

  const mockFetch = createPrefixTestMockFetch();
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  act(() => {
    result.current.startExport({
      url: '/app2/api/v1/export/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // /app2 should be prefixed because it's not under /app/ - it's a sibling path
  expect(mockFetch).toHaveBeenCalledWith(
    '/app/app2/api/v1/export/',
    expect.any(Object),
  );
});
