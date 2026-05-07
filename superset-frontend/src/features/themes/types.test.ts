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

import { ThemeObject } from './types';

describe('Theme Types', () => {
  describe('ThemeObject', () => {
    it('should accept valid theme objects', () => {
      const validTheme: ThemeObject = {
        id: 1,
        theme_name: 'Test Theme',
        json_data: '{"token": {"colorPrimary": "#1890ff"}}',
        uuid: '123e4567-e89b-12d3-a456-426614174000',
        is_system: false,
        is_system_default: false,
        is_system_dark: false,
        changed_on_delta_humanized: '1 day ago',
        created_on: '2023-01-01T00:00:00Z',
        changed_by: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
        },
        created_by: {
          id: 2,
          first_name: 'Jane',
          last_name: 'Smith',
        },
      };

      // TypeScript will ensure this compiles
      expect(validTheme).toBeDefined();
      expect(validTheme.is_system).toBe(false);
      expect(validTheme.is_system_default).toBe(false);
      expect(validTheme.is_system_dark).toBe(false);
    });

    it('should handle optional fields', () => {
      const minimalTheme: ThemeObject = {
        theme_name: 'Minimal Theme',
        json_data: '{}',
      };

      // TypeScript allows optional fields
      expect(minimalTheme.id).toBeUndefined();
      expect(minimalTheme.is_system).toBeUndefined();
      expect(minimalTheme.is_system_default).toBeUndefined();
      expect(minimalTheme.is_system_dark).toBeUndefined();
    });

    it('should handle system theme fields correctly', () => {
      const systemTheme: ThemeObject = {
        id: 2,
        theme_name: 'System Theme',
        json_data: '{}',
        is_system: true,
        is_system_default: true,
        is_system_dark: false,
      };

      expect(systemTheme.is_system).toBe(true);
      expect(systemTheme.is_system_default).toBe(true);
      expect(systemTheme.is_system_dark).toBe(false);
    });

    it('should handle both system default and dark flags', () => {
      // This should not happen in practice (a theme shouldn't be both)
      // but the type allows it for flexibility
      const theme: ThemeObject = {
        id: 3,
        theme_name: 'Dual System Theme',
        json_data: '{}',
        is_system: true,
        is_system_default: true,
        is_system_dark: true,
      };

      expect(theme.is_system_default).toBe(true);
      expect(theme.is_system_dark).toBe(true);
    });
  });

  describe('Theme JSON Data', () => {
    it('should parse valid JSON data', () => {
      const theme: ThemeObject = {
        theme_name: 'Parse Test',
        json_data:
          '{"token": {"colorPrimary": "#1890ff", "colorSuccess": "#52c41a"}}',
      };

      const parsed = JSON.parse(theme.json_data!);
      expect(parsed.token.colorPrimary).toBe('#1890ff');
      expect(parsed.token.colorSuccess).toBe('#52c41a');
    });

    it('should handle empty JSON', () => {
      const theme: ThemeObject = {
        theme_name: 'Empty Theme',
        json_data: '{}',
      };

      const parsed = JSON.parse(theme.json_data!);
      expect(parsed).toEqual({});
    });
  });

  describe('Type Guards', () => {
    it('should identify system themes', () => {
      const isSystemTheme = (theme: ThemeObject): boolean =>
        theme.is_system === true;

      const systemTheme: ThemeObject = {
        theme_name: 'System',
        json_data: '{}',
        is_system: true,
      };

      const userTheme: ThemeObject = {
        theme_name: 'User',
        json_data: '{}',
        is_system: false,
      };

      expect(isSystemTheme(systemTheme)).toBe(true);
      expect(isSystemTheme(userTheme)).toBe(false);
    });

    it('should identify deletable themes', () => {
      const isDeletable = (theme: ThemeObject): boolean =>
        !theme.is_system && !theme.is_system_default && !theme.is_system_dark;

      const deletableTheme: ThemeObject = {
        theme_name: 'Deletable',
        json_data: '{}',
        is_system: false,
        is_system_default: false,
        is_system_dark: false,
      };

      const systemDefaultTheme: ThemeObject = {
        theme_name: 'System Default',
        json_data: '{}',
        is_system: false,
        is_system_default: true,
        is_system_dark: false,
      };

      expect(isDeletable(deletableTheme)).toBe(true);
      expect(isDeletable(systemDefaultTheme)).toBe(false);
    });
  });
});
