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

import {
  semanticGrainProps,
  semanticGrainSelections,
} from '../../src/utils/semanticGrainChoices';

const support = {
  grains: ['P1M'],
  allows_default_grain: false,
  omitted_grain: 'P1M',
  ungrained_filter: 'P1M',
};
const choices: [string, string][] = [
  ['P1D', 'Day'],
  ['P1W', 'Week'],
  ['P1M', 'Month'],
];
const state = {
  datasource: { type: 'semantic_view', time_grain_sqla: choices },
  controls: { x_axis: { value: 'event_time' } },
  compatibility: {
    status: 'verified',
    dimensionSupport: { event_time: support },
  },
};

test('narrows selected-axis grains to metric context without replacing a saved value', () => {
  expect(semanticGrainProps(state)).toEqual({
    choices: [['P1M', 'Month']],
    clearable: false,
  });
  expect(state.controls.x_axis.value).toBe('event_time');
});

test.each(['idle', 'loading', 'failed'])(
  'unknown support (%s) retains the catalog so a stale selection can be repaired',
  status => {
    expect(
      semanticGrainProps({ ...state, compatibility: { status } }).choices,
    ).toEqual(choices);
  },
);

test('missing support retains selectable catalog choices', () => {
  expect(semanticGrainProps({ ...state, controls: {} }).choices).toEqual(
    choices,
  );
  expect(
    semanticGrainProps({
      ...state,
      compatibility: { status: 'verified', dimensionSupport: {} },
    }).choices,
  ).toEqual(choices);
});

test('native-only support remains clearable', () => {
  expect(
    semanticGrainProps({
      ...state,
      compatibility: {
        status: 'verified',
        dimensionSupport: {
          event_time: { ...support, grains: [], allows_default_grain: true },
        },
      },
    }),
  ).toEqual({ choices: [], clearable: true });
});

test('dataset choices and order remain unchanged', () => {
  expect(
    semanticGrainProps({
      ...state,
      datasource: { type: 'table', time_grain_sqla: choices },
    }),
  ).toEqual({ choices });
});

test('compatibility keeps explicit and raw grains distinct from dormant or omitted selections', () => {
  const columns = [
    { column_name: 'time', is_dttm: true },
    { column_name: 'region', is_dttm: false },
  ];
  expect(
    semanticGrainSelections(
      { x_axis: 'time', time_grain_sqla: 'P1M' },
      ['time'],
      columns,
    ),
  ).toEqual({ time: 'P1M' });
  expect(
    semanticGrainSelections(
      { x_axis: 'time', time_grain_sqla: null },
      ['time'],
      columns,
    ),
  ).toEqual({ time: null });
  expect(
    semanticGrainSelections({ x_axis: 'time' }, ['time'], columns),
  ).toEqual({});
  expect(
    semanticGrainSelections(
      { granularity_sqla: 'time', time_grain_sqla: 'P1M' },
      ['region'],
      columns,
    ),
  ).toEqual({});
  expect(
    semanticGrainSelections(
      { x_axis: 'region', time_grain_sqla: 'P1M' },
      ['region'],
      columns,
    ),
  ).toEqual({});
  expect(
    semanticGrainSelections(
      { x_axis: { sqlExpression: 'time' }, time_grain_sqla: 'P1M' },
      ['time'],
      columns,
    ),
  ).toEqual({ time: 'P1M' });
});
