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

/**
 * `charts.controlDefaults`, the half of the control panel an extension needs
 * to tell a setting somebody set from one a save merely wrote down.
 *
 * The distinction a caller depends on is the one asserted last here: a
 * control with no declared default is absent, not present as `undefined`.
 * A caller that cannot tell those apart has no way to stay silent about a
 * control it knows nothing about, which is the only safe thing to do with
 * one.
 */
import { getChartControlPanelRegistry, JsonObject } from '@superset-ui/core';
import { charts } from 'src/core/charts';

const fakePluginControls: JsonObject = {
  controlPanelSections: [
    {
      label: 'Fake Control Panel Section',
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'donut',
            config: { type: 'CheckboxControl', label: 'Donut', default: false },
          },
        ],
        [
          {
            name: 'y_axis_bounds',
            config: {
              type: 'BoundsControl',
              label: 'Value bounds',
              default: [null, null],
            },
          },
        ],
        [
          {
            // Declares no default at all.
            name: 'column_collection',
            config: { type: 'CollectionControl', label: 'Fake Collection' },
          },
        ],
        [
          {
            // Names `undefined` as its default, which several real controls
            // do -- `shared-controls/mixins.tsx` among them.
            name: 'explicitly_undefined',
            config: { type: 'SelectControl', default: undefined },
          },
        ],
      ],
    },
  ],
};

beforeEach(() => {
  getChartControlPanelRegistry().registerValue(
    'control_defaults_fake',
    fakePluginControls,
  );
});

test('a control is reported at the value it defaults to', () => {
  expect(charts.controlDefaults('control_defaults_fake')).toMatchObject({
    donut: false,
    y_axis_bounds: [null, null],
  });
});

test('a control that declares no default is absent, not undefined', () => {
  const defaults = charts.controlDefaults('control_defaults_fake');

  expect('column_collection' in defaults).toBe(false);
});

test('a control naming `undefined` as its default is absent too', () => {
  // `'default' in config` is true for it, so the key would be present and
  // hold `undefined` -- which is the one reading the contract above tells a
  // caller it will never have to make.
  const defaults = charts.controlDefaults('control_defaults_fake');

  expect('explicitly_undefined' in defaults).toBe(false);
});

test('a visualization the registry does not know yields nothing', () => {
  // The same answer `controlLabels` gives, and the honest one: no defaults
  // are available, so a caller compares against nothing. Explore renders no
  // control panel for an unknown type, so not even the sections it puts on
  // every chart (below) are reported for one.
  expect(charts.controlDefaults('no_such_viz_type')).toEqual({});
});

test('no visualization type at all yields nothing', () => {
  expect(charts.controlDefaults('')).toEqual({});
});

test('the controls Explore puts on every chart are reported too', () => {
  // `getSectionsToRender` renders the matrixify sections ahead of a
  // plugin's own whatever the visualization, so Explore hydrates and saves
  // their keys on a chart that has never been near the matrixify tab --
  // `applyDefaultFormData({ viz_type: 'pie', ... }).matrixify_enable` is
  // `false`. Left out here, every one of them reads as newly set on any
  // chart resaved since matrixify landed, which is the one thing this API
  // exists to prevent.
  expect(charts.controlDefaults('control_defaults_fake')).toMatchObject({
    matrixify_enable: false,
    matrixify_mode_rows: 'disabled',
    matrixify_charts_per_row: 4,
  });
});

test('a key that identifies the chart rather than configuring it stays out', () => {
  // Explore renders these from a section of its own, ahead of matrixify's.
  // Walking that section too would report a `viz_type` default for every
  // visualization -- `table`'s, since that is what the control defaults to.
  const defaults = charts.controlDefaults('control_defaults_fake');

  expect('viz_type' in defaults).toBe(false);
  expect('datasource' in defaults).toBe(false);
  expect('slice_id' in defaults).toBe(false);
});

test('a default is the one Explore writes, overrides and shared controls included', () => {
  getChartControlPanelRegistry().registerValue('control_defaults_overridden', {
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [['row_limit'], ['adhoc_filters']],
      },
    ],
    controlOverrides: { row_limit: { default: 100 } },
  });

  expect(charts.controlDefaults('control_defaults_overridden')).toMatchObject({
    row_limit: 100,
    adhoc_filters: [],
  });
});
