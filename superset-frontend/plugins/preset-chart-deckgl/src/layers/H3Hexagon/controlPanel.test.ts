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
  CustomControlItem,
} from '@superset-ui/chart-controls';
import controlPanel from './controlPanel';

const sections = controlPanel.controlPanelSections.filter(
  (section): section is ControlPanelSectionConfig => section != null,
);

const controlNames = (section?: ControlPanelSectionConfig) =>
  (section?.controlSetRows ?? [])
    .flat()
    .map((item: ControlSetItem) =>
      typeof item === 'string'
        ? item
        : item && typeof item === 'object' && 'name' in item
          ? item.name
          : undefined,
    )
    .filter(Boolean);

const findControl = (name: string) =>
  sections
    .flatMap(section => section.controlSetRows.flat())
    .find(
      (item: ControlSetItem): item is CustomControlItem =>
        !!item &&
        typeof item === 'object' &&
        'name' in item &&
        item.name === name,
    );

test('controlPanel should require a single H3 index column', () => {
  const h3Index = findControl('h3_index');

  expect(h3Index).toBeDefined();
  expect(h3Index?.config.multi).toBe(false);
  expect(h3Index?.config.validators).toHaveLength(1);
});

test('controlPanel should make the metric optional', () => {
  expect(findControl('metric')?.config.validators).toEqual([]);
});

test('controlPanel should expose the shared map provider controls', () => {
  const mapSection = sections.find(section => section.label === 'Map');

  expect(controlNames(mapSection)).toEqual([
    'map_renderer',
    'mapbox_style',
    'maplibre_style',
    'viewport',
    'autozoom',
  ]);
});

test('controlPanel should not include the removed JavaScript controls', () => {
  const allNames = sections.flatMap(section => controlNames(section));

  ['js_columns', 'js_data_mutator', 'js_tooltip', 'js_onclick_href'].forEach(
    name => expect(allNames).not.toContain(name),
  );
  expect(sections.map(section => section.label)).not.toContain('Advanced');
});

test('controlPanel should offer fixed, linear and breakpoint color schemes', () => {
  const colorSchemeType = findControl('color_scheme_type');
  const choices = (
    (colorSchemeType?.config.choices ?? []) as [string, string][]
  ).map(([value]) => value);

  expect(choices).toEqual([
    'fixed_color',
    'linear_palette',
    'color_breakpoints',
  ]);
  expect(colorSchemeType?.config.default).toBe('linear_palette');
});
