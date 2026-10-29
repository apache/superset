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
import { getChartControlPanelRegistry } from '@superset-ui/core';
import { getDisplayControlNames } from './getDisplayControlNames';

const VIZ_TYPE = 'display_control_names_test_chart';

afterEach(() => {
  getChartControlPanelRegistry().remove(VIZ_TYPE);
});

test('returns no names for a viz type without a control panel', () => {
  expect(getDisplayControlNames('not_registered')).toEqual([]);
});

test('names the controls that redraw the chart without a new query', () => {
  getChartControlPanelRegistry().registerValue(VIZ_TYPE, {
    controlPanelSections: [
      null,
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [
          ['groupby', 'color_scheme'],
          [{ name: 'metric', config: { type: 'MetricsControl' } }],
          [
            {
              name: 'stack',
              config: { type: 'CheckboxControl', renderTrigger: true },
            },
            {
              name: 'viewport',
              config: { type: 'ViewportControl', dontRefreshOnChange: true },
            },
          ],
          [<div key="heading" />, null],
        ],
      },
    ],
  });

  expect(getDisplayControlNames(VIZ_TYPE)).toEqual([
    'color_scheme',
    'stack',
    'viewport',
  ]);
});

test('applies the control overrides of the control panel', () => {
  getChartControlPanelRegistry().registerValue(VIZ_TYPE, {
    controlPanelSections: [
      {
        label: 'Query',
        expanded: true,
        controlSetRows: [['color_scheme', 'groupby']],
      },
    ],
    controlOverrides: {
      color_scheme: { renderTrigger: false },
      groupby: { renderTrigger: true },
    },
  });

  expect(getDisplayControlNames(VIZ_TYPE)).toEqual(['groupby']);
});
