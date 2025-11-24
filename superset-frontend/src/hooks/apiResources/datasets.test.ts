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
import { Dataset } from 'src/components/Chart/types';
import {
  cachedSupersetGet,
  supersetGetCache,
} from 'src/utils/cachedSupersetGet';
import {
  getDatasetId,
  createVerboseMap,
  useDatasetDrillInfo,
} from './datasets';

jest.mock('src/utils/cachedSupersetGet', () => ({
  cachedSupersetGet: jest.fn(),
  supersetGetCache: {
    delete: jest.fn(),
  },
}));

// Mock getExtensionsRegistry at module level - returns undefined by default
const mockGetExtensionsRegistry = jest.fn(() => ({ get: () => undefined }));
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getExtensionsRegistry: () => mockGetExtensionsRegistry(),
}));

const mockedCachedSupersetGet = jest.mocked(cachedSupersetGet);
const mockedSupersetGetCacheDelete = jest.mocked(supersetGetCache.delete);
const mockExtension = jest.fn();

// Helper to configure extension mock for extension path tests
function setupExtensionMock() {
  mockGetExtensionsRegistry.mockReturnValue({
    get: jest.fn((key: any) =>
      key === 'load.drillby.options' ? mockExtension : undefined,
    ) as any,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // Restore default behavior to prevent test pollution
  mockGetExtensionsRegistry.mockReturnValue({ get: () => undefined });
});

test('getDatasetId extracts numeric ID from string datasource ID', () => {
  expect(getDatasetId('123__table')).toBe(123);
  expect(getDatasetId('456__another_table')).toBe(456);
});

test('getDatasetId handles numeric datasource ID', () => {
  expect(getDatasetId(789)).toBe(789);
  expect(getDatasetId(0)).toBe(0);
});

test('getDatasetId handles non-numeric string ID', () => {
  const result = getDatasetId('abc');
  expect(Number.isNaN(result)).toBe(true);
});

test('getDatasetId handles empty string ID', () => {
  const result = getDatasetId('');
  expect(result).toBe(0);
});

test('getDatasetId handles string with trailing underscores', () => {
  const result = getDatasetId('123__');
  expect(result).toBe(123);
});

test('createVerboseMap creates verbose_map from columns', () => {
  const dataset = {
    columns: [
      { column_name: 'col1', verbose_name: 'Column 1' },
      { column_name: 'col2', verbose_name: 'Column 2' },
      { column_name: 'col3' }, // no verbose_name
    ],
    metrics: [],
  } as Dataset;

  const verboseMap = createVerboseMap(dataset);

  expect(verboseMap).toEqual({
    col1: 'Column 1',
    col2: 'Column 2',
    col3: 'col3', // falls back to column_name
  });
});

test('createVerboseMap creates verbose_map from metrics', () => {
  const dataset = {
    columns: [],
    metrics: [
      { metric_name: 'metric1', verbose_name: 'Metric 1' },
      { metric_name: 'metric2', verbose_name: 'Metric 2' },
      { metric_name: 'metric3' }, // no verbose_name
    ],
  } as any;

  const verboseMap = createVerboseMap(dataset);

  expect(verboseMap).toEqual({
    metric1: 'Metric 1',
    metric2: 'Metric 2',
    metric3: 'metric3', // falls back to metric_name
  });
});

test('createVerboseMap creates verbose_map from both columns and metrics', () => {
  const dataset = {
    columns: [{ column_name: 'col1', verbose_name: 'Column 1' }],
    metrics: [{ metric_name: 'metric1', verbose_name: 'Metric 1' }],
  } as Dataset;

  const verboseMap = createVerboseMap(dataset);

  expect(verboseMap).toEqual({
    col1: 'Column 1',
    metric1: 'Metric 1',
  });
});

test('createVerboseMap handles undefined dataset', () => {
  const verboseMap = createVerboseMap(undefined);
  expect(verboseMap).toEqual({});
});

test('useDatasetDrillInfo fetches dataset drill info successfully', async () => {
  const mockDataset = {
    id: 123,
    columns: [{ column_name: 'col1', verbose_name: 'Column 1' }],
    metrics: [{ metric_name: 'metric1', verbose_name: 'Metric 1' }],
  };

  mockedCachedSupersetGet.mockResolvedValue({
    json: {
      result: mockDataset,
    },
  } as any);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetDrillInfo(123, 456),
  );

  expect(result.current.status).toBe('loading');

  await waitForNextUpdate();

  expect(result.current.status).toBe('complete');
  expect(result.current.result).toEqual({
    ...mockDataset,
    verbose_map: {
      col1: 'Column 1',
      metric1: 'Metric 1',
    },
  });
  expect(result.current.error).toBeNull();
});

test('useDatasetDrillInfo handles network errors', async () => {
  mockedCachedSupersetGet.mockRejectedValue(new Error('Network error'));

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetDrillInfo(123, 456),
  );

  await waitForNextUpdate();

  expect(result.current.status).toBe('error');
  expect(result.current.result).toBeNull();
  expect(result.current.error).toBeInstanceOf(Error);
  expect(result.current.error?.message).toBe('Network error');
  expect(mockedSupersetGetCacheDelete).toHaveBeenCalled();
});

test('useDatasetDrillInfo skips fetch when skip is true', async () => {
  const { result } = renderHook(() =>
    useDatasetDrillInfo(123, 456, undefined, true),
  );

  // Should immediately return complete status without fetching
  expect(result.current.status).toBe('complete');
  expect(result.current.result).toEqual({});
  expect(result.current.error).toBeNull();

  // Verify no API call was made
  expect(mockedCachedSupersetGet).not.toHaveBeenCalled();
});

test('useDatasetDrillInfo extracts dataset ID from string format', async () => {
  const mockDataset = {
    id: 123,
    columns: [],
    metrics: [],
  };

  mockedCachedSupersetGet.mockResolvedValue({
    json: {
      result: mockDataset,
    },
  } as any);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetDrillInfo('123__table', 456),
  );

  await waitForNextUpdate();

  expect(result.current.status).toBe('complete');
  expect(mockedCachedSupersetGet).toHaveBeenCalledWith({
    endpoint: '/api/v1/dataset/123/drill_info/?q=(dashboard_id:456)',
  });
});

test('useDatasetDrillInfo does not clear cache on successful fetch', async () => {
  const mockDataset = {
    id: 123,
    columns: [],
    metrics: [],
  };

  mockedCachedSupersetGet.mockResolvedValue({
    json: {
      result: mockDataset,
    },
  } as any);

  const { waitForNextUpdate } = renderHook(() => useDatasetDrillInfo(123, 456));

  await waitForNextUpdate();

  // Cache should NOT be deleted on success
  expect(mockedSupersetGetCacheDelete).not.toHaveBeenCalled();
});

test('useDatasetDrillInfo creates new verbose_map from columns and metrics', async () => {
  const mockDataset = {
    id: 123,
    verbose_map: { old_key: 'Old Value' }, // Existing verbose_map will be replaced
    columns: [{ column_name: 'col1', verbose_name: 'Column 1' }],
    metrics: [{ metric_name: 'metric1', verbose_name: 'Metric 1' }],
  };

  mockedCachedSupersetGet.mockResolvedValue({
    json: {
      result: mockDataset,
    },
  } as any);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetDrillInfo(123, 456),
  );

  await waitForNextUpdate();

  expect(result.current.status).toBe('complete');
  // Verify verbose_map is created from columns/metrics (existing verbose_map replaced)
  expect(result.current.result?.verbose_map).toEqual({
    col1: 'Column 1',
    metric1: 'Metric 1',
  });
  // Old key should not be present
  expect(result.current.result?.verbose_map).not.toHaveProperty('old_key');
});

test('useDatasetDrillInfo handles NaN datasource ID from malformed string', async () => {
  mockedCachedSupersetGet.mockResolvedValue({
    json: {
      result: { id: NaN, columns: [], metrics: [] },
    },
  } as any);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetDrillInfo('abc', 456),
  );

  await waitForNextUpdate();

  // Verify hook calls endpoint with NaN (API will handle validation)
  expect(mockedCachedSupersetGet).toHaveBeenCalledWith({
    endpoint: '/api/v1/dataset/NaN/drill_info/?q=(dashboard_id:456)',
  });
  expect(result.current.status).toBe('complete');
});

test('useDatasetDrillInfo fetches dataset via extension when extension and formData provided', async () => {
  setupExtensionMock();

  const mockFormData = {
    viz_type: 'table',
    datasource: '123__table',
    adhoc_filters: [],
  };
  const mockDataset = {
    id: 123,
    columns: [{ column_name: 'col1', verbose_name: 'Column 1' }],
    metrics: [{ metric_name: 'metric1', verbose_name: 'Metric 1' }],
  };

  mockExtension.mockResolvedValue({
    json: { result: mockDataset },
  } as any);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetDrillInfo(123, 456, mockFormData),
  );

  expect(result.current.status).toBe('loading');

  await waitForNextUpdate();

  // Verify extension was called with correct arguments
  expect(mockExtension).toHaveBeenCalledWith(123, mockFormData);

  // Verify result contains dataset with verbose_map
  expect(result.current.status).toBe('complete');
  expect(result.current.result).toEqual({
    ...mockDataset,
    verbose_map: {
      col1: 'Column 1',
      metric1: 'Metric 1',
    },
  });
  expect(result.current.error).toBeNull();

  // Verify cachedSupersetGet was NOT called (extension path bypasses REST API)
  expect(mockedCachedSupersetGet).not.toHaveBeenCalled();
});

test('useDatasetDrillInfo handles extension throwing error', async () => {
  setupExtensionMock();

  const mockFormData = { viz_type: 'table', datasource: '123__table' };
  const extensionError = new Error('Extension failed');

  mockExtension.mockRejectedValue(extensionError);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetDrillInfo(123, 456, mockFormData),
  );

  await waitForNextUpdate();

  // Verify error state
  expect(result.current.status).toBe('error');
  expect(result.current.result).toBeNull();
  expect(result.current.error).toBeInstanceOf(Error);
  expect(result.current.error?.message).toBe('Extension failed');

  // Verify REST API was not called
  expect(mockedCachedSupersetGet).not.toHaveBeenCalled();

  // Verify cache is NOT deleted for extension errors (extensions don't use cache)
  expect(mockedSupersetGetCacheDelete).not.toHaveBeenCalled();
});

test('useDatasetDrillInfo handles extension returning malformed payload with undefined result', async () => {
  setupExtensionMock();

  const mockFormData = { viz_type: 'table', datasource: '123__table' };

  // Extension returns undefined instead of expected shape
  mockExtension.mockResolvedValue(undefined as any);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetDrillInfo(123, 456, mockFormData),
  );

  await waitForNextUpdate();

  // Hook should handle gracefully and set result with empty verbose_map
  expect(result.current.status).toBe('complete');
  expect(result.current.result).toEqual({ verbose_map: {} });
  expect(result.current.error).toBeNull();
});

test('useDatasetDrillInfo handles extension returning malformed payload with missing json.result', async () => {
  setupExtensionMock();

  const mockFormData = { viz_type: 'table', datasource: '123__table' };

  // Extension returns object but missing json.result
  mockExtension.mockResolvedValue({ json: {} } as any);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetDrillInfo(123, 456, mockFormData),
  );

  await waitForNextUpdate();

  // Hook should handle gracefully - undefined result gets empty verbose_map
  expect(result.current.status).toBe('complete');
  expect(result.current.result).toEqual({ verbose_map: {} });
  expect(result.current.error).toBeNull();
});

test('useDatasetDrillInfo falls back to REST API when extension exists but formData is undefined', async () => {
  setupExtensionMock();

  // Extension is registered (mockGetExtensionsRegistry returns it)
  // But formData is NOT provided (undefined)
  const mockDataset = {
    id: 123,
    columns: [{ column_name: 'col1', verbose_name: 'Column 1' }],
    metrics: [],
  };

  mockedCachedSupersetGet.mockResolvedValue({
    json: { result: mockDataset },
  } as any);

  const { result, waitForNextUpdate } = renderHook(
    () => useDatasetDrillInfo(123, 456, undefined), // formData is undefined
  );

  await waitForNextUpdate();

  // Should use REST API, NOT extension
  expect(mockedCachedSupersetGet).toHaveBeenCalledWith({
    endpoint: '/api/v1/dataset/123/drill_info/?q=(dashboard_id:456)',
  });
  expect(mockExtension).not.toHaveBeenCalled();
  expect(result.current.status).toBe('complete');
  expect(result.current.result).toEqual({
    ...mockDataset,
    verbose_map: { col1: 'Column 1' },
  });
});
