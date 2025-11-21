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
import controlPanelConfig from '../controlPanel';
import {
  RotationControl,
  SizeFromControl,
  SizeToControl,
} from '../controls';

test('should have required control panel structure', () => {
  expect(controlPanelConfig).toBeDefined();
  expect(controlPanelConfig.controlPanelSections).toBeDefined();
  expect(Array.isArray(controlPanelConfig.controlPanelSections)).toBe(true);
});

test('should have Query section with required controls', () => {
  const querySection = controlPanelConfig.controlPanelSections[0];
  const { controlSetRows } = querySection!;

  expect(querySection).toBeDefined();
  expect(querySection!.label).toBe('Query');
  expect(querySection!.expanded).toBe(true);
  expect(querySection!.controlSetRows).toBeDefined();
  expect(controlSetRows).toContainEqual(['series']);
  expect(controlSetRows).toContainEqual(['metric']);
  expect(controlSetRows).toContainEqual(['adhoc_filters']);
  expect(controlSetRows).toContainEqual(['row_limit']);
  expect(controlSetRows).toContainEqual(['sort_by_metric']);
});

test('should have Options section with React component controls', () => {
  const optionsSection = controlPanelConfig.controlPanelSections[1];
  const { controlSetRows } = optionsSection!;

  expect(optionsSection).toBeDefined();
  expect(optionsSection!.label).toBe('Options');
  expect(optionsSection!.expanded).toBe(true);
  expect(optionsSection!.controlSetRows).toBeDefined();

  // Check that React components are present in controlSetRows
  const hasSizeFromControl = controlSetRows.some((row: any) =>
    Array.isArray(row) && row.includes(SizeFromControl),
  );
  const hasSizeToControl = controlSetRows.some((row: any) =>
    Array.isArray(row) && row.includes(SizeToControl),
  );
  const hasRotationControl = controlSetRows.some((row: any) =>
    Array.isArray(row) && row.includes(RotationControl),
  );

  expect(hasSizeFromControl).toBe(true);
  expect(hasSizeToControl).toBe(true);
  expect(hasRotationControl).toBe(true);
});

test('should have controlOverrides with defaults for React component controls', () => {
  expect(controlPanelConfig.controlOverrides).toBeDefined();
  expect(controlPanelConfig.controlOverrides!.size_from).toBeDefined();
  expect(controlPanelConfig.controlOverrides!.size_from!.default).toBe(10);
  expect(controlPanelConfig.controlOverrides!.size_to).toBeDefined();
  expect(controlPanelConfig.controlOverrides!.size_to!.default).toBe(70);
  expect(controlPanelConfig.controlOverrides!.rotation).toBeDefined();
  expect(controlPanelConfig.controlOverrides!.rotation!.default).toBe('square');
});

test('should have controlOverrides for legacy controls', () => {
  expect(controlPanelConfig.controlOverrides).toBeDefined();
  expect(controlPanelConfig.controlOverrides!.series).toBeDefined();
  expect(controlPanelConfig.controlOverrides!.row_limit).toBeDefined();
  expect(controlPanelConfig.controlOverrides!.row_limit!.default).toBe(100);
});

test('should have formDataOverrides function', () => {
  expect(controlPanelConfig.formDataOverrides).toBeDefined();
  expect(typeof controlPanelConfig.formDataOverrides).toBe('function');
});

test('should mix React component controls with legacy string controls', () => {
  const optionsSection = controlPanelConfig.controlPanelSections[1];
  const { controlSetRows } = optionsSection!;

  // Should have both React components and string-based controls
  const hasReactComponents = controlSetRows.some((row: any) =>
    Array.isArray(row) &&
    (row.includes(SizeFromControl) ||
      row.includes(SizeToControl) ||
      row.includes(RotationControl)),
  );
  const hasLegacyControls = controlSetRows.some((row: any) =>
    Array.isArray(row) && row.includes('color_scheme'),
  );

  expect(hasReactComponents).toBe(true);
  expect(hasLegacyControls).toBe(true);
});

test('should have React components with correct defaultProps', () => {
  // Verify that React components have defaultProps set for name extraction
  expect(RotationControl.defaultProps).toBeDefined();
  expect(RotationControl.defaultProps!.name).toBe('rotation');
  expect(SizeFromControl.defaultProps).toBeDefined();
  expect(SizeFromControl.defaultProps!.name).toBe('size_from');
  expect(SizeToControl.defaultProps).toBeDefined();
  expect(SizeToControl.defaultProps!.name).toBe('size_to');
});

