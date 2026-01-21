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
import { TextEncoder, TextDecoder } from 'util';
import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { useStreamingExport } from './useStreamingExport';
import { ExportStatus } from './StreamingExportModal';

// Polyfill TextEncoder/TextDecoder for Jest environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

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

test('URL prefix guard normalizes relative URL without leading slash and applies prefix', async () => {
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

  // Should add leading slash and apply prefix
  expect(mockFetch).toHaveBeenCalledWith(
    '/superset/api/v1/sqllab/export_streaming/',
    expect.any(Object),
  );
});

test('URL prefix guard normalizes non-slash URL to leading slash when no app root configured', async () => {
  applicationRoot.mockReturnValue('');
  makeUrl.mockImplementation((path: string) => path);

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

  // Should normalize to leading slash even without app root
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/v1/sqllab/export_streaming/',
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

test('URL prefix guard does not double-prefix URL with query string at app root', async () => {
  const appRoot = '/superset';
  applicationRoot.mockReturnValue(appRoot);
  makeUrl.mockImplementation((path: string) => `${appRoot}${path}`);

  const mockFetch = createPrefixTestMockFetch();
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  act(() => {
    result.current.startExport({
      url: '/superset?foo=1&bar=2',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // Should NOT double-prefix to /superset/superset?foo=1&bar=2
  expect(mockFetch).toHaveBeenCalledWith(
    '/superset?foo=1&bar=2',
    expect.any(Object),
  );
});

test('URL prefix guard does not double-prefix URL with hash at app root', async () => {
  const appRoot = '/superset';
  applicationRoot.mockReturnValue(appRoot);
  makeUrl.mockImplementation((path: string) => `${appRoot}${path}`);

  const mockFetch = createPrefixTestMockFetch();
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  act(() => {
    result.current.startExport({
      url: '/superset#section',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // Should NOT double-prefix to /superset/superset#section
  expect(mockFetch).toHaveBeenCalledWith(
    '/superset#section',
    expect.any(Object),
  );
});

// Streaming export behavior tests

test('sets ERROR status and calls onError when stream contains __STREAM_ERROR__ marker', async () => {
  const errorMessage = 'Database connection failed';
  const errorChunk = new TextEncoder().encode(
    `__STREAM_ERROR__:${errorMessage}`,
  );

  let readCount = 0;
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="export.csv"',
    }),
    body: {
      getReader: () => ({
        read: jest.fn().mockImplementation(() => {
          readCount += 1;
          if (readCount === 1) {
            return Promise.resolve({ done: false, value: errorChunk });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
      }),
    },
  });
  global.fetch = mockFetch;

  const onError = jest.fn();
  const { result } = renderHook(() => useStreamingExport({ onError }));

  act(() => {
    result.current.startExport({
      url: '/api/v1/sqllab/export_streaming/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(result.current.progress.status).toBe(ExportStatus.ERROR);
  });

  expect(result.current.progress.error).toBe(errorMessage);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith(errorMessage);
});

test('completes CSV export successfully with correct status and downloadUrl', async () => {
  applicationRoot.mockReturnValue('');
  const csvData = new TextEncoder().encode('id,name\n1,Alice\n2,Bob\n');

  let readCount = 0;
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="results.csv"',
    }),
    body: {
      getReader: () => ({
        read: jest.fn().mockImplementation(() => {
          readCount += 1;
          if (readCount === 1) {
            return Promise.resolve({ done: false, value: csvData });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
      }),
    },
  });
  global.fetch = mockFetch;

  const onComplete = jest.fn();
  const { result } = renderHook(() => useStreamingExport({ onComplete }));

  act(() => {
    result.current.startExport({
      url: '/api/v1/sqllab/export_streaming/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(result.current.progress.status).toBe(ExportStatus.COMPLETED);
  });

  expect(result.current.progress.downloadUrl).toBe('blob:mock-url');
  expect(result.current.progress.filename).toBe('results.csv');
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledWith('blob:mock-url', 'results.csv');
});

test('completes XLSX export successfully with correct filename', async () => {
  applicationRoot.mockReturnValue('');
  const xlsxData = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // XLSX magic bytes

  let readCount = 0;
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="report.xlsx"',
    }),
    body: {
      getReader: () => ({
        read: jest.fn().mockImplementation(() => {
          readCount += 1;
          if (readCount === 1) {
            return Promise.resolve({ done: false, value: xlsxData });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
      }),
    },
  });
  global.fetch = mockFetch;

  const onComplete = jest.fn();
  const { result } = renderHook(() => useStreamingExport({ onComplete }));

  act(() => {
    result.current.startExport({
      url: '/api/v1/chart/data',
      payload: { datasource: '1__table', viz_type: 'table' },
      exportType: 'xlsx',
    });
  });

  await waitFor(() => {
    expect(result.current.progress.status).toBe(ExportStatus.COMPLETED);
  });

  expect(result.current.progress.filename).toBe('report.xlsx');
  expect(onComplete).toHaveBeenCalledWith('blob:mock-url', 'report.xlsx');
});

test('sets ERROR status when response is not ok (4xx/5xx)', async () => {
  applicationRoot.mockReturnValue('');
  const mockFetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    headers: new Headers({}),
  });
  global.fetch = mockFetch;

  const onError = jest.fn();
  const { result } = renderHook(() => useStreamingExport({ onError }));

  act(() => {
    result.current.startExport({
      url: '/api/v1/sqllab/export_streaming/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(result.current.progress.status).toBe(ExportStatus.ERROR);
  });

  expect(result.current.progress.error).toBe(
    'Export failed: 500 Internal Server Error',
  );
  expect(onError).toHaveBeenCalledWith(
    'Export failed: 500 Internal Server Error',
  );
});

test('sets ERROR status when response body is missing', async () => {
  applicationRoot.mockReturnValue('');
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({}),
    body: null,
  });
  global.fetch = mockFetch;

  const onError = jest.fn();
  const { result } = renderHook(() => useStreamingExport({ onError }));

  act(() => {
    result.current.startExport({
      url: '/api/v1/sqllab/export_streaming/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(result.current.progress.status).toBe(ExportStatus.ERROR);
  });

  expect(result.current.progress.error).toBe(
    'Response body is not available for streaming',
  );
  expect(onError).toHaveBeenCalledWith(
    'Response body is not available for streaming',
  );
});

test('cancelExport sets CANCELLED status and aborts the request', async () => {
  applicationRoot.mockReturnValue('');
  let abortSignal: AbortSignal | undefined;

  // Create a reader that will hang until aborted
  const mockFetch = jest.fn().mockImplementation((_url, options) => {
    abortSignal = options?.signal;
    return Promise.resolve({
      ok: true,
      headers: new Headers({
        'Content-Disposition': 'attachment; filename="export.csv"',
      }),
      body: {
        getReader: () => ({
          read: jest.fn().mockImplementation(
            () =>
              new Promise((resolve, reject) => {
                // Simulate slow stream that can be aborted
                const timeout = setTimeout(() => {
                  resolve({
                    done: false,
                    value: new TextEncoder().encode('data'),
                  });
                }, 10000);
                abortSignal?.addEventListener('abort', () => {
                  clearTimeout(timeout);
                  reject(new Error('Export cancelled by user'));
                });
              }),
          ),
        }),
      },
    });
  });
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  act(() => {
    result.current.startExport({
      url: '/api/v1/sqllab/export_streaming/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
    });
  });

  // Wait for fetch to be called
  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // Cancel the export
  act(() => {
    result.current.cancelExport();
  });

  await waitFor(() => {
    expect(result.current.progress.status).toBe(ExportStatus.CANCELLED);
  });
});

test('parses filename from Content-Disposition header with quotes', async () => {
  applicationRoot.mockReturnValue('');
  const csvData = new TextEncoder().encode('data\n');

  let readCount = 0;
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="my export file.csv"',
    }),
    body: {
      getReader: () => ({
        read: jest.fn().mockImplementation(() => {
          readCount += 1;
          if (readCount === 1) {
            return Promise.resolve({ done: false, value: csvData });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
      }),
    },
  });
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
    expect(result.current.progress.status).toBe(ExportStatus.COMPLETED);
  });

  expect(result.current.progress.filename).toBe('my export file.csv');
});

test('uses default filename when Content-Disposition header is missing', async () => {
  applicationRoot.mockReturnValue('');
  const csvData = new TextEncoder().encode('data\n');

  let readCount = 0;
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({}),
    body: {
      getReader: () => ({
        read: jest.fn().mockImplementation(() => {
          readCount += 1;
          if (readCount === 1) {
            return Promise.resolve({ done: false, value: csvData });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
      }),
    },
  });
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
    expect(result.current.progress.status).toBe(ExportStatus.COMPLETED);
  });

  expect(result.current.progress.filename).toBe('export.csv');
});

test('updates progress with rowsProcessed and totalSize during streaming', async () => {
  applicationRoot.mockReturnValue('');
  const chunk1 = new TextEncoder().encode('id,name\n1,Alice\n');
  const chunk2 = new TextEncoder().encode('2,Bob\n3,Charlie\n');

  let readCount = 0;
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="export.csv"',
    }),
    body: {
      getReader: () => ({
        read: jest.fn().mockImplementation(() => {
          readCount += 1;
          if (readCount === 1) {
            return Promise.resolve({ done: false, value: chunk1 });
          }
          if (readCount === 2) {
            return Promise.resolve({ done: false, value: chunk2 });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
      }),
    },
  });
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  act(() => {
    result.current.startExport({
      url: '/api/v1/sqllab/export_streaming/',
      payload: { client_id: 'test-id' },
      exportType: 'csv',
      expectedRows: 100,
    });
  });

  await waitFor(() => {
    expect(result.current.progress.status).toBe(ExportStatus.COMPLETED);
  });

  // Verify final progress reflects data received
  expect(result.current.progress.totalSize).toBe(chunk1.length + chunk2.length);
  // 4 newlines total (2 in chunk1, 2 in chunk2)
  expect(result.current.progress.rowsProcessed).toBe(4);
});

test('prevents double startExport calls while export is in progress', async () => {
  applicationRoot.mockReturnValue('');

  // Create a slow reader that takes time to complete
  let readCount = 0;
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="export.csv"',
    }),
    body: {
      getReader: () => ({
        read: jest.fn().mockImplementation(
          () =>
            new Promise(resolve => {
              readCount += 1;
              if (readCount === 1) {
                // Delay first chunk to simulate in-progress export
                setTimeout(() => {
                  resolve({
                    done: false,
                    value: new TextEncoder().encode('data\n'),
                  });
                }, 50);
              } else {
                resolve({ done: true, value: undefined });
              }
            }),
        ),
      }),
    },
  });
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  // Start first export
  act(() => {
    result.current.startExport({
      url: '/api/v1/first/',
      payload: { client_id: 'first' },
      exportType: 'csv',
    });
  });

  // Immediately try to start second export
  act(() => {
    result.current.startExport({
      url: '/api/v1/second/',
      payload: { client_id: 'second' },
      exportType: 'csv',
    });
  });

  await waitFor(() => {
    expect(result.current.progress.status).toBe(ExportStatus.COMPLETED);
  });

  // Only one fetch call should have been made (first export)
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith('/api/v1/first/', expect.any(Object));
});

test('retryExport does nothing when no prior export exists', async () => {
  applicationRoot.mockReturnValue('');
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  const { result } = renderHook(() => useStreamingExport());

  // Call retry without ever calling startExport
  act(() => {
    result.current.retryExport();
  });

  // Give it time to potentially make a call
  await new Promise(resolve => {
    setTimeout(resolve, 50);
  });

  // No fetch should have been made
  expect(mockFetch).not.toHaveBeenCalled();
});

test('state resets correctly after successful export and resetExport call', async () => {
  applicationRoot.mockReturnValue('');
  const csvData = new TextEncoder().encode('data\n');

  let readCount = 0;
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="export.csv"',
    }),
    body: {
      getReader: () => ({
        read: jest.fn().mockImplementation(() => {
          readCount += 1;
          if (readCount === 1) {
            return Promise.resolve({ done: false, value: csvData });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
      }),
    },
  });
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
    expect(result.current.progress.status).toBe(ExportStatus.COMPLETED);
  });

  // Verify completed state
  expect(result.current.progress.downloadUrl).toBe('blob:mock-url');

  // Reset the export
  act(() => {
    result.current.resetExport();
  });

  // Verify state is reset
  expect(result.current.progress.status).toBe(ExportStatus.STREAMING);
  expect(result.current.progress.rowsProcessed).toBe(0);
  expect(result.current.progress.totalSize).toBe(0);
  expect(result.current.progress.downloadUrl).toBeUndefined();
  expect(result.current.progress.error).toBeUndefined();
  expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
});

test('state resets correctly after failed export and resetExport call', async () => {
  applicationRoot.mockReturnValue('');
  const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
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
    expect(result.current.progress.status).toBe(ExportStatus.ERROR);
  });

  // Verify error state
  expect(result.current.progress.error).toBe('Network error');

  // Reset the export
  act(() => {
    result.current.resetExport();
  });

  // Verify state is reset
  expect(result.current.progress.status).toBe(ExportStatus.STREAMING);
  expect(result.current.progress.error).toBeUndefined();
  expect(result.current.progress.rowsProcessed).toBe(0);
});
