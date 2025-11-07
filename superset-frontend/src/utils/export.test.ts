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
import { SupersetClient, logging } from '@superset-ui/core';
import contentDisposition from 'content-disposition';
import handleResourceExport from './export';

// Mock dependencies
jest.mock('@superset-ui/core', () => ({
  SupersetClient: {
    get: jest.fn(),
  },
  logging: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('content-disposition');

jest.mock('./pathUtils', () => ({
  ensureAppRoot: jest.fn((path: string) => path),
}));

let mockBlob: Blob;
let mockResponse: Response;
let createElementSpy: jest.SpyInstance;
let createObjectURLSpy: jest.SpyInstance;
let revokeObjectURLSpy: jest.SpyInstance;

beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks();

  // Mock Blob
  mockBlob = new Blob(['test data'], { type: 'application/zip' });

  // Mock Response with Headers
  mockResponse = {
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="dashboard_export.zip"',
    }),
    blob: jest.fn().mockResolvedValue(mockBlob),
  } as unknown as Response;

  // Mock SupersetClient.get
  (SupersetClient.get as jest.Mock).mockResolvedValue(mockResponse);

  // Mock DOM APIs
  const mockAnchor = document.createElement('a');
  mockAnchor.click = jest.fn();
  createElementSpy = jest
    .spyOn(document, 'createElement')
    .mockReturnValue(mockAnchor);
  jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
  jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);

  // Mock URL.createObjectURL and revokeObjectURL
  createObjectURLSpy = jest
    .spyOn(window.URL, 'createObjectURL')
    .mockReturnValue('blob:mock-url');

  // Create revokeObjectURL if it doesn't exist
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = jest.fn();
  }
  revokeObjectURLSpy = jest.spyOn(window.URL, 'revokeObjectURL');
});

afterEach(() => {
  createElementSpy.mockRestore();
  createObjectURLSpy.mockRestore();
  if (revokeObjectURLSpy) {
    revokeObjectURLSpy.mockRestore();
  }
});

test('exports resource with correct endpoint and headers', async () => {
  const doneMock = jest.fn();
  await handleResourceExport('dashboard', [1, 2, 3], doneMock);

  expect(SupersetClient.get).toHaveBeenCalledWith({
    endpoint: '/api/v1/dashboard/export/?q=!(1,2,3)',
    headers: {
      Accept: 'application/zip, application/x-zip-compressed, text/plain',
    },
    parseMethod: 'raw',
  });
});

test('creates blob and triggers download', async () => {
  const doneMock = jest.fn();
  await handleResourceExport('dashboard', [1], doneMock);

  // Check that blob was created
  expect(mockResponse.blob).toHaveBeenCalled();

  // Check that object URL was created
  expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);

  // Check that anchor element was created and configured
  expect(document.createElement).toHaveBeenCalledWith('a');
  const anchor = document.createElement('a');
  expect(anchor.href).toBe('blob:mock-url');
  expect(anchor.download).toBe('dashboard_export.zip');
  // eslint-disable-next-line jest-dom/prefer-to-have-style -- toHaveStyle not available without React Testing Library
  expect(anchor.style.display).toBe('none');

  // Check that click was triggered
  expect(anchor.click).toHaveBeenCalled();

  // Check cleanup
  expect(document.body.removeChild).toHaveBeenCalled();
  expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
});

test('calls done callback on success', async () => {
  const doneMock = jest.fn();
  await handleResourceExport('dashboard', [1], doneMock);

  expect(doneMock).toHaveBeenCalled();
});

test('uses default filename when Content-Disposition is missing', async () => {
  mockResponse = {
    headers: new Headers(),
    blob: jest.fn().mockResolvedValue(mockBlob),
  } as unknown as Response;
  (SupersetClient.get as jest.Mock).mockResolvedValue(mockResponse);

  const doneMock = jest.fn();
  await handleResourceExport('chart', [42], doneMock);

  const anchor = document.createElement('a');
  expect(anchor.download).toBe('chart_export.zip');
});

test('handles Content-Disposition parsing errors gracefully', async () => {
  (contentDisposition.parse as jest.Mock).mockImplementationOnce(() => {
    throw new Error('Invalid header');
  });

  const doneMock = jest.fn();
  await handleResourceExport('dashboard', [1], doneMock);

  // Should fall back to default filename
  const anchor = document.createElement('a');
  expect(anchor.download).toBe('dashboard_export.zip');
  expect(doneMock).toHaveBeenCalled();
});

test('handles API errors and calls done callback', async () => {
  const apiError = new Error('API Error');
  (SupersetClient.get as jest.Mock).mockRejectedValue(apiError);

  const doneMock = jest.fn();

  await expect(
    handleResourceExport('dashboard', [1], doneMock),
  ).rejects.toThrow('API Error');

  expect(doneMock).toHaveBeenCalled();
});

test('handles blob conversion errors', async () => {
  const blobError = new Error('Blob conversion failed');
  mockResponse.blob = jest.fn().mockRejectedValue(blobError);
  (SupersetClient.get as jest.Mock).mockResolvedValue(mockResponse);

  const doneMock = jest.fn();

  await expect(
    handleResourceExport('dashboard', [1], doneMock),
  ).rejects.toThrow('Blob conversion failed');

  expect(doneMock).toHaveBeenCalled();
});

test('exports multiple resources with correct IDs', async () => {
  const doneMock = jest.fn();
  await handleResourceExport('dataset', [10, 20, 30, 40], doneMock);

  expect(SupersetClient.get).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: '/api/v1/dataset/export/?q=!(10,20,30,40)',
    }),
  );
});

test('parses filename from Content-Disposition with quotes', async () => {
  (contentDisposition.parse as jest.Mock).mockReturnValueOnce({
    type: 'attachment',
    parameters: { filename: 'my_custom_export.zip' },
  });

  const doneMock = jest.fn();
  await handleResourceExport('dashboard', [1], doneMock);

  const anchor = document.createElement('a');
  expect(anchor.download).toBe('my_custom_export.zip');
});

test('warns when export exceeds maximum blob size', async () => {
  const largeFileSize = 150 * 1024 * 1024; // 150MB

  mockResponse = {
    headers: new Headers({
      'Content-Length': largeFileSize.toString(),
      'Content-Disposition': 'attachment; filename="large_export.zip"',
    }),
    blob: jest.fn().mockResolvedValue(mockBlob),
  } as unknown as Response;
  (SupersetClient.get as jest.Mock).mockResolvedValue(mockResponse);

  const doneMock = jest.fn();
  await handleResourceExport('dashboard', [1], doneMock);

  expect(logging.warn).toHaveBeenCalledWith(
    expect.stringContaining('exceeds maximum blob size'),
  );
  expect(doneMock).toHaveBeenCalled();
});

test('handles various resource types', async () => {
  const doneMock = jest.fn();

  await handleResourceExport('dashboard', [1], doneMock);
  expect(SupersetClient.get).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: '/api/v1/dashboard/export/?q=!(1)',
    }),
  );

  await handleResourceExport('chart', [1], doneMock);
  expect(SupersetClient.get).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: '/api/v1/chart/export/?q=!(1)',
    }),
  );

  await handleResourceExport('dataset', [1], doneMock);
  expect(SupersetClient.get).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: '/api/v1/dataset/export/?q=!(1)',
    }),
  );

  await handleResourceExport('database', [1], doneMock);
  expect(SupersetClient.get).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: '/api/v1/database/export/?q=!(1)',
    }),
  );

  await handleResourceExport('query', [1], doneMock);
  expect(SupersetClient.get).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: '/api/v1/query/export/?q=!(1)',
    }),
  );

  expect(doneMock).toHaveBeenCalledTimes(5);
});

test('handles network errors and logs them', async () => {
  const networkError = new Error('Network request failed');
  (SupersetClient.get as jest.Mock).mockRejectedValue(networkError);

  const doneMock = jest.fn();

  await expect(
    handleResourceExport('dashboard', [1], doneMock),
  ).rejects.toThrow('Network request failed');

  expect(logging.error).toHaveBeenCalledWith(
    'Resource export failed:',
    networkError,
  );
  expect(doneMock).toHaveBeenCalled();
});

test('handles 404 errors when resource not found', async () => {
  const notFoundError = new Error('Not found');
  (SupersetClient.get as jest.Mock).mockRejectedValue(notFoundError);

  const doneMock = jest.fn();

  await expect(
    handleResourceExport('dashboard', [999], doneMock),
  ).rejects.toThrow('Not found');

  expect(doneMock).toHaveBeenCalled();
});

test('handles empty response from server', async () => {
  const emptyBlob = new Blob([], { type: 'application/zip' });
  mockResponse = {
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="empty.zip"',
    }),
    blob: jest.fn().mockResolvedValue(emptyBlob),
  } as unknown as Response;
  (SupersetClient.get as jest.Mock).mockResolvedValue(mockResponse);

  const doneMock = jest.fn();
  await handleResourceExport('dashboard', [1], doneMock);

  expect(window.URL.createObjectURL).toHaveBeenCalledWith(emptyBlob);
  expect(doneMock).toHaveBeenCalled();
});

test('cleans up blob URL even when download fails', async () => {
  const mockAnchor = document.createElement('a');
  mockAnchor.click = jest.fn().mockImplementation(() => {
    throw new Error('Click failed');
  });

  createElementSpy.mockRestore();
  createElementSpy = jest
    .spyOn(document, 'createElement')
    .mockReturnValue(mockAnchor);

  const doneMock = jest.fn();

  await expect(
    handleResourceExport('dashboard', [1], doneMock),
  ).rejects.toThrow('Click failed');

  // Verify cleanup still happens
  expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  expect(doneMock).toHaveBeenCalled();
});

test('handles malformed Content-Disposition header', async () => {
  mockResponse = {
    headers: new Headers({
      'Content-Disposition': 'not-a-valid-header',
    }),
    blob: jest.fn().mockResolvedValue(mockBlob),
  } as unknown as Response;
  (SupersetClient.get as jest.Mock).mockResolvedValue(mockResponse);

  (contentDisposition.parse as jest.Mock).mockImplementationOnce(() => {
    throw new Error('Parse error');
  });

  const doneMock = jest.fn();
  await handleResourceExport('dataset', [5], doneMock);

  // Should fall back to default filename
  const anchor = document.createElement('a');
  expect(anchor.download).toBe('dataset_export.zip');
  expect(logging.warn).toHaveBeenCalledWith(
    'Failed to parse Content-Disposition header:',
    expect.any(Error),
  );
});

test('handles missing headers object', async () => {
  mockResponse = {
    headers: new Headers(),
    blob: jest.fn().mockResolvedValue(mockBlob),
  } as unknown as Response;
  (SupersetClient.get as jest.Mock).mockResolvedValue(mockResponse);

  const doneMock = jest.fn();
  await handleResourceExport('chart', [7], doneMock);

  const anchor = document.createElement('a');
  expect(anchor.download).toBe('chart_export.zip');
  expect(doneMock).toHaveBeenCalled();
});

test('handles export with empty IDs array', async () => {
  const doneMock = jest.fn();
  await handleResourceExport('dashboard', [], doneMock);

  expect(SupersetClient.get).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: '/api/v1/dashboard/export/?q=!()',
    }),
  );
});
