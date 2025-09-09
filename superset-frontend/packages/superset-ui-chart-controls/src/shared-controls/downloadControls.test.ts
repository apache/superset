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

// Mock required dependencies first
jest.mock('@superset-ui/core', () => ({
  t: (str: string) => str,
  ensureIsArray: jest.fn(),
}));

jest.mock('../utils', () => ({
  formatSelectOptions: jest.fn(),
}));

import sharedControls from './sharedControls';

describe('Download Controls', () => {
  const downloadControls = [
    'enable_export_csv',
    'enable_export_excel', 
    'enable_export_full_csv',
    'enable_export_full_excel',
    'enable_download_image',
  ];

  downloadControls.forEach(controlName => {
    describe(controlName, () => {
      const control = sharedControls[controlName];

      test('should exist in shared controls', () => {
        expect(control).toBeDefined();
      });

      test('should be a CheckboxControl', () => {
        expect(control.type).toBe('CheckboxControl');
      });

      test('should default to true', () => {
        expect(control.default).toBe(true);
      });

      test('should have renderTrigger enabled', () => {
        expect(control.renderTrigger).toBe(true);
      });

      test('should have proper label', () => {
        expect(control.label).toBeDefined();
        expect(typeof control.label).toBe('string');
      });

      test('should have descriptive text', () => {
        expect(control.description).toBeDefined();
        expect(typeof control.description).toBe('string');
        expect(control.description).toContain('download menu');
      });
    });
  });

  test('all download controls should be exported', () => {
    downloadControls.forEach(controlName => {
      expect(sharedControls).toHaveProperty(controlName);
    });
  });
});

describe('Menu Visibility Controls', () => {
  const menuControls = [
    'show_fullscreen_menu',
    'show_data_menu',
  ];

  menuControls.forEach(controlName => {
    describe(controlName, () => {
      const control = sharedControls[controlName];

      test('should exist in shared controls', () => {
        expect(control).toBeDefined();
      });

      test('should be a CheckboxControl', () => {
        expect(control.type).toBe('CheckboxControl');
      });

      test('should default to true', () => {
        expect(control.default).toBe(true);
      });

      test('should have renderTrigger enabled', () => {
        expect(control.renderTrigger).toBe(true);
      });
    });
  });
});
