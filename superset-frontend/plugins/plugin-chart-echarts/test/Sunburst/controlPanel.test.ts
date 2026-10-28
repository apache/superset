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
  ControlPanelsContainerProps,
  ControlPanelState,
  ControlState,
  CustomControlItem,
} from '@superset-ui/chart-controls';
import controlPanel from '../../src/Sunburst/controlPanel';

const timeGrainControl = (): CustomControlItem => {
  const item = controlPanel.controlPanelSections
    .flatMap(section => section?.controlSetRows ?? [])
    .flat()
    .find(
      control => (control as CustomControlItem)?.name === 'time_grain_sqla',
    ) as CustomControlItem | undefined;
  if (!item) {
    throw new Error('Sunburst has no time grain control');
  }
  return item;
};

const initialValue = (value: unknown, metadata: unknown) =>
  (
    timeGrainControl().config.initialValue as (
      control: ControlState,
      state: ControlPanelState,
    ) => unknown
  )(
    { value } as ControlState,
    {
      metadata,
      form_data: {},
    } as unknown as ControlPanelState,
  );

const visible = (columns: unknown[]) =>
  (
    timeGrainControl().config.visibility as (
      props: ControlPanelsContainerProps,
    ) => boolean
  )({
    controls: {
      columns: {
        value: columns,
        options: [
          { column_name: 'ts', is_dttm: true },
          { column_name: 'region', is_dttm: false },
        ],
      },
    },
  } as unknown as ControlPanelsContainerProps);

test('the time grain control keeps the saved grain', () => {
  expect(initialValue('P1M', { owners: [] })).toBe('P1M');
});

test('the time grain control does not add a grain to saved or new charts', () => {
  expect(initialValue(undefined, { owners: [] })).toBeUndefined();
  // The shared control defaults new charts to P1D; Sunburst must not, or a new
  // chart would truncate its temporal levels without the user choosing a grain.
  expect(initialValue(undefined, null)).toBeUndefined();
});

test('the time grain control shows only for a temporal hierarchy level', () => {
  expect(visible(['region'])).toBe(false);
  expect(visible(['region', 'ts'])).toBe(true);
  // buildQuery does not grain adhoc levels, so they do not show the control.
  expect(
    visible([
      {
        expressionType: 'SQL',
        sqlExpression: 'CAST(ts AS TIMESTAMP)',
        label: 'ts_cast',
      },
    ]),
  ).toBe(false);
});

test('the temporal lookup control is part of the Sunburst panel', () => {
  const names = controlPanel.controlPanelSections
    .flatMap(section => section?.controlSetRows ?? [])
    .flat();
  expect(names).toContain('temporal_columns_lookup');
});

test('a hidden time grain resets to null rather than retaining an orphan grain', () => {
  expect(timeGrainControl().config.default).toBeNull();
  expect(visible(['region'])).toBe(false);
});

test('Sunburst does not retain a hidden Time Column control', () => {
  const subject = controlPanel.controlPanelSections
    .flatMap(section => section?.controlSetRows ?? [])
    .flat()
    .find(item => (item as CustomControlItem)?.name === 'granularity_sqla');
  expect(subject).toBeUndefined();
});
