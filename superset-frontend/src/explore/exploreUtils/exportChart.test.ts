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
import { exportChart } from '.';

jest.mock('src/utils/export', () => ({
  ...jest.requireActual('src/utils/export'),
  downloadBlob: jest.fn(),
}));

// Mock pathUtils to control app root prefix
jest.mock('src/utils/pathUtils', () => ({
  ensureAppRoot: jest.fn((path: string) => path),
}));

// Mock SupersetClient
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    postBlob: jest.fn(),
    postForm: jest.fn(),
    get: jest.fn().mockResolvedValue({ json: {} }),
    post: jest.fn().mockResolvedValue({ json: {} }),
  },
  getChartBuildQueryRegistry: jest.fn().mockReturnValue({
    get: jest.fn().mockReturnValue(() => () => ({})),
  }),
  getChartMetadataRegistry: jest.fn().mockReturnValue({
    get: jest.fn().mockReturnValue({ parseMethod: 'json' }),
  }),
}));

const { ensureAppRoot } = jest.requireMock('src/utils/pathUtils');
const { getChartMetadataRegistry } = jest.requireMock('@superset-ui/core');
const { downloadBlob } = jest.requireMock('src/utils/export');

const mockBlob = new Blob(['test data'], { type: 'text/csv' });

const createMockExportResponse = (headers: Headers = new Headers()) => ({
  headers,
  blob: jest.fn().mockResolvedValue(mockBlob),
});

// Minimal formData that won't trigger legacy API (useLegacyApi = false)
const baseFormData = {
  datasource: '1__table',
  viz_type: 'table',
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no prefix
  ensureAppRoot.mockImplementation((path: string) => path);
  // Default: v1 API (not legacy)
  getChartMetadataRegistry.mockReturnValue({
    get: jest.fn().mockReturnValue({ parseMethod: 'json' }),
  });
});

// Tests for exportChart URL prefix handling in streaming export.
// Streaming uses native fetch (not SupersetClient), so exportChart must apply
// ensureAppRoot before passing the URL to onStartStreamingExport.
test('exportChart v1 API passes prefixed URL to onStartStreamingExport when app root is configured', async () => {
  const appRoot = '/superset';
  ensureAppRoot.mockImplementation((path: string) => `${appRoot}${path}`);

  const onStartStreamingExport = jest.fn();

  await exportChart({
    formData: baseFormData,
    resultFormat: 'csv',
    onStartStreamingExport: onStartStreamingExport as unknown as null,
  });

  expect(onStartStreamingExport).toHaveBeenCalledTimes(1);
  const callArgs = onStartStreamingExport.mock.calls[0][0];
  expect(callArgs.url).toBe('/superset/api/v1/chart/data');
  expect(callArgs.exportType).toBe('csv');
});

test('exportChart v1 API passes unprefixed URL when no app root is configured', async () => {
  ensureAppRoot.mockImplementation((path: string) => path);

  const onStartStreamingExport = jest.fn();

  await exportChart({
    formData: baseFormData,
    resultFormat: 'csv',
    onStartStreamingExport: onStartStreamingExport as unknown as null,
  });

  expect(onStartStreamingExport).toHaveBeenCalledTimes(1);
  const callArgs = onStartStreamingExport.mock.calls[0][0];
  expect(callArgs.url).toBe('/api/v1/chart/data');
});

test('exportChart v1 API passes nested prefix for deeply nested deployments', async () => {
  const appRoot = '/my-company/analytics/superset';
  ensureAppRoot.mockImplementation((path: string) => `${appRoot}${path}`);

  const onStartStreamingExport = jest.fn();

  await exportChart({
    formData: baseFormData,
    resultFormat: 'xlsx',
    onStartStreamingExport: onStartStreamingExport as unknown as null,
  });

  expect(onStartStreamingExport).toHaveBeenCalledTimes(1);
  const callArgs = onStartStreamingExport.mock.calls[0][0];
  expect(callArgs.url).toBe('/my-company/analytics/superset/api/v1/chart/data');
  expect(callArgs.exportType).toBe('xlsx');
});

// Regression test for the double-prefix bug: SupersetClient.postBlob adds appRoot
// internally via getUrl(), so the URL passed must NOT already be prefixed.
test('exportChart v1 API calls postBlob with unprefixed URL when app root is configured', async () => {
  const { SupersetClient } = jest.requireMock('@superset-ui/core');
  const appRoot = '/analytics';
  ensureAppRoot.mockImplementation((path: string) => `${appRoot}${path}`);
  SupersetClient.postBlob.mockResolvedValue(createMockExportResponse());

  await exportChart({
    formData: baseFormData,
    resultFormat: 'csv',
  });

  expect(SupersetClient.postBlob).toHaveBeenCalledTimes(1);
  const [url] = SupersetClient.postBlob.mock.calls[0];
  expect(url).toBe('/api/v1/chart/data');
  expect(url).not.toContain(appRoot);
  expect(downloadBlob).toHaveBeenCalled();
});

test('exportChart passes csv exportType for CSV exports', async () => {
  const onStartStreamingExport = jest.fn();

  await exportChart({
    formData: baseFormData,
    resultFormat: 'csv',
    onStartStreamingExport: onStartStreamingExport as unknown as null,
  });

  expect(onStartStreamingExport).toHaveBeenCalledWith(
    expect.objectContaining({
      exportType: 'csv',
    }),
  );
});

test('exportChart passes xlsx exportType for Excel exports', async () => {
  const onStartStreamingExport = jest.fn();

  await exportChart({
    formData: baseFormData,
    resultFormat: 'xlsx',
    onStartStreamingExport: onStartStreamingExport as unknown as null,
  });

  expect(onStartStreamingExport).toHaveBeenCalledWith(
    expect.objectContaining({
      exportType: 'xlsx',
    }),
  );
});

test('exportChart legacy API (useLegacyApi=true) passes prefixed URL to onStartStreamingExport when app root is configured', async () => {
  const appRoot = '/superset';
  ensureAppRoot.mockImplementation((path: string) => `${appRoot}${path}`);

  getChartMetadataRegistry.mockReturnValue({
    get: jest.fn().mockReturnValue({ useLegacyApi: true, parseMethod: 'json' }),
  });

  const onStartStreamingExport = jest.fn();
  const legacyFormData = {
    datasource: '1__table',
    viz_type: 'legacy_viz',
  };

  await exportChart({
    formData: legacyFormData,
    resultFormat: 'csv',
    onStartStreamingExport: onStartStreamingExport as unknown as null,
  });

  expect(onStartStreamingExport).toHaveBeenCalledTimes(1);
  const callArgs = onStartStreamingExport.mock.calls[0][0];
  // post `Superset.route_base = ""`, the blueprint path is
  // `/explore_json/`. With appRoot=/superset, the prefixed URL is
  // `/superset/explore_json/?csv=true` — single-prefix, not the legacy
  // doubled `/superset/superset/explore_json/...` that this test used to
  // pin (which was the bug, now fixed at source).
  expect(callArgs.url).toBe('/superset/explore_json/?csv=true');
  expect(callArgs.exportType).toBe('csv');
});

test('exportChart legacy API builds relative URL for CSV export without app root', async () => {
  ensureAppRoot.mockImplementation((path: string) => path);

  getChartMetadataRegistry.mockReturnValue({
    get: jest.fn().mockReturnValue({ useLegacyApi: true, parseMethod: 'json' }),
  });

  const onStartStreamingExport = jest.fn();
  const legacyFormData = {
    datasource: '1__table',
    viz_type: 'world_map',
  };

  await exportChart({
    formData: legacyFormData,
    resultFormat: 'csv',
    onStartStreamingExport: onStartStreamingExport as unknown as null,
  });

  expect(onStartStreamingExport).toHaveBeenCalledTimes(1);
  const callArgs = onStartStreamingExport.mock.calls[0][0];
  expect(callArgs.url).toBe('/explore_json/?csv=true');
});

test('exportChart legacy API builds relative URL for xlsx export', async () => {
  ensureAppRoot.mockImplementation((path: string) => path);

  getChartMetadataRegistry.mockReturnValue({
    get: jest.fn().mockReturnValue({ useLegacyApi: true, parseMethod: 'json' }),
  });

  const onStartStreamingExport = jest.fn();
  const legacyFormData = {
    datasource: '1__table',
    viz_type: 'bubble',
  };

  await exportChart({
    formData: legacyFormData,
    resultFormat: 'xlsx',
    resultType: 'results',
    onStartStreamingExport: onStartStreamingExport as unknown as null,
  });

  expect(onStartStreamingExport).toHaveBeenCalledTimes(1);
  const callArgs = onStartStreamingExport.mock.calls[0][0];
  expect(callArgs.url).toBe('/explore_json/?xlsx=true');
});

test('exportChart legacy API calls postBlob with relative URL', async () => {
  const { SupersetClient } = jest.requireMock('@superset-ui/core');
  ensureAppRoot.mockImplementation((path: string) => path);
  SupersetClient.postBlob.mockResolvedValue(createMockExportResponse());

  getChartMetadataRegistry.mockReturnValue({
    get: jest.fn().mockReturnValue({ useLegacyApi: true, parseMethod: 'json' }),
  });

  const legacyFormData = {
    datasource: '1__table',
    viz_type: 'world_map',
  };

  await exportChart({
    formData: legacyFormData,
    resultFormat: 'csv',
    resultType: 'full',
  });

  expect(SupersetClient.postBlob).toHaveBeenCalledTimes(1);
  const [url] = SupersetClient.postBlob.mock.calls[0];
  expect(url).toBe('/explore_json/?csv=true');
  expect(url).not.toMatch(/^https?:\/\//);
  expect(downloadBlob).toHaveBeenCalled();
});

test('exportChart legacy API includes force param when force=true', async () => {
  ensureAppRoot.mockImplementation((path: string) => path);

  getChartMetadataRegistry.mockReturnValue({
    get: jest.fn().mockReturnValue({ useLegacyApi: true, parseMethod: 'json' }),
  });

  const onStartStreamingExport = jest.fn();
  const legacyFormData = {
    datasource: '1__table',
    viz_type: 'world_map',
  };

  await exportChart({
    formData: legacyFormData,
    resultFormat: 'csv',
    force: true,
    onStartStreamingExport: onStartStreamingExport as unknown as null,
  });

  expect(onStartStreamingExport).toHaveBeenCalledTimes(1);
  const callArgs = onStartStreamingExport.mock.calls[0][0];
  expect(callArgs.url).toBe('/explore_json/?force=true&csv=true');
});

test('exportChart successfully exports chart as CSV', async () => {
  const { SupersetClient } = jest.requireMock('@superset-ui/core');
  const mockResponse = createMockExportResponse();
  SupersetClient.postBlob.mockResolvedValue(mockResponse);

  await exportChart({
    formData: baseFormData,
    resultFormat: 'csv',
    resultType: 'full',
  });

  expect(SupersetClient.postBlob).toHaveBeenCalledTimes(1);
  expect(mockResponse.blob).toHaveBeenCalled();
  expect(downloadBlob).toHaveBeenCalledWith(
    mockBlob,
    expect.stringContaining('.csv'),
  );
});

test('exportChart successfully exports chart as Excel', async () => {
  const { SupersetClient } = jest.requireMock('@superset-ui/core');
  const mockResponse = createMockExportResponse();
  SupersetClient.postBlob.mockResolvedValue(mockResponse);

  await exportChart({
    formData: baseFormData,
    resultFormat: 'xlsx',
    resultType: 'results',
  });

  expect(SupersetClient.postBlob).toHaveBeenCalledTimes(1);
  expect(mockResponse.blob).toHaveBeenCalled();
  expect(downloadBlob).toHaveBeenCalledWith(
    mockBlob,
    expect.stringContaining('.xlsx'),
  );
});

test('exportChart throws error with status 413 when payload is too large', async () => {
  const { SupersetClient } = jest.requireMock('@superset-ui/core');
  const mockErrorResponse = new Response('Payload Too Large', {
    status: 413,
    statusText: 'Payload Too Large',
  });
  SupersetClient.postBlob.mockRejectedValue(mockErrorResponse);

  await expect(
    exportChart({
      formData: baseFormData,
      resultFormat: 'csv',
    }),
  ).rejects.toMatchObject({
    status: 413,
    message: expect.stringContaining('413'),
  });

  expect(downloadBlob).not.toHaveBeenCalled();
});

test('exportChart throws error with status 500 for server errors', async () => {
  const { SupersetClient } = jest.requireMock('@superset-ui/core');
  const mockErrorResponse = new Response('Internal Server Error', {
    status: 500,
    statusText: 'Internal Server Error',
  });
  SupersetClient.postBlob.mockRejectedValue(mockErrorResponse);

  await expect(
    exportChart({
      formData: baseFormData,
      resultFormat: 'json',
    }),
  ).rejects.toMatchObject({
    status: 500,
    message: expect.stringContaining('500'),
  });

  expect(downloadBlob).not.toHaveBeenCalled();
});

test('exportChart enhances errors without status property', async () => {
  const { SupersetClient } = jest.requireMock('@superset-ui/core');
  const genericError = new Error('Network error');
  SupersetClient.postBlob.mockRejectedValue(genericError);

  await expect(
    exportChart({
      formData: baseFormData,
      resultFormat: 'csv',
    }),
  ).rejects.toMatchObject({
    status: 500,
    message: expect.stringContaining('Network error'),
  });

  expect(downloadBlob).not.toHaveBeenCalled();
});

test('exportChart uses streaming export when onStartStreamingExport is provided', async () => {
  const { SupersetClient } = jest.requireMock('@superset-ui/core');
  const mockStreamingHandler = jest.fn();

  await exportChart({
    formData: baseFormData,
    resultFormat: 'csv',
    onStartStreamingExport: mockStreamingHandler as unknown as null,
  });

  expect(mockStreamingHandler).toHaveBeenCalledTimes(1);
  expect(mockStreamingHandler).toHaveBeenCalledWith(
    expect.objectContaining({
      url: '/api/v1/chart/data',
      exportType: 'csv',
    }),
  );
  expect(SupersetClient.postBlob).not.toHaveBeenCalled();
  expect(downloadBlob).not.toHaveBeenCalled();
});

test('exportChart generates correct filename with timestamp', async () => {
  const { SupersetClient } = jest.requireMock('@superset-ui/core');
  const mockResponse = createMockExportResponse();
  SupersetClient.postBlob.mockResolvedValue(mockResponse);

  const mockDate = new Date('2025-01-14T12:34:56.789Z');
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

  await exportChart({
    formData: baseFormData,
    resultFormat: 'csv',
  });

  expect(downloadBlob).toHaveBeenCalledWith(
    mockBlob,
    expect.stringMatching(
      /^chart_export_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/,
    ),
  );

  jest.spyOn(global, 'Date').mockRestore();
});

test('exportChart uses filename from Content-Disposition header', async () => {
  const { SupersetClient } = jest.requireMock('@superset-ui/core');
  const mockResponse = createMockExportResponse(
    new Headers({
      'Content-Disposition': 'attachment; filename="export.zip"',
    }),
  );
  SupersetClient.postBlob.mockResolvedValue(mockResponse);

  await exportChart({
    formData: baseFormData,
    resultFormat: 'csv',
  });

  expect(downloadBlob).toHaveBeenCalledWith(mockBlob, 'export.zip');
});

test('exportChart uses zip extension when Content-Type is application/zip', async () => {
  const { SupersetClient } = jest.requireMock('@superset-ui/core');
  const mockDate = new Date('2025-01-14T12:34:56.789Z');
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

  const mockResponse = createMockExportResponse(
    new Headers({
      'Content-Type': 'application/zip',
    }),
  );
  SupersetClient.postBlob.mockResolvedValue(mockResponse);

  await exportChart({
    formData: baseFormData,
    resultFormat: 'csv',
  });

  expect(downloadBlob).toHaveBeenCalledWith(
    mockBlob,
    'chart_export_2025-01-14T12-34-56.zip',
  );

  jest.spyOn(global, 'Date').mockRestore();
});
