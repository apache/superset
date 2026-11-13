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

test('a visualization the registry does not know yields nothing', () => {
  // The same answer `controlLabels` gives, and the honest one: no defaults
  // are available, so a caller compares against nothing.
  expect(charts.controlDefaults('no_such_viz_type')).toEqual({});
});

test('no visualization type at all yields nothing', () => {
  expect(charts.controlDefaults('')).toEqual({});
});
