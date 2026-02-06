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

import { ControlPanelState } from '../../src/types';
import { xAxisSortControl } from '../../src/shared-controls/customControls';

const createState = (
  overrides: Partial<ControlPanelState>,
): ControlPanelState =>
  ({
    slice: { slice_id: 1 },
    form_data: {},
    datasource: {
      column_formats: {},
      verbose_map: {},
    },
    controls: {},
    common: {},
    metadata: {},
    ...overrides,
  }) as ControlPanelState;

const createControlState = (value: unknown = undefined) => ({ value }) as any;

test('xAxisSortControl includes axis and metric options when there is no dimension', () => {
  const state = createState({
    controls: {
      x_axis: { value: 'ds', type: 'Select' },
      groupby: { value: [], type: 'Select' },
      metrics: { value: ['metric_1'], type: 'Select' },
      timeseries_limit_metric: { value: 'sort_metric', type: 'Select' },
      datasource: {
        datasource: {
          columns: [],
          metrics: [],
        },
        type: 'Select',
      },
    },
  });

  const { options } = xAxisSortControl.config.mapStateToProps!(
    state,
    createControlState(),
  ) as { options: { value: string }[] };

  const values = options.map(opt => opt.value);

  expect(values).toContain('ds');
  expect(values).toContain('metric_1');
});

test('xAxisSortControl keeps axis and metric options when a dimension is set', () => {
  const state = createState({
    controls: {
      x_axis: { value: 'ds', type: 'Select' },
      groupby: { value: ['dim'], type: 'Select' },
      metrics: { value: ['metric_1'], type: 'Select' },
      timeseries_limit_metric: { value: 'sort_metric', type: 'Select' },
      datasource: {
        datasource: {
          columns: [],
          metrics: [],
        },
        type: 'Select',
      },
    },
  });

  const { options } = xAxisSortControl.config.mapStateToProps!(
    state,
    createControlState(),
  ) as { options: { value: string }[] };

  const values = options.map(opt => opt.value);

  // Axis and metric choices should still be present
  expect(values).toContain('ds');
  expect(values).toContain('metric_1');

  // And multi-series sort choices should also be available
  expect(values).toContain('name');
  expect(values).toContain('sum');
});
