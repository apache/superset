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

const { ensureAppRootMock, getChartMetadataRegistryMock } = vi.hoisted(() => ({
  ensureAppRootMock: vi.fn((path: string) => path),
  getChartMetadataRegistryMock: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(() => () => ({})),
  }),
}));

// Mock pathUtils to control app root prefix
vi.mock('src/utils/pathUtils', () => ({
  ensureAppRoot: ensureAppRootMock,
}));

// Mock SupersetClient
vi.mock('@superset-ui/core', async importActual => ({
  ...(await importActual()),
  SupersetClient: {
    postForm: vi.fn(),
    get: vi.fn().mockResolvedValue({ json: {} }),
    post: vi.fn().mockResolvedValue({ json: {} }),
  },
  getChartBuildQueryRegistry: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(() => () => ({})),
  }),
  getChartMetadataRegistry: getChartMetadataRegistryMock,
}));

// Minimal formData that won't trigger legacy API (useLegacyApi = false)
const baseFormData = {
  datasource: '1__table',
  viz_type: 'table',
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no prefix
  ensureAppRootMock.mockImplementation((path: string) => path);
  // Default: v1 API (not legacy)
  getChartMetadataRegistryMock.mockReturnValue({
    get: vi.fn().mockReturnValue({ parseMethod: 'json' }),
  });
});

// Tests for exportChart URL prefix handling in streaming export
test('exportChart v1 API passes prefixed URL to onStartStreamingExport when app root is configured', async () => {
  const appRoot = '/superset';
  ensureAppRootMock.mockImplementation((path: string) => `${appRoot}${path}`);

  const onStartStreamingExport = vi.fn();

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
  ensureAppRootMock.mockImplementation((path: string) => path);

  const onStartStreamingExport = vi.fn();

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
  ensureAppRootMock.mockImplementation((path: string) => `${appRoot}${path}`);

  const onStartStreamingExport = vi.fn();

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

test('exportChart passes csv exportType for CSV exports', async () => {
  const onStartStreamingExport = vi.fn();

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
  const onStartStreamingExport = vi.fn();

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

test('exportChart legacy API (useLegacyApi=true) passes prefixed URL with app root configured', async () => {
  // Legacy API uses getExploreUrl() -> getURIDirectory() -> ensureAppRoot()
  const appRoot = '/superset';
  ensureAppRootMock.mockImplementation((path: string) => `${appRoot}${path}`);

  // Configure mock to return useLegacyApi: true
  getChartMetadataRegistryMock.mockReturnValue({
    get: vi.fn().mockReturnValue({ useLegacyApi: true, parseMethod: 'json' }),
  });

  const onStartStreamingExport = vi.fn();
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
  // Legacy path uses getURIDirectory which calls ensureAppRoot
  expect(callArgs.url).toContain(appRoot);
  expect(callArgs.exportType).toBe('csv');
});
