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
import EchartsBubble from '../../src/Bubble/EchartsBubble';
import transformProps from '../../src/Bubble/transformProps';
import { EchartsBubbleChartProps } from '../../src/Bubble/types';
import Echart from '../../src/components/Echart';
import { EventHandlers } from '../../src/types';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

const formData: SqlaFormData = {
  datasource: '1__table',
  viz_type: 'bubble_v2',
  entity: 'customer_name',
  x: 'count',
  y: 'price',
  size: 'sales',
};

const queriesData = [
  {
    data: [
      {
        customer_name: 'AV Stores, Co.',
        status: 'open',
        count: 10,
        price: 20,
        sales: 30,
      },
      {
        customer_name: 'Alpha Cognac',
        status: 'closed',
        count: 40,
        price: 50,
        sales: 60,
      },
    ],
  },
];

function setup(
  overrides: {
    emitCrossFilters?: boolean;
    filterState?: { selectedValues?: string[] | null };
    series?: string;
  } = {},
) {
  const onContextMenu = jest.fn();
  const setDataMask = jest.fn();
  const chartProps = {
    ...new ChartProps({
      formData: {
        ...formData,
        ...(overrides.series ? { series: overrides.series } : {}),
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
  } as unknown as EchartsBubbleChartProps;

  const transformed = transformProps(chartProps);
  render(
    <EchartsBubble
      {...transformed}
      onContextMenu={onContextMenu}
      setDataMask={setDataMask}
      emitCrossFilters={overrides.emitCrossFilters ?? true}
      filterState={overrides.filterState ?? {}}
    />,
  );

  const lastCall = mockedEchart.mock.calls[mockedEchart.mock.calls.length - 1];
  const { eventHandlers } = lastCall[0] as { eventHandlers: EventHandlers };
  return { eventHandlers, onContextMenu, setDataMask };
}

beforeEach(() => {
  mockedEchart.mockClear();
});

test('click emits a cross-filter on the bubble entity', () => {
  const { eventHandlers, setDataMask } = setup();

  eventHandlers.click({
    data: [40, 50, 60, 'Alpha Cognac', null],
  });

  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: {
      filters: [{ col: 'customer_name', op: 'IN', val: ['Alpha Cognac'] }],
    },
    filterState: {
      value: ['Alpha Cognac'],
      selectedValues: ['Alpha Cognac'],
    },
  });
});

test('click clears the cross-filter when the same bubble is already selected', () => {
  const { eventHandlers, setDataMask } = setup({
    filterState: { selectedValues: ['Alpha Cognac'] },
  });

  eventHandlers.click({
    data: [40, 50, 60, 'Alpha Cognac', null],
  });

  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: { filters: [] },
    filterState: {
      value: null,
      selectedValues: null,
    },
  });
});

test('click does not emit a cross-filter when cross-filtering is disabled', () => {
  const { eventHandlers, setDataMask } = setup({ emitCrossFilters: false });

  eventHandlers.click({
    data: [10, 20, 30, 'AV Stores, Co.', null],
  });

  expect(setDataMask).not.toHaveBeenCalled();
});

test('click filters by entity and series when a series dimension is set', () => {
  const { eventHandlers, setDataMask } = setup({ series: 'status' });

  eventHandlers.click({
    data: [10, 20, 30, 'AV Stores, Co.', 'open'],
  });

  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: {
      filters: [
        { col: 'customer_name', op: 'IN', val: ['AV Stores, Co.'] },
        { col: 'status', op: 'IN', val: ['open'] },
      ],
    },
    filterState: {
      value: ['AV Stores, Co.\0open'],
      selectedValues: ['AV Stores, Co.\0open'],
    },
  });
});

test('click filters null entity values with IS NULL', () => {
  const { eventHandlers, setDataMask } = setup();

  eventHandlers.click({
    data: [10, 20, 30, null, null],
  });

  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: {
      filters: [{ col: 'customer_name', op: 'IS NULL' }],
    },
    filterState: {
      value: ['<NULL>'],
      selectedValues: ['<NULL>'],
    },
  });
});

test('context menu exposes cross-filter, drill to detail, and drill by', () => {
  const { eventHandlers, onContextMenu } = setup({ series: 'status' });

  eventHandlers.contextmenu({
    data: [10, 20, 30, 'AV Stores, Co.', 'open'],
    event: { stop: jest.fn(), event: { clientX: 12, clientY: 24 } },
  });

  expect(onContextMenu).toHaveBeenCalledTimes(1);
  const [[x, y, payload]] = onContextMenu.mock.calls;
  expect(x).toBe(12);
  expect(y).toBe(24);
  expect(payload.drillToDetail).toEqual([
    expect.objectContaining({
      col: 'customer_name',
      op: '==',
      val: 'AV Stores, Co.',
      formattedVal: 'AV Stores, Co.',
    }),
    expect.objectContaining({
      col: 'status',
      op: '==',
      val: 'open',
      formattedVal: 'open',
    }),
  ]);
  expect(payload.drillBy).toEqual({
    filters: payload.drillToDetail,
    groupbyFieldName: 'entity',
  });
  expect(payload.crossFilter.dataMask.extraFormData.filters).toEqual([
    { col: 'customer_name', op: 'IN', val: ['AV Stores, Co.'] },
    { col: 'status', op: 'IN', val: ['open'] },
  ]);
  expect(payload.crossFilter.isCurrentValueSelected).toBe(false);
});
