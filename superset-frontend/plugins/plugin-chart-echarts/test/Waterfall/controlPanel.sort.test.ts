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
import config from '../../src/Waterfall/controlPanel';

// Walk the control panel config to grab a control's config by name.
const findControl = (name: string): any => {
  for (const section of (config as any).controlPanelSections) {
    for (const row of section?.controlSetRows ?? []) {
      for (const item of row) {
        if (item && typeof item === 'object' && item.name === name) {
          return item.config;
        }
      }
    }
  }
  throw new Error(`control ${name} not found`);
};

const datasource = {
  columns: [{ column_name: 'stage' }, { column_name: 'sort_order' }],
} as any;
const state = {
  datasource,
  controls: { metric: { value: 'SUM(profit)' } },
} as any;

const sortConfig = findControl('x_axis_sort');

test('x_axis_sort offers dataset columns plus the current metric', () => {
  const { choices } = sortConfig.mapStateToProps(state, { value: null });
  const values = choices.map((c: [string, string]) => c[0]);
  expect(values).toEqual(
    expect.arrayContaining(['stage', 'sort_order', 'SUM(profit)']),
  );
});

test('x_axis_sort keeps a value that is still a valid column or metric', () => {
  expect(
    sortConfig.mapStateToProps(state, { value: 'sort_order' }).shouldReset,
  ).toBe(false);
  expect(
    sortConfig.mapStateToProps(state, { value: 'SUM(profit)' }).shouldReset,
  ).toBe(false);
});

test('x_axis_sort resets a stale value when the referenced metric changed', () => {
  // 'SUM(old_metric)' is neither a current column nor the current metric, so
  // it must be reset — otherwise it leaks into the query as an unknown column.
  expect(
    sortConfig.mapStateToProps(state, { value: 'SUM(old_metric)' }).shouldReset,
  ).toBe(true);
});
