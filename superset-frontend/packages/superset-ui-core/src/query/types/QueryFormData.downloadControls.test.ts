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

import { QueryFormData } from './QueryFormData';

describe('QueryFormData Download Controls', () => {
  describe('Type compatibility', () => {
    test('should accept valid download control properties', () => {
      const formData: QueryFormData = {
        datasource: '1__table',
        viz_type: 'table',
        enable_export_csv: true,
        enable_export_excel: false,
        enable_export_full_csv: true,
        enable_export_full_excel: false,
        enable_download_image: true,
      };

      expect(formData.enable_export_csv).toBe(true);
      expect(formData.enable_export_excel).toBe(false);
      expect(formData.enable_export_full_csv).toBe(true);
      expect(formData.enable_export_full_excel).toBe(false);
      expect(formData.enable_download_image).toBe(true);
    });

    test('should accept undefined download control properties', () => {
      const formData: QueryFormData = {
        datasource: '1__table',
        viz_type: 'table',
        // All download controls are optional
      };

      expect(formData.enable_export_csv).toBeUndefined();
      expect(formData.enable_export_excel).toBeUndefined();
      expect(formData.enable_export_full_csv).toBeUndefined();
      expect(formData.enable_export_full_excel).toBeUndefined();
      expect(formData.enable_download_image).toBeUndefined();
    });

    test('should work with existing menu visibility controls', () => {
      const formData: QueryFormData = {
        datasource: '1__table',
        viz_type: 'table',
        show_fullscreen_menu: false,
        show_data_menu: true,
        enable_export_csv: true,
        enable_download_image: false,
      };

      expect(formData.show_fullscreen_menu).toBe(false);
      expect(formData.show_data_menu).toBe(true);
      expect(formData.enable_export_csv).toBe(true);
      expect(formData.enable_download_image).toBe(false);
    });
  });

  describe('Property validation', () => {
    test('download controls should be optional booleans', () => {
      const formData: Partial<QueryFormData> = {};
      
      // These should all be valid assignments
      formData.enable_export_csv = true;
      formData.enable_export_csv = false;
      formData.enable_export_csv = undefined;

      formData.enable_export_excel = true;
      formData.enable_export_excel = false;
      formData.enable_export_excel = undefined;

      formData.enable_export_full_csv = true;
      formData.enable_export_full_csv = false;
      formData.enable_export_full_csv = undefined;

      formData.enable_export_full_excel = true;
      formData.enable_export_full_excel = false;
      formData.enable_export_full_excel = undefined;

      formData.enable_download_image = true;
      formData.enable_download_image = false;
      formData.enable_download_image = undefined;

      expect(true).toBe(true); // If we reach here, TypeScript compilation succeeded
    });
  });

  describe('Default behavior simulation', () => {
    test('should simulate default true behavior', () => {
      const formData: QueryFormData = {
        datasource: '1__table',
        viz_type: 'table',
      };

      // Simulate default behavior (undefined should be treated as true)
      const isExportCsvEnabled = formData.enable_export_csv !== false;
      const isExportExcelEnabled = formData.enable_export_excel !== false;
      const isExportFullCsvEnabled = formData.enable_export_full_csv !== false;
      const isExportFullExcelEnabled = formData.enable_export_full_excel !== false;
      const isDownloadImageEnabled = formData.enable_download_image !== false;

      expect(isExportCsvEnabled).toBe(true);
      expect(isExportExcelEnabled).toBe(true);
      expect(isExportFullCsvEnabled).toBe(true);
      expect(isExportFullExcelEnabled).toBe(true);
      expect(isDownloadImageEnabled).toBe(true);
    });

    test('should respect explicit false values', () => {
      const formData: QueryFormData = {
        datasource: '1__table',
        viz_type: 'table',
        enable_export_csv: false,
        enable_export_excel: false,
        enable_export_full_csv: false,
        enable_export_full_excel: false,
        enable_download_image: false,
      };

      const isExportCsvEnabled = formData.enable_export_csv !== false;
      const isExportExcelEnabled = formData.enable_export_excel !== false;
      const isExportFullCsvEnabled = formData.enable_export_full_csv !== false;
      const isExportFullExcelEnabled = formData.enable_export_full_excel !== false;
      const isDownloadImageEnabled = formData.enable_download_image !== false;

      expect(isExportCsvEnabled).toBe(false);
      expect(isExportExcelEnabled).toBe(false);
      expect(isExportFullCsvEnabled).toBe(false);
      expect(isExportFullExcelEnabled).toBe(false);
      expect(isDownloadImageEnabled).toBe(false);
    });
  });
});
