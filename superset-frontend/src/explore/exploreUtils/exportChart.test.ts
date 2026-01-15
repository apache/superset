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

// Mock pathUtils to control app root prefix
jest.mock('src/utils/pathUtils', () => ({
  ensureAppRoot: jest.fn((path: string) => path),
}));

// Mock SupersetClient
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
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

// Tests for exportChart URL prefix handling in streaming export
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

test('exportChart legacy API (useLegacyApi=true) passes prefixed URL with app root configured', async () => {
  // Legacy API uses getExploreUrl() -> getURIDirectory() -> ensureAppRoot()
  const appRoot = '/superset';
  ensureAppRoot.mockImplementation((path: string) => `${appRoot}${path}`);

  // Configure mock to return useLegacyApi: true
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
  // Legacy path uses getURIDirectory which calls ensureAppRoot
  expect(callArgs.url).toContain(appRoot);
  expect(callArgs.exportType).toBe('csv');
});
