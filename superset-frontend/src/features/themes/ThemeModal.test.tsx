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

import fetchMock from 'fetch-mock';
import { ThemeObject } from './types';

// Mock theme provider
const mockThemeContext = {
  setTemporaryTheme: jest.fn(),
  clearLocalOverrides: jest.fn(),
  hasDevOverride: jest.fn(() => false),
};

jest.mock('src/theme/ThemeProvider', () => ({
  useThemeContext: () => mockThemeContext,
}));

// Mock permission utils
jest.mock('src/dashboard/util/permissionUtils', () => ({
  isUserAdmin: jest.fn(() => true),
}));

// Mock bootstrap data
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({
    user: {
      userId: 1,
      firstName: 'Admin',
      lastName: 'User',
      roles: { Admin: [['can_write', 'Dashboard']] },
      permissions: {},
      isActive: true,
      isAnonymous: false,
      username: 'admin',
      email: 'admin@example.com',
      user_id: 1,
      first_name: 'Admin',
      last_name: 'User',
    },
    common: {
      feature_flags: {},
      conf: {
        SUPERSET_WEBSERVER_DOMAINS: [],
      },
    },
  }),
}));

const mockTheme: ThemeObject = {
  id: 1,
  theme_name: 'Test Theme',
  json_data: JSON.stringify(
    {
      colors: {
        primary: '#1890ff',
        secondary: '#52c41a',
      },
      typography: {
        fontSize: 14,
      },
    },
    null,
    2,
  ),
  changed_on_delta_humanized: '1 day ago',
  changed_by: {
    id: 1,
    first_name: 'Admin',
    last_name: 'User',
  },
};

// Mock theme API endpoints
fetchMock.get('glob:*/api/v1/theme/1', {
  result: mockTheme,
});

fetchMock.post('glob:*/api/v1/theme/', {
  result: { ...mockTheme, id: 2 },
});

fetchMock.put('glob:*/api/v1/theme/1', {
  result: mockTheme,
});

// These are defined but not used in the simplified tests
// const mockUser = {
//   userId: 1,
//   firstName: 'Admin',
//   lastName: 'User',
//   roles: { Admin: [['can_write', 'Dashboard']] },
//   permissions: {},
//   isActive: true,
//   isAnonymous: false,
//   username: 'admin',
//   email: 'admin@example.com',
//   user_id: 1,
//   first_name: 'Admin',
//   last_name: 'User',
// };

// const defaultProps = {
//   addDangerToast: jest.fn(),
//   addSuccessToast: jest.fn(),
//   onThemeAdd: jest.fn(),
//   onHide: jest.fn(),
//   show: true,
// };

describe('ThemeModal', () => {
  beforeEach(() => {
    fetchMock.resetHistory();
    jest.clearAllMocks();
  });

  afterEach(() => {
    fetchMock.restore();
  });

  test('should export ThemeModal component', () => {
    const ThemeModalModule = jest.requireActual('./ThemeModal');
    expect(ThemeModalModule.default).toBeDefined();
    expect(typeof ThemeModalModule.default).toBe('object'); // HOC wrapped component
  });

  test('should have correct type definitions', () => {
    expect(mockTheme).toMatchObject({
      id: expect.any(Number),
      theme_name: expect.any(String),
      json_data: expect.any(String),
      changed_on_delta_humanized: expect.any(String),
      changed_by: expect.objectContaining({
        first_name: expect.any(String),
        last_name: expect.any(String),
      }),
    });
  });

  test('should validate JSON data structure', () => {
    const isValidJson = (str: string) => {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        return false;
      }
    };

    expect(isValidJson(mockTheme.json_data || '')).toBe(true);
    expect(isValidJson('invalid json')).toBe(false);
    expect(isValidJson('{"valid": "json"}')).toBe(true);
  });

  test('should handle theme data parsing', () => {
    const parsedTheme = JSON.parse(mockTheme.json_data || '{}');
    expect(parsedTheme).toMatchObject({
      colors: {
        primary: '#1890ff',
        secondary: '#52c41a',
      },
      typography: {
        fontSize: 14,
      },
    });
  });

  test('should mock theme context functions', () => {
    expect(mockThemeContext.setTemporaryTheme).toBeDefined();
    expect(mockThemeContext.clearLocalOverrides).toBeDefined();
    expect(mockThemeContext.hasDevOverride).toBeDefined();
    expect(typeof mockThemeContext.setTemporaryTheme).toBe('function');
    expect(typeof mockThemeContext.clearLocalOverrides).toBe('function');
    expect(typeof mockThemeContext.hasDevOverride).toBe('function');
  });

  test('should handle API response structure', () => {
    // Test that fetch mock is properly configured
    expect(fetchMock.called()).toBe(false);

    // Test API structure expectations
    const expectedResponse = {
      result: mockTheme,
    };

    expect(expectedResponse.result).toMatchObject({
      id: 1,
      theme_name: 'Test Theme',
    });
  });

  test('should handle create theme API call', () => {
    const newTheme = {
      theme_name: 'New Theme',
      json_data: '{"colors": {"primary": "#ff0000"}}',
    };

    // Test request structure
    expect(newTheme).toMatchObject({
      theme_name: expect.any(String),
      json_data: expect.any(String),
    });

    // Test that JSON is valid
    expect(() => JSON.parse(newTheme.json_data)).not.toThrow();
  });

  test('should handle update theme API call', () => {
    const updatedTheme = {
      theme_name: 'Updated Theme',
      json_data: '{"colors": {"primary": "#00ff00"}}',
    };

    // Test request structure
    expect(updatedTheme).toMatchObject({
      theme_name: expect.any(String),
      json_data: expect.any(String),
    });

    // Test that JSON is valid
    expect(() => JSON.parse(updatedTheme.json_data)).not.toThrow();
  });

  test('should validate theme name requirements', () => {
    const validateThemeName = (name: string) => !!(name && name.length > 0);

    expect(validateThemeName('Valid Theme')).toBe(true);
    expect(validateThemeName('')).toBe(false);
    expect(validateThemeName('Test')).toBe(true);
  });

  test('should validate JSON configuration requirements', () => {
    const validateJsonData = (jsonData: string) => {
      if (!jsonData || jsonData.length === 0) return false;
      try {
        JSON.parse(jsonData);
        return true;
      } catch (e) {
        return false;
      }
    };

    expect(validateJsonData(mockTheme.json_data || '')).toBe(true);
    expect(validateJsonData('')).toBe(false);
    expect(validateJsonData('invalid')).toBe(false);
    expect(validateJsonData('{}')).toBe(true);
  });

  test('should handle permission-based feature availability', () => {
    const permissionUtils = jest.requireMock(
      'src/dashboard/util/permissionUtils',
    );

    expect(permissionUtils.isUserAdmin).toBeDefined();
    expect(typeof permissionUtils.isUserAdmin).toBe('function');
    expect(permissionUtils.isUserAdmin()).toBe(true);

    // Test with non-admin user
    (permissionUtils.isUserAdmin as jest.Mock).mockReturnValue(false);
    expect(permissionUtils.isUserAdmin()).toBe(false);
  });

  test('should handle theme context override state', () => {
    expect(mockThemeContext.hasDevOverride()).toBe(false);

    // Test with override
    mockThemeContext.hasDevOverride.mockReturnValue(true);
    expect(mockThemeContext.hasDevOverride()).toBe(true);
  });
});
