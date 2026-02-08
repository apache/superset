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

import { SandboxedExtensionHostImpl } from './SandboxedExtensionHost';

// Mock logging
jest.mock('@apache-superset/core', () => ({
  logging: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Redux store
const mockStore = {
  getState: jest.fn(),
};

beforeEach(() => {
  (window as unknown as { __REDUX_STORE__: typeof mockStore }).__REDUX_STORE__ =
    mockStore;
});

afterEach(() => {
  jest.clearAllMocks();
  delete (window as unknown as { __REDUX_STORE__?: typeof mockStore })
    .__REDUX_STORE__;
});

describe('SandboxedExtensionHostImpl', () => {
  test('hasPermission returns true for granted permissions', () => {
    const host = new SandboxedExtensionHostImpl('test-extension', [
      'sqllab:read',
      'notification:show',
    ]);

    expect(host.hasPermission('sqllab:read')).toBe(true);
    expect(host.hasPermission('notification:show')).toBe(true);
  });

  test('hasPermission returns false for denied permissions', () => {
    const host = new SandboxedExtensionHostImpl('test-extension', [
      'sqllab:read',
    ]);

    expect(host.hasPermission('sqllab:execute')).toBe(false);
    expect(host.hasPermission('dashboard:write')).toBe(false);
  });

  test('handleApiCall rejects when permission denied', async () => {
    const host = new SandboxedExtensionHostImpl('test-extension', []);

    await expect(
      host.handleApiCall('sqlLab.getCurrentTab', []),
    ).rejects.toEqual({
      code: 'PERMISSION_DENIED',
      message: "Permission 'sqllab:read' required for 'sqlLab.getCurrentTab'",
    });
  });

  test('handleApiCall rejects for unknown namespace', async () => {
    const host = new SandboxedExtensionHostImpl('test-extension', []);

    await expect(host.handleApiCall('unknown.method', [])).rejects.toEqual({
      code: 'METHOD_NOT_FOUND',
      message: 'Unknown API namespace: unknown',
    });
  });

  describe('sqlLab API', () => {
    test('getCurrentTab returns null when no state', async () => {
      mockStore.getState.mockReturnValue({});

      const host = new SandboxedExtensionHostImpl('test-extension', [
        'sqllab:read',
      ]);

      const result = await host.handleApiCall('sqlLab.getCurrentTab', []);
      expect(result).toBeNull();
    });

    test('getCurrentTab returns active tab', async () => {
      mockStore.getState.mockReturnValue({
        sqlLab: {
          queryEditors: [
            {
              id: 'tab-1',
              title: 'Test Query',
              dbId: 1,
              catalog: 'main',
              schema: 'public',
              sql: 'SELECT 1',
            },
          ],
          tabHistory: ['tab-1'],
        },
      });

      const host = new SandboxedExtensionHostImpl('test-extension', [
        'sqllab:read',
      ]);

      const result = await host.handleApiCall('sqlLab.getCurrentTab', []);
      expect(result).toEqual({
        id: 'tab-1',
        title: 'Test Query',
        databaseId: 1,
        catalog: 'main',
        schema: 'public',
        sql: 'SELECT 1',
      });
    });

    test('getQueryResults rejects without queryId', async () => {
      const host = new SandboxedExtensionHostImpl('test-extension', [
        'sqllab:read',
      ]);

      await expect(host.handleApiCall('sqlLab.getQueryResults', [])).rejects.toEqual({
        code: 'INVALID_ARGUMENT',
        message: 'Query ID is required',
      });
    });
  });

  describe('user API', () => {
    test('getCurrentUser returns user info', async () => {
      mockStore.getState.mockReturnValue({
        user: {
          userId: 1,
          username: 'admin',
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@example.com',
          roles: { Admin: true },
        },
      });

      const host = new SandboxedExtensionHostImpl('test-extension', [
        'user:read',
      ]);

      const result = await host.handleApiCall('user.getCurrentUser', []);
      expect(result).toEqual({
        id: 1,
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        roles: ['Admin'],
      });
    });

    test('getCurrentUser rejects when no user', async () => {
      mockStore.getState.mockReturnValue({});

      const host = new SandboxedExtensionHostImpl('test-extension', [
        'user:read',
      ]);

      await expect(host.handleApiCall('user.getCurrentUser', [])).rejects.toEqual({
        code: 'NO_USER',
        message: 'No user information available',
      });
    });
  });

  describe('chart API', () => {
    test('getData rejects for non-number chartId', async () => {
      const host = new SandboxedExtensionHostImpl('test-extension', [
        'chart:read',
      ]);

      await expect(host.handleApiCall('chart.getData', ['not-a-number'])).rejects.toEqual({
        code: 'INVALID_ARGUMENT',
        message: 'Chart ID must be a number',
      });
    });

    test('getData returns chart data', async () => {
      mockStore.getState.mockReturnValue({
        charts: {
          123: {
            queriesResponse: [
              {
                data: [{ col1: 'value1' }],
                colnames: ['col1'],
              },
            ],
          },
        },
      });

      const host = new SandboxedExtensionHostImpl('test-extension', [
        'chart:read',
      ]);

      const result = await host.handleApiCall('chart.getData', [123]);
      expect(result).toEqual({
        chartId: 123,
        data: [{ col1: 'value1' }],
        columns: ['col1'],
      });
    });
  });

  describe('utils API', () => {
    test('getCSRFToken does not require permission', async () => {
      const host = new SandboxedExtensionHostImpl('test-extension', []);

      // Mock the meta tag
      document.head.innerHTML = '<meta name="csrf_token" content="test-token">';

      const result = await host.handleApiCall('utils.getCSRFToken', []);
      expect(result).toBe('test-token');

      document.head.innerHTML = '';
    });

    test('copyToClipboard requires permission', async () => {
      const host = new SandboxedExtensionHostImpl('test-extension', []);

      await expect(
        host.handleApiCall('utils.copyToClipboard', ['test']),
      ).rejects.toEqual({
        code: 'PERMISSION_DENIED',
        message:
          "Permission 'clipboard:write' required for 'utils.copyToClipboard'",
      });
    });
  });
});
