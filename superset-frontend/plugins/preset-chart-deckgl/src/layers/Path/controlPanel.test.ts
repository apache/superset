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
import type {
  ControlPanelSectionConfig,
  ControlSetRow,
  ControlSetItem,
} from '@superset-ui/chart-controls';
import controlPanel from './controlPanel';

test('controlPanel should have Path Size section', () => {
  const pathSizeSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section != null && section.label === 'Path Size',
  );

  expect(pathSizeSection).toBeDefined();
  expect(pathSizeSection?.expanded).toBe(true);
});

test('controlPanel should include pathLineWidthFixedOrMetric control', () => {
  const pathSizeSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section != null && section.label === 'Path Size',
  );

  const control = pathSizeSection?.controlSetRows
    .flat()
    .find(
      (control: ControlSetItem) =>
        control &&
        typeof control === 'object' &&
        'name' in control &&
        control.name === 'line_width',
    ) as any;

  expect(control).toBeDefined();
  expect(control.config.type).toBe('FixedOrMetricControl');
  expect(control.config.default).toEqual({ type: 'fix', value: 1 });
});

test('controlPanel should include line_width_unit control with pixels as default', () => {
  const pathSizeSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section != null && section.label === 'Path Size',
  );

  const lineWidthRow = pathSizeSection?.controlSetRows.find(
    (row: ControlSetRow) =>
      row.some(
        (control: ControlSetItem) =>
          control &&
          typeof control === 'object' &&
          'name' in control &&
          control.name === 'line_width_unit',
      ),
  );

  const lineWidthControl = lineWidthRow?.find(
    (control: ControlSetItem) =>
      control &&
      typeof control === 'object' &&
      'name' in control &&
      control.name === 'line_width_unit',
  ) as any;

  expect(lineWidthControl).toBeDefined();
  expect(lineWidthControl?.config?.default).toBe('pixels');
});

test('controlPanel should include min_width control with default of 1', () => {
  const minWidthSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section != null && section.label === 'Path Size',
  );

  const minWidthRow = minWidthSection?.controlSetRows.find(
    (row: ControlSetRow) =>
      row.some(
        (control: ControlSetItem) =>
          control &&
          typeof control === 'object' &&
          'name' in control &&
          control.name === 'min_width',
      ),
  );

  const minWidthControl = minWidthRow?.find(
    (control: ControlSetItem) =>
      control &&
      typeof control === 'object' &&
      'name' in control &&
      control.name === 'min_width',
  ) as any;

  expect(minWidthControl).toBeDefined();
  expect(minWidthControl?.config?.default).toBe(1);
});

test('controlPanel should include max_width control with default of 20', () => {
  const maxWidthSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section != null && section.label === 'Path Size',
  );

  const maxWidthRow = maxWidthSection?.controlSetRows.find(
    (row: ControlSetRow) =>
      row.some(
        (control: ControlSetItem) =>
          control &&
          typeof control === 'object' &&
          'name' in control &&
          control.name === 'max_width',
      ),
  );

  const maxWidthControl = maxWidthRow?.find(
    (control: ControlSetItem) =>
      control &&
      typeof control === 'object' &&
      'name' in control &&
      control.name === 'max_width',
  ) as any;

  expect(maxWidthControl).toBeDefined();
  expect(maxWidthControl?.config?.default).toBe(20);
});

test('controlPanel should include line_width_multiplier control with default of 1', () => {
  const lineWidthMultiplierSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section != null && section.label === 'Path Size',
  );

  const lineWidthMultiplierRow =
    lineWidthMultiplierSection?.controlSetRows.find((row: ControlSetRow) =>
      row.some(
        (control: ControlSetItem) =>
          control &&
          typeof control === 'object' &&
          'name' in control &&
          control.name === 'line_width_multiplier',
      ),
    );

  const lineWidthMultiplierControl = lineWidthMultiplierRow?.find(
    (control: ControlSetItem) =>
      control &&
      typeof control === 'object' &&
      'name' in control &&
      control.name === 'line_width_multiplier',
  ) as any;

  expect(lineWidthMultiplierControl).toBeDefined();
  expect(lineWidthMultiplierControl?.config?.default).toBe(1);
});

test('controlPanel should have Path Color section', () => {
  const pathColorSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section != null && section.label === 'Path Color',
  );

  expect(pathColorSection).toBeDefined();
  expect(pathColorSection?.expanded).toBe(true);
});

test('controlPanel should have Path Color section with color scheme controls', () => {
  const pathColorSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section != null && section.label === 'Path Color',
  );

  const controlNames = pathColorSection?.controlSetRows
    .flat()
    .filter(
      (control: ControlSetItem) =>
        control && typeof control === 'object' && 'name' in control,
    )
    .map((control: any) => control.name);

  expect(controlNames).toContain('color_scheme_type');
  expect(controlNames).toContain('color_picker');
  expect(controlNames).toContain('dimension');
  expect(controlNames).toContain('color_scheme');
  expect(controlNames).toContain('breakpoint_metric');
  expect(controlNames).toContain('default_breakpoint_color');
  expect(controlNames).toContain('color_breakpoints');
});

test('color_scheme_type should default to fixed_color', () => {
  const pathColorSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section != null && section.label === 'Path Color',
  );

  const schemeTypeControl = pathColorSection?.controlSetRows
    .flat()
    .find(
      (control: ControlSetItem) =>
        control &&
        typeof control === 'object' &&
        'name' in control &&
        control.name === 'color_scheme_type',
    ) as any;

  expect(schemeTypeControl).toBeDefined();
  expect(schemeTypeControl?.config?.default).toBe('fixed_color');
});
