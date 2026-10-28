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
import { render } from '@testing-library/react';
import { ChartProps, SqlaFormData } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import Histogram from '../../src/Histogram/Histogram';
import transformProps from '../../src/Histogram/transformProps';
import { HistogramChartProps } from '../../src/Histogram/types';
import Echart from '../../src/components/Echart';
import { EventHandlers } from '../../src/types';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

const formData: SqlaFormData = {
  datasource: '5__table',
  viz_type: 'histogram',
  column: 'price',
  groupby: ['region'],
  bins: 2,
  cumulative: false,
  normalize: false,
  sliceId: 1,
  showLegend: true,
  showValue: false,
  xAxisFormat: '',
  xAxisTitle: '',
  yAxisFormat: '',
  yAxisTitle: '',
};

const queriesData = [
  {
    data: [
      { region: 'WEST', '0 - 5': 3, '5 - 10': 7 },
      { region: 'EAST', '0 - 5': 1, '5 - 10': 2 },
    ],
  },
];

function setup(
  overrides: {
    emitCrossFilters?: boolean;
    filterState?: { selectedValues?: string[] | null };
    groupby?: string[];
    cumulative?: boolean;
  } = {},
) {
  const onContextMenu = jest.fn();
  const setDataMask = jest.fn();
  const chartProps = {
    ...new ChartProps({
      formData: {
        ...formData,
        groupby: overrides.groupby ?? formData.groupby,
        cumulative: overrides.cumulative ?? formData.cumulative,
      },
      width: 800,
      height: 600,
      queriesData,
      theme: supersetTheme,
      hooks: { onContextMenu, setDataMask },
      filterState: overrides.filterState ?? {},
      emitCrossFilters: overrides.emitCrossFilters ?? true,
    }),
    emitCrossFilters: overrides.emitCrossFilters ?? true,
    filterState: overrides.filterState ?? {},
  } as unknown as HistogramChartProps;

  const transformed = transformProps(chartProps);
  render(
    <Histogram
      {...transformed}
      onContextMenu={onContextMenu}
      setDataMask={setDataMask}
      emitCrossFilters={overrides.emitCrossFilters ?? true}
      filterState={overrides.filterState ?? {}}
    />,
  );

  const lastCall = mockedEchart.mock.calls[mockedEchart.mock.calls.length - 1];
  const { eventHandlers } = lastCall[0] as { eventHandlers: EventHandlers };
  return { eventHandlers, onContextMenu, setDataMask, transformed };
}

beforeEach(() => {
  mockedEchart.mockClear();
});

test('click filters the histogram column by the bin and the series group', () => {
  const { eventHandlers, setDataMask } = setup();

  eventHandlers.click({ seriesIndex: 0, dataIndex: 0 });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [
          { col: 'price', op: '>=', val: 0 },
          { col: 'price', op: '<', val: 5 },
          { col: 'region', op: 'IN', val: ['WEST'] },
        ],
      },
      filterState: expect.objectContaining({
        label: '0 - 5, WEST',
      }),
    }),
  );
});

test('a cumulative click filters every value up to the bin edge', () => {
  const { eventHandlers, setDataMask } = setup({ cumulative: true });

  eventHandlers.click({ seriesIndex: 0, dataIndex: 0 });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [
          { col: 'price', op: '<', val: 5 },
          { col: 'region', op: 'IN', val: ['WEST'] },
        ],
      },
    }),
  );
});

test('click on the last bin includes its right edge', () => {
  const { eventHandlers, setDataMask } = setup({ groupby: [] });

  eventHandlers.click({ seriesIndex: 0, dataIndex: 1 });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [
          { col: 'price', op: '>=', val: 5 },
          { col: 'price', op: '<=', val: 10 },
        ],
      },
    }),
  );
});

test('click clears the cross-filter when the same bar is already selected', () => {
  const first = setup();
  first.eventHandlers.click({ seriesIndex: 0, dataIndex: 0 });
  const selected = first.setDataMask.mock.calls[0][0].filterState
    .selectedValues as string[];

  const second = setup({ filterState: { selectedValues: selected } });
  second.eventHandlers.click({ seriesIndex: 0, dataIndex: 0 });

  expect(second.setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: { filters: [] },
      filterState: {
        label: null,
        value: null,
        selectedValues: null,
      },
    }),
  );
});

test('click does nothing when cross-filtering is disabled', () => {
  const { eventHandlers, setDataMask } = setup({ emitCrossFilters: false });

  eventHandlers.click({ seriesIndex: 0, dataIndex: 0 });

  expect(setDataMask).not.toHaveBeenCalled();
});

test('context menu exposes the cross-filter for the clicked bar', () => {
  const { eventHandlers, onContextMenu } = setup();

  eventHandlers.contextmenu({
    seriesIndex: 1,
    dataIndex: 1,
    event: { stop: jest.fn(), event: { clientX: 4, clientY: 8 } },
  });

  const [[x, y, payload]] = onContextMenu.mock.calls;
  expect(x).toBe(4);
  expect(y).toBe(8);
  expect(payload.drillToDetail).toBeUndefined();
  expect(payload.crossFilter.dataMask.extraFormData.filters).toEqual([
    { col: 'price', op: '>=', val: 5 },
    { col: 'price', op: '<=', val: 10 },
    { col: 'region', op: 'IN', val: ['EAST'] },
  ]);
});
