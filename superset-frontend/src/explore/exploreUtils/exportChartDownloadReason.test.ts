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
import { SupersetClient } from '@superset-ui/core';
import { exportChart } from '.';
import { requestDownloadReason } from 'src/utils/downloadReason';

jest.mock('src/utils/export', () => ({
  ...jest.requireActual('src/utils/export'),
  downloadBlob: jest.fn(),
}));

jest.mock('src/utils/pathUtils', () => ({
  ensureAppRoot: jest.fn((path: string) => path),
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    postBlob: jest.fn(),
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

// REQUIRE_DOWNLOAD_REASON on; the dialog is stubbed.
jest.mock('src/utils/downloadReason', () => ({
  ...jest.requireActual('src/utils/downloadReason'),
  isDownloadReasonRequired: () => true,
  requestDownloadReason: jest.fn(),
}));

const mockPostBlob = SupersetClient.postBlob as jest.Mock;
const mockRequestReason = requestDownloadReason as jest.Mock;

const formData = { datasource: '1__table', viz_type: 'table' };
const mockResponse = () => ({
  headers: new Headers(),
  blob: jest.fn().mockResolvedValue(new Blob(['x'])),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPostBlob.mockResolvedValue(mockResponse());
});

test('csv export asks for a reason and sends it as download_reason', async () => {
  mockRequestReason.mockResolvedValue('WP-1 audit');
  await exportChart({ formData, resultFormat: 'csv' });
  expect(mockRequestReason).toHaveBeenCalledTimes(1);
  expect(mockPostBlob).toHaveBeenCalledTimes(1);
  const [[url]] = mockPostBlob.mock.calls;
  expect(url).toBe('/api/v1/chart/data?download_reason=WP-1%20audit');
});

test('xlsx export is gated too', async () => {
  mockRequestReason.mockResolvedValue('r');
  await exportChart({ formData, resultFormat: 'xlsx' });
  expect(mockRequestReason).toHaveBeenCalledTimes(1);
  expect(mockPostBlob).toHaveBeenCalledTimes(1);
  const [[url]] = mockPostBlob.mock.calls;
  expect(url).toBe('/api/v1/chart/data?download_reason=r');
});

test('json export is not gated and never prompts', async () => {
  await exportChart({ formData, resultFormat: 'json' });
  expect(mockRequestReason).not.toHaveBeenCalled();
  expect(mockPostBlob).toHaveBeenCalledTimes(1);
  const [[url]] = mockPostBlob.mock.calls;
  expect(url).toBe('/api/v1/chart/data');
});

test('cancelling the dialog aborts the export', async () => {
  mockRequestReason.mockResolvedValue(null);
  await exportChart({ formData, resultFormat: 'csv' });
  expect(mockPostBlob).not.toHaveBeenCalled();
});
