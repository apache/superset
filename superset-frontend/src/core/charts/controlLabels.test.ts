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
 * What an extension gets when it asks what a chart's controls are called.
 *
 * The keys inside a chart's `params` are Explore control names, which an
 * extension describing a change has no way to resolve: the control panel
 * registry is the host's. Without this it can only print the raw keys --
 * `adhoc_filters`, `color_by_primary_axis`, `axisTicks`.
 *
 * Read through the same expansion as `controlDefaults`, against the real
 * registry rather than a mocked lookup, which is what lets the last case
 * here hold the two to one answer.
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
            name: 'adhoc_filters',
            config: { type: 'AdhocFilterControl', label: 'Filters' },
          },
        ],
        [
          {
            name: 'row_limit',
            config: { type: 'SelectControl', label: 'Row limit' },
          },
        ],
        [
          // A dynamic control's label can be a node or a function. Neither
          // can go into a sentence, and `[object Object]` beside a setting
          // name is worse than the raw key the caller falls back to.
          { name: 'node_label', config: { label: { type: 'span' } } },
          { name: 'fn_label', config: { label: () => 'Computed' } },
          { name: 'no_label', config: { type: 'CheckboxControl' } },
        ],
      ],
    },
  ],
};

beforeEach(() => {
  getChartControlPanelRegistry().registerValue(
    'control_labels_fake',
    fakePluginControls,
  );
});

test('a control is returned under its own name, by its label', () => {
  expect(charts.controlLabels('control_labels_fake')).toMatchObject({
    adhoc_filters: 'Filters',
    row_limit: 'Row limit',
  });
});

test('a label that is not a plain string is left out, not stringified', () => {
  const labels = charts.controlLabels('control_labels_fake');

  expect('node_label' in labels).toBe(false);
  expect('fn_label' in labels).toBe(false);
  expect('no_label' in labels).toBe(false);
});

test('a visualization type the registry does not know yields nothing', () => {
  // Empty, not a throw: the caller then shows raw keys, which is what it
  // would have shown anyway. Failing here would take the panel down over a
  // cosmetic lookup.
  expect(charts.controlLabels('not-a-viz')).toEqual({});
});

test('an empty visualization type is not asked about', () => {
  expect(charts.controlLabels('')).toEqual({});
});

test('the controls Explore puts on every chart are labelled too', () => {
  // The same sections `controlDefaults` reports defaults from. A reader
  // handed `matrixify_enable` in a diff and no label for it falls back to
  // the raw key for a control the author did see a name for in Explore.
  expect(charts.controlLabels('control_labels_fake')).toMatchObject({
    matrixify_enable: 'Enable matrixify',
    matrixify_charts_per_row: 'Charts per row',
  });
});

test('a shared control is labelled from the same config it is defaulted from', () => {
  // The two readers walk one expansion, so a string shorthand resolves
  // against `sharedControls` for both and a `controlOverrides` entry moves
  // both. Read from two registries, a key could be labelled from one and
  // defaulted from the other, and an override would reach only the default.
  getChartControlPanelRegistry().registerValue('control_labels_overridden', {
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [['row_limit']],
      },
    ],
    controlOverrides: { row_limit: { label: 'Rows to fetch', default: 100 } },
  });

  expect(charts.controlLabels('control_labels_overridden')).toMatchObject({
    row_limit: 'Rows to fetch',
  });
  expect(charts.controlDefaults('control_labels_overridden')).toMatchObject({
    row_limit: 100,
  });
});
