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
import { ModuleRegistry, type Module } from 'ag-grid-community';
import { setupAGGridModules, defaultModules } from './setupAGGridModules';

jest.mock('ag-grid-community', () => ({
  ModuleRegistry: {
    registerModules: jest.fn(),
  },
  ColumnAutoSizeModule: { moduleName: 'ColumnAutoSizeModule' },
  ColumnHoverModule: { moduleName: 'ColumnHoverModule' },
  RowAutoHeightModule: { moduleName: 'RowAutoHeightModule' },
  RowStyleModule: { moduleName: 'RowStyleModule' },
  PaginationModule: { moduleName: 'PaginationModule' },
  CellStyleModule: { moduleName: 'CellStyleModule' },
  TextFilterModule: { moduleName: 'TextFilterModule' },
  NumberFilterModule: { moduleName: 'NumberFilterModule' },
  DateFilterModule: { moduleName: 'DateFilterModule' },
  ExternalFilterModule: { moduleName: 'ExternalFilterModule' },
  CsvExportModule: { moduleName: 'CsvExportModule' },
  ColumnApiModule: { moduleName: 'ColumnApiModule' },
  RowApiModule: { moduleName: 'RowApiModule' },
  CellApiModule: { moduleName: 'CellApiModule' },
  RenderApiModule: { moduleName: 'RenderApiModule' },
  ClientSideRowModelModule: { moduleName: 'ClientSideRowModelModule' },
  CustomFilterModule: { moduleName: 'CustomFilterModule' },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('defaultModules exports an array of AG Grid modules', () => {
  expect(Array.isArray(defaultModules)).toBe(true);
  expect(defaultModules.length).toBeGreaterThan(0);

  // Verify it contains expected modules
  const moduleNames = defaultModules.map((m: any) => m.moduleName);
  expect(moduleNames).toContain('ColumnAutoSizeModule');
  expect(moduleNames).toContain('PaginationModule');
  expect(moduleNames).toContain('ClientSideRowModelModule');
});

test('setupAGGridModules registers default modules when called without arguments', () => {
  setupAGGridModules();

  expect(ModuleRegistry.registerModules).toHaveBeenCalledTimes(1);
  expect(ModuleRegistry.registerModules).toHaveBeenCalledWith(defaultModules);
});

test('setupAGGridModules registers default + additional modules when provided', () => {
  const mockEnterpriseModule1 = {
    moduleName: 'MultiFilterModule',
  } as unknown as Module;
  const mockEnterpriseModule2 = {
    moduleName: 'PivotModule',
  } as unknown as Module;
  const additionalModules = [mockEnterpriseModule1, mockEnterpriseModule2];

  setupAGGridModules(additionalModules);

  expect(ModuleRegistry.registerModules).toHaveBeenCalledTimes(1);

  const registeredModules = (ModuleRegistry.registerModules as jest.Mock).mock
    .calls[0][0];

  // Should contain all default modules
  defaultModules.forEach(module => {
    expect(registeredModules).toContain(module);
  });

  // Should contain additional modules
  expect(registeredModules).toContain(mockEnterpriseModule1);
  expect(registeredModules).toContain(mockEnterpriseModule2);

  // Total length should be default + additional
  expect(registeredModules.length).toBe(
    defaultModules.length + additionalModules.length,
  );
});

test('setupAGGridModules handles empty additional modules array', () => {
  setupAGGridModules([]);

  expect(ModuleRegistry.registerModules).toHaveBeenCalledTimes(1);
  expect(ModuleRegistry.registerModules).toHaveBeenCalledWith(defaultModules);
});

test('setupAGGridModules does not mutate defaultModules array', () => {
  const originalLength = defaultModules.length;
  const mockEnterpriseModule = {
    moduleName: 'EnterpriseModule',
  } as unknown as Module;

  setupAGGridModules([mockEnterpriseModule]);

  // defaultModules should remain unchanged
  expect(defaultModules.length).toBe(originalLength);
  expect(defaultModules).not.toContain(mockEnterpriseModule);
});
