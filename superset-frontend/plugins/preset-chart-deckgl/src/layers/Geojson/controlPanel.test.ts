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
  ControlSetItem,
} from '@superset-ui/chart-controls';
import controlPanel from './controlPanel';

const getGeoJsonSettingsSection = () =>
  controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section != null && section.label === 'GeoJson Settings',
  );

const findControl = (name: string) =>
  getGeoJsonSettingsSection()
    ?.controlSetRows.flat()
    .find(
      (control: ControlSetItem) =>
        control &&
        typeof control === 'object' &&
        'name' in control &&
        control.name === name,
    ) as any;

test('controlPanel should include fill_color_picker control', () => {
  const control = findControl('fill_color_picker');

  expect(control).toBeDefined();
  expect(control.config.type).toBe('ColorPickerControl');
});

test('fill_color_picker should be visible even though the layer has no color_scheme_type control', () => {
  const controlNames = getGeoJsonSettingsSection()
    ?.controlSetRows.flat()
    .filter(
      (control: ControlSetItem) =>
        control && typeof control === 'object' && 'name' in control,
    )
    .map((control: any) => control.name);

  // The layer intentionally has no color scheme type control, so the shared
  // fixed-color visibility gate must not be applied to the fill color picker.
  expect(controlNames).not.toContain('color_scheme_type');
  expect(
    findControl('fill_color_picker').config.visibility({ controls: {} }),
  ).toBe(true);
});

test('controlPanel should include stroke_color_picker control', () => {
  const control = findControl('stroke_color_picker');

  expect(control).toBeDefined();
  expect(control.config.type).toBe('ColorPickerControl');
});
