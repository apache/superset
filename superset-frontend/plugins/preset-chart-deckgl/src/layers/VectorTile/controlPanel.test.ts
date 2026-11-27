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

import { GenericDataType } from '@apache-superset/core/common';
import {
  ControlPanelsContainerProps,
  ControlPanelState,
  ControlState,
  CustomControlItem,
} from '@superset-ui/chart-controls';
import controlPanel, { validateTileUrl } from './controlPanel';
import TilePropertyControl from './TilePropertyControl';
import { COLOR_SCHEME_TYPES, ColorSchemeType } from '../../utilities/utils';

/** Every named control in the panel, in order. */
const controls = (controlPanel.controlPanelSections ?? [])
  .flatMap(section => section?.controlSetRows ?? [])
  .flat()
  .filter(
    (item): item is CustomControlItem =>
      typeof item === 'object' &&
      item !== null &&
      'name' in item &&
      'config' in item,
  );

const getControl = (name: string) => {
  const control = controls.find(item => item.name === name);
  if (!control) {
    throw new Error(`No control named ${name}`);
  }
  return control.config;
};

// Tile URL

test('validateTileUrl accepts a template and explains what is missing', () => {
  expect(validateTileUrl('http://tiles/{z}/{x}/{y}')).toBe(false);
  expect(validateTileUrl('http://tiles/{z}/{x}')).toBe(
    'must contain {z}, {x} and {y}',
  );
});

// Colour mode

test('defaults to a fixed colour and offers only the supported modes', () => {
  const colorSchemeType = getControl('color_scheme_type');
  expect(colorSchemeType.default).toBe(COLOR_SCHEME_TYPES.fixed_color);
  expect(
    (colorSchemeType.choices as string[][]).map(([value]) => value),
  ).toEqual([
    COLOR_SCHEME_TYPES.fixed_color,
    COLOR_SCHEME_TYPES.categorical_palette,
    COLOR_SCHEME_TYPES.color_breakpoints,
  ]);
});

const MODE_DEPENDENT_CONTROLS = [
  'fill_color_picker',
  'color_property',
  'color_scheme',
  'breakpoint_property',
  'color_breakpoints',
  'default_breakpoint_color',
  'legend_position',
  'legend_format',
];

/** Names of the mode-dependent controls that are visible in a colour mode. */
const visibleControlsFor = (mode: ColorSchemeType) =>
  MODE_DEPENDENT_CONTROLS.filter(
    name =>
      getControl(name).visibility?.(
        {
          controls: { color_scheme_type: { value: mode } },
        } as unknown as ControlPanelsContainerProps,
        {},
      ) ?? true,
  );

test.each([
  [COLOR_SCHEME_TYPES.fixed_color, ['fill_color_picker']],
  [
    COLOR_SCHEME_TYPES.categorical_palette,
    ['color_property', 'color_scheme', 'legend_position'],
  ],
  [
    COLOR_SCHEME_TYPES.color_breakpoints,
    [
      'breakpoint_property',
      'color_breakpoints',
      'default_breakpoint_color',
      'legend_position',
      'legend_format',
    ],
  ],
])('shows the right controls for %s', (mode, expected) => {
  expect(visibleControlsFor(mode)).toEqual(expected);
});

test('keeps chosen values when a mode switch hides their control', () => {
  ['color_property', 'breakpoint_property', 'legend_position', 'legend_format']
    .map(getControl)
    .forEach(config => expect(config.resetOnHide).toBe(false));
});

// Property pickers

test('every property picker re-reads the TileJSON URL and source layer', () => {
  const propertyControls = controls
    .filter(control => control.config.type === TilePropertyControl)
    .map(control => control.name);

  expect(propertyControls).toEqual([
    'color_property',
    'breakpoint_property',
    'tooltip_properties',
  ]);
  ['tile_json_url', 'source_layer'].forEach(name =>
    expect(getControl(name).rerender).toEqual(
      expect.arrayContaining(propertyControls),
    ),
  );
});

/** Explore state with one numeric and one text dataset column. */
const exploreState = (overrides: object = {}) =>
  ({
    datasource: {
      columns: [
        { column_name: 'rating', type_generic: GenericDataType.Numeric },
        { column_name: 'category', type_generic: GenericDataType.String },
      ],
    },
    controls: {},
    form_data: {},
    ...overrides,
  }) as unknown as ControlPanelState;

const propsFor = (name: string, state: ControlPanelState) =>
  getControl(name).mapStateToProps?.(state, {} as ControlState);

test('property pickers get the live TileJSON settings and all dataset columns', () => {
  const state = exploreState({
    controls: {
      tile_json_url: { value: 'http://tiles/places' },
      source_layer: { value: 'places' },
    },
  });

  expect(propsFor('tooltip_properties', state)).toEqual({
    tileJsonUrl: 'http://tiles/places',
    sourceLayer: 'places',
    datasetChoices: [
      ['category', 'category'],
      ['rating', 'rating'],
    ],
  });
});

test('property pickers fall back to saved form data before controls load', () => {
  const state = exploreState({
    form_data: { tile_json_url: 'http://saved/places' },
  });

  expect(propsFor('color_property', state)).toMatchObject({
    tileJsonUrl: 'http://saved/places',
  });
});

test('the breakpoint picker lists only numeric properties', () => {
  expect(propsFor('breakpoint_property', exploreState())).toMatchObject({
    numericOnly: true,
    datasetChoices: [['rating', 'rating']],
  });
});

test('tooltip fields are saved under their own key, never tooltip_contents', () => {
  // The backend adds form_data.tooltip_contents to the SQL query.
  expect(controls.map(control => control.name)).not.toContain(
    'tooltip_contents',
  );
  expect(getControl('tooltip_properties').type).toBe(TilePropertyControl);
});
