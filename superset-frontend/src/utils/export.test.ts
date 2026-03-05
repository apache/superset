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
import { logging } from '@apache-superset/core';
import contentDisposition from 'content-disposition';
import handleResourceExport from './export';
import { Mock } from 'vitest';

// Mock dependencies
vi.mock('@superset-ui/core', async (importActual) => ({
  SupersetClient: {
    get: vi.fn(),
  },
}));

vi.mock('@apache-superset/core', () => ({
  logging: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('content-disposition');

const { ensureAppRootMock } = vi.hoisted(() => ({
  ensureAppRootMock: vi.fn((path: string) => path),
}));

// Default no-op mock for pathUtils; specific tests customize ensureAppRoot to simulate app root prefixing
vi.mock('./pathUtils', () => ({
  ensureAppRoot: ensureAppRootMock,
}));

let mockBlob: Blob;
let mockResponse: Response;
let createElementSpy: Mock;
let createObjectURLSpy: Mock;
let revokeObjectURLSpy: Mock;

beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();

  // Mock Blob
  mockBlob = new Blob(['test data'], { type: 'application/zip' });

  // Mock Response with Headers
  mockResponse = {
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="dashboard_export.zip"',
    }),
    blob: vi.fn().mockResolvedValue(mockBlob),
  } as unknown as Response;

  // Mock SupersetClient.get
  (SupersetClient.get as Mock).mockResolvedValue(mockResponse);

  // Mock DOM APIs
  const mockAnchor = document.createElement('a');
  mockAnchor.click = vi.fn();
  createElementSpy = vi
    .spyOn(document, 'createElement')
    .mockReturnValue(mockAnchor);
  vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
  vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);

  // Mock URL.createObjectURL and revokeObjectURL
  createObjectURLSpy = vi
    .spyOn(window.URL, 'createObjectURL')
    .mockReturnValue('blob:mock-url');

  // Create revokeObjectURL if it doesn't exist
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = vi.fn();
  }
  revokeObjectURLSpy = vi.spyOn(window.URL, 'revokeObjectURL');
});

afterEach(() => {
  createElementSpy.mockRestore();
  createObjectURLSpy.mockRestore();
  if (revokeObjectURLSpy) {
    revokeObjectURLSpy.mockRestore();
  }
});

test('exports resource with correct endpoint and headers', async () => {
  const doneMock = vi.fn();
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
  const doneMock = vi.fn();
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
  const doneMock = vi.fn();
  await handleResourceExport('dashboard', [1], doneMock);

  expect(doneMock).toHaveBeenCalled();
});

test('uses default filename when Content-Disposition is missing', async () => {
  mockResponse = {
    headers: new Headers(),
    blob: vi.fn().mockResolvedValue(mockBlob),
  } as unknown as Response;
  (SupersetClient.get as Mock).mockResolvedValue(mockResponse);

  const doneMock = vi.fn();
  await handleResourceExport('chart', [42], doneMock);

  const anchor = document.createElement('a');
  expect(anchor.download).toBe('chart_export.zip');
});

test('handles Content-Disposition parsing errors gracefully', async () => {
  (contentDisposition.parse as Mock).mockImplementationOnce(() => {
    throw new Error('Invalid header');
  });

  const doneMock = vi.fn();
  await handleResourceExport('dashboard', [1], doneMock);

  // Should fall back to default filename
  const anchor = document.createElement('a');
  expect(anchor.download).toBe('dashboard_export.zip');
  expect(doneMock).toHaveBeenCalled();
});

test('handles API errors and calls done callback', async () => {
  const apiError = new Error('API Error');
  (SupersetClient.get as Mock).mockRejectedValue(apiError);

  const doneMock = vi.fn();

  await expect(
    handleResourceExport('dashboard', [1], doneMock),
  ).rejects.toThrow('API Error');

  expect(doneMock).toHaveBeenCalled();
});

test('handles blob conversion errors', async () => {
  const blobError = new Error('Blob conversion failed');
  mockResponse.blob = vi.fn().mockRejectedValue(blobError);
  (SupersetClient.get as Mock).mockResolvedValue(mockResponse);

  const doneMock = vi.fn();

  await expect(
    handleResourceExport('dashboard', [1], doneMock),
  ).rejects.toThrow('Blob conversion failed');

  expect(doneMock).toHaveBeenCalled();
});

test('exports multiple resources with correct IDs', async () => {
  const doneMock = vi.fn();
  await handleResourceExport('dataset', [10, 20, 30, 40], doneMock);

  expect(SupersetClient.get).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: '/api/v1/dataset/export/?q=!(10,20,30,40)',
    }),
  );
});

test('parses filename from Content-Disposition with quotes', async () => {
  (contentDisposition.parse as Mock).mockReturnValueOnce({
    type: 'attachment',
    parameters: { filename: 'my_custom_export.zip' },
  });

  const doneMock = vi.fn();
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
    blob: vi.fn().mockResolvedValue(mockBlob),
  } as unknown as Response;
  (SupersetClient.get as Mock).mockResolvedValue(mockResponse);

  const doneMock = vi.fn();
  await handleResourceExport('dashboard', [1], doneMock);

  expect(logging.warn).toHaveBeenCalledWith(
    expect.stringContaining('exceeds maximum blob size'),
  );
  expect(doneMock).toHaveBeenCalled();
});

test('handles various resource types', async () => {
  const doneMock = vi.fn();

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
  (SupersetClient.get as Mock).mockRejectedValue(networkError);

  const doneMock = vi.fn();

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
  (SupersetClient.get as Mock).mockRejectedValue(notFoundError);

  const doneMock = vi.fn();

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
    blob: vi.fn().mockResolvedValue(emptyBlob),
  } as unknown as Response;
  (SupersetClient.get as Mock).mockResolvedValue(mockResponse);

  const doneMock = vi.fn();
  await handleResourceExport('dashboard', [1], doneMock);

  expect(window.URL.createObjectURL).toHaveBeenCalledWith(emptyBlob);
  expect(doneMock).toHaveBeenCalled();
});

test('cleans up blob URL even when download fails', async () => {
  const mockAnchor = document.createElement('a');
  mockAnchor.click = vi.fn().mockImplementation(() => {
    throw new Error('Click failed');
  });

  createElementSpy.mockRestore();
  createElementSpy = vi
    .spyOn(document, 'createElement')
    .mockReturnValue(mockAnchor);

  const doneMock = vi.fn();

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
    blob: vi.fn().mockResolvedValue(mockBlob),
  } as unknown as Response;
  (SupersetClient.get as Mock).mockResolvedValue(mockResponse);

  (contentDisposition.parse as Mock).mockImplementationOnce(() => {
    throw new Error('Parse error');
  });

  const doneMock = vi.fn();
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
    blob: vi.fn().mockResolvedValue(mockBlob),
  } as unknown as Response;
  (SupersetClient.get as Mock).mockResolvedValue(mockResponse);

  const doneMock = vi.fn();
  await handleResourceExport('chart', [7], doneMock);

  const anchor = document.createElement('a');
  expect(anchor.download).toBe('chart_export.zip');
  expect(doneMock).toHaveBeenCalled();
});

test('handles export with empty IDs array', async () => {
  const doneMock = vi.fn();
  await handleResourceExport('dashboard', [], doneMock);

  expect(SupersetClient.get).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: '/api/v1/dashboard/export/?q=!()',
    }),
  );
});

const doublePrefixTestCases = [
  {
    name: 'subdirectory prefix',
    appRoot: '/superset',
    resource: 'dashboard',
    ids: [1],
  },
  {
    name: 'subdirectory prefix (dataset)',
    appRoot: '/superset',
    resource: 'dataset',
    ids: [1],
  },
  {
    name: 'nested prefix',
    appRoot: '/my-app/superset',
    resource: 'dataset',
    ids: [1, 2],
  },
];

test.each(doublePrefixTestCases)(
  'handleResourceExport endpoint should not include app prefix: $name',
  async ({ appRoot, resource, ids }) => {
    // Simulate real ensureAppRoot behavior: prepend the appRoot
    ensureAppRootMock.mockImplementation((path: string) => `${appRoot}${path}`);

    const doneMock = vi.fn();
    await handleResourceExport(resource, ids, doneMock);

    // The endpoint passed to SupersetClient.get should NOT have the appRoot prefix
    // because SupersetClient.getUrl() adds it when building the full URL.
    const expectedEndpoint = `/api/v1/${resource}/export/?q=!(${ids.join(',')})`;

    // Explicitly verify no prefix in endpoint - this will fail if ensureAppRoot is used
    const callArgs = (SupersetClient.get as Mock).mock.calls.slice(-1)[0][0];
    expect(callArgs.endpoint).not.toContain(appRoot);
    expect(callArgs.endpoint).toBe(expectedEndpoint);

    // Reset mock for next test
    ensureAppRootMock.mockImplementation((path: string) => path);
  },
);
