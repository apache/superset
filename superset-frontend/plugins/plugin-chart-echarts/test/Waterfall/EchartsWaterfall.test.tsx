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
import { supersetTheme } from '@apache-superset/core/theme';
import { ChartProps, SqlaFormData } from '@superset-ui/core';
import { render } from '@testing-library/react';
import EchartsWaterfall from '../../src/Waterfall/EchartsWaterfall';
import transformProps from '../../src/Waterfall/transformProps';
import { EchartsWaterfallChartProps } from '../../src/Waterfall/types';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: ({
    eventHandlers,
  }: {
    eventHandlers: Record<string, (event: unknown) => void>;
  }) => {
    mockEventHandlers = eventHandlers;
    return <div data-test="echart" />;
  },
}));

let mockEventHandlers: Record<string, (event: unknown) => void> = {};

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
    formData: formData as SqlaFormData,
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
  return { setDataMask, onContextMenu };
}

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
  const { setDataMask } = renderChart({ emitCrossFilters: true });
  mockEventHandlers.click!(pointerEvent(0));
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
  const { setDataMask } = renderChart({ emitCrossFilters: true });
  mockEventHandlers.click!(pointerEvent(2));
  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [{ col: 'year', op: 'IN', val: ['2019'] }],
      },
    }),
  );
});

test('clicking the same bar again clears the filter', () => {
  const { setDataMask } = renderChart({
    emitCrossFilters: true,
    filterState: { selectedValues: [JSON.stringify(['2019', 'Sylvester'])] },
  });
  mockEventHandlers.click!(pointerEvent(0));
  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: { filters: [] },
    }),
  );
});

test('does not emit a filter when cross-filtering is disabled', () => {
  const { setDataMask } = renderChart({ emitCrossFilters: false });
  mockEventHandlers.click!(pointerEvent(0));
  expect(setDataMask).not.toHaveBeenCalled();
});

test('clicking the grand total does not change the current filter', () => {
  const { setDataMask } = renderChart({
    emitCrossFilters: true,
    formData: { ...formData, groupby: undefined } as SqlaFormData,
  });
  mockEventHandlers.click!(pointerEvent(2));
  expect(setDataMask).not.toHaveBeenCalled();
});

test('a context menu carries the drill filters for the clicked bar', () => {
  const { onContextMenu } = renderChart({ emitCrossFilters: true });
  const event = pointerEvent(0);
  mockEventHandlers.contextmenu!(event);
  expect(event.event.stop).toHaveBeenCalled();
  expect(onContextMenu).toHaveBeenCalledWith(
    12,
    24,
    expect.objectContaining({
      drillToDetail: [
        { col: 'year', op: '==', val: '2019', formattedVal: '2019' },
        {
          col: 'name',
          op: '==',
          val: 'Sylvester',
          formattedVal: 'Sylvester',
        },
      ],
      drillBy: expect.objectContaining({
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
      }),
    }),
  );
});
