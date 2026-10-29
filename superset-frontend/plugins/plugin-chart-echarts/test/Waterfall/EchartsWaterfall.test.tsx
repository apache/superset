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
import { supersetTheme } from '@apache-superset/core/theme';
import { ChartProps, SqlaFormData, TimeGranularity } from '@superset-ui/core';
import { render } from '@testing-library/react';
import EchartsWaterfall from '../../src/Waterfall/EchartsWaterfall';
import transformProps from '../../src/Waterfall/transformProps';
import { EchartsWaterfallChartProps } from '../../src/Waterfall/types';
import Echart from '../../src/components/Echart';
import { EventHandlers } from '../../src/types';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

const rows = [
  { year: '2019', name: 'Sylvester', sum: 10 },
  { year: '2019', name: 'Arnold', sum: 3 },
  { year: '2020', name: 'Sylvester', sum: -10 },
  { year: '2020', name: 'Arnold', sum: 5 },
];

const formData = {
  colorScheme: 'bnbColors',
  datasource: '3__table',
  granularity_sqla: 'ds',
  metric: 'sum',
  x_axis: 'year',
  groupby: 'name',
  showTotal: true,
};

function renderChart(
  overrides: Partial<ChartProps> & { emitCrossFilters?: boolean } = {},
) {
  const setDataMask = jest.fn();
  const onContextMenu = jest.fn();
  const chartProps = new ChartProps({
    formData: formData as unknown as SqlaFormData,
    width: 800,
    height: 600,
    queriesData: [{ data: rows }],
    hooks: { setDataMask, onContextMenu },
    theme: supersetTheme,
    ...overrides,
  });
  const props = transformProps(
    chartProps as unknown as EchartsWaterfallChartProps,
  );
  render(<EchartsWaterfall {...props} />);
  const lastCall = mockedEchart.mock.calls[mockedEchart.mock.calls.length - 1];
  const { eventHandlers } = lastCall[0] as { eventHandlers: EventHandlers };
  return { eventHandlers, setDataMask, onContextMenu };
}

beforeEach(() => {
  mockedEchart.mockClear();
});

function pointerEvent(dataIndex: number) {
  return {
    dataIndex,
    event: {
      stop: jest.fn(),
      event: { clientX: 12, clientY: 24 } as PointerEvent,
    },
  };
}

test('clicking a breakdown bar filters the period and the breakdown', () => {
  const { eventHandlers, setDataMask } = renderChart({
    emitCrossFilters: true,
  });
  eventHandlers.click(pointerEvent(0));
  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [
          { col: 'year', op: 'IN', val: ['2019'] },
          { col: 'name', op: 'IN', val: ['Sylvester'] },
        ],
      },
    }),
  );
});

test('clicking a period total filters the period only', () => {
  const { eventHandlers, setDataMask } = renderChart({
    emitCrossFilters: true,
  });
  eventHandlers.click(pointerEvent(2));
  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [{ col: 'year', op: 'IN', val: ['2019'] }],
      },
    }),
  );
});

test('clicking the same bar again clears the filter', () => {
  const { eventHandlers, setDataMask } = renderChart({
    emitCrossFilters: true,
    filterState: { selectedValues: [JSON.stringify(['2019', 'Sylvester'])] },
  });
  eventHandlers.click(pointerEvent(0));
  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: { filters: [] },
    }),
  );
});

test('does not emit a filter when cross-filtering is disabled', () => {
  const { eventHandlers, setDataMask } = renderChart({
    emitCrossFilters: false,
  });
  eventHandlers.click(pointerEvent(0));
  expect(setDataMask).not.toHaveBeenCalled();
});

test('clicking the grand total does not change the current filter', () => {
  const { eventHandlers, setDataMask } = renderChart({
    emitCrossFilters: true,
    formData: { ...formData, groupby: undefined } as unknown as SqlaFormData,
  });
  eventHandlers.click(pointerEvent(2));
  expect(setDataMask).not.toHaveBeenCalled();
});

const breakdownCrossFilter = {
  dataMask: {
    extraFormData: {
      filters: [
        { col: 'year', op: 'IN', val: ['2019'] },
        { col: 'name', op: 'IN', val: ['Sylvester'] },
      ],
    },
    filterState: {
      label: '2019, Sylvester',
      value: '2019, Sylvester',
      selectedValues: [JSON.stringify(['2019', 'Sylvester'])],
    },
  },
  isCurrentValueSelected: false,
};

test('a context menu carries the drill filters for the clicked bar', () => {
  const { eventHandlers, onContextMenu } = renderChart({
    emitCrossFilters: true,
  });
  const event = pointerEvent(0);
  eventHandlers.contextmenu(event);
  expect(event.event.stop).toHaveBeenCalled();
  expect(onContextMenu).toHaveBeenCalledWith(12, 24, {
    drillToDetail: [
      { col: 'year', op: '==', val: '2019', formattedVal: '2019' },
      {
        col: 'name',
        op: '==',
        val: 'Sylvester',
        formattedVal: 'Sylvester',
      },
    ],
    crossFilter: breakdownCrossFilter,
    drillBy: {
      groupbyFieldName: 'groupby',
      filters: [
        {
          col: 'name',
          op: '==',
          val: 'Sylvester',
          formattedVal: 'Sylvester',
        },
      ],
      xAxisFilters: [
        { col: 'year', op: '==', val: '2019', formattedVal: '2019' },
      ],
    },
  });
});

test('a context menu can clear an already selected bar', () => {
  const { eventHandlers, onContextMenu } = renderChart({
    emitCrossFilters: true,
    filterState: {
      selectedValues: [JSON.stringify(['2019', 'Sylvester'])],
    },
  });
  eventHandlers.contextmenu(pointerEvent(0));
  expect(onContextMenu).toHaveBeenCalledWith(
    12,
    24,
    expect.objectContaining({
      crossFilter: {
        dataMask: {
          extraFormData: { filters: [] },
          filterState: {
            label: null,
            value: null,
            selectedValues: null,
          },
        },
        isCurrentValueSelected: true,
      },
    }),
  );
});

test('a monthly temporal bar cross-filters the whole month', () => {
  const { eventHandlers, setDataMask, onContextMenu } = renderChart({
    emitCrossFilters: true,
    formData: {
      ...formData,
      groupby: undefined,
      x_axis: 'order_date',
      time_grain_sqla: TimeGranularity.DAY,
      extra_form_data: { time_grain_sqla: TimeGranularity.MONTH },
    } as unknown as SqlaFormData,
    queriesData: [
      {
        data: [
          { order_date: '2021-01-01T00:00:00', sum: 10 },
          { order_date: '2021-02-01T00:00:00', sum: -3 },
        ],
        colnames: ['order_date', 'sum'],
        coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      },
    ],
  });
  const range = '2021-01-01T00:00:00 : 2021-02-01T00:00:00';
  eventHandlers.click(pointerEvent(0));
  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [
          {
            col: 'order_date',
            op: 'TEMPORAL_RANGE',
            val: range,
            formattedVal: expect.any(String),
          },
        ],
        time_range: range,
      },
    }),
  );

  onContextMenu.mockClear();
  eventHandlers.contextmenu(pointerEvent(0));
  const payload = onContextMenu.mock.calls[0][2];
  expect(payload.drillToDetail).toEqual([
    expect.objectContaining({
      col: 'order_date',
      op: '==',
      val: '2021-01-01T00:00:00',
      grain: TimeGranularity.MONTH,
    }),
  ]);
  expect(payload.drillBy.xAxisFilters).toEqual([
    expect.objectContaining({
      col: 'order_date',
      op: '==',
      val: '2021-01-01T00:00:00',
      grain: TimeGranularity.MONTH,
    }),
  ]);
  expect(payload.crossFilter.isCurrentValueSelected).toBe(false);
  expect(payload.crossFilter.dataMask.extraFormData.time_range).toBe(range);
});

test('keeps an adhoc temporal axis in the drill-by scope', () => {
  const column = {
    sqlExpression: 'CAST(order_date AS TIMESTAMP)',
    label: 'order_date',
    expressionType: 'SQL' as const,
  };
  const epoch = Date.parse('2021-01-01T00:00:00Z');
  const { eventHandlers, onContextMenu } = renderChart({
    emitCrossFilters: true,
    formData: {
      ...formData,
      groupby: undefined,
      x_axis: column,
      time_grain_sqla: TimeGranularity.MONTH,
    } as unknown as SqlaFormData,
    queriesData: [
      {
        data: [
          { order_date: epoch, sum: 10 },
          { order_date: Date.parse('2021-02-01T00:00:00Z'), sum: -3 },
        ],
        colnames: ['order_date', 'sum'],
        coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
      },
    ],
  });
  eventHandlers.contextmenu(pointerEvent(0));
  const payload = onContextMenu.mock.calls[0][2];
  const axisFilter = {
    col: expect.objectContaining({
      sqlExpression: column.sqlExpression,
      label: 'order_date',
      columnType: 'BASE_AXIS',
      timeGrain: TimeGranularity.MONTH,
    }),
    op: '==',
    val: '2021-01-01T00:00:00',
    grain: TimeGranularity.MONTH,
  };
  expect(payload.drillBy.xAxisFilters).toEqual([
    expect.objectContaining(axisFilter),
  ]);
  expect(payload.drillBy.filters).toEqual([]);
  expect(payload.drillToDetail).toEqual([expect.objectContaining(axisFilter)]);
});
