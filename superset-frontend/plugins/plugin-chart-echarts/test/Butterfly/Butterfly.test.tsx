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
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import Butterfly from '../../src/Butterfly/Butterfly';
import transformProps from '../../src/Butterfly/transformProps';
import { EchartsButterflyChartProps } from '../../src/Butterfly/types';
import Echart from '../../src/components/Echart';
import { EventHandlers } from '../../src/types';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

const data = [
  { category: 'A', left_sum: 10, right_sum: 25 },
  { category: 'B', left_sum: 5, right_sum: 19 },
];

const categoryKeyA = 'A__["A"]';
const categoryKeyB = 'B__["B"]';

function setup(
  overrides: {
    filterState?: { selectedValues?: string[] };
    onLegendStateChanged?: jest.Mock;
  } = {},
) {
  const onContextMenu = jest.fn();
  const setDataMask = jest.fn();
  const onLegendStateChanged = overrides.onLegendStateChanged ?? jest.fn();
  const chartProps = {
    ...new ChartProps({
      formData: {
        groupby: ['category'],
        left_metric: 'left_sum',
        right_metric: 'right_sum',
        viz_type: 'butterfly',
      },
      width: 800,
      height: 600,
      queriesData: [{ data }],
      theme: supersetTheme,
      hooks: { onContextMenu, setDataMask, onLegendStateChanged },
    }),
    filterState: overrides.filterState ?? {},
    emitCrossFilters: true,
  } as unknown as EchartsButterflyChartProps;

  const transformed = transformProps(chartProps);
  render(
    <Butterfly
      {...transformed}
      onContextMenu={onContextMenu}
      setDataMask={setDataMask}
      onLegendStateChanged={onLegendStateChanged}
      emitCrossFilters
    />,
  );

  const lastCall = mockedEchart.mock.calls[mockedEchart.mock.calls.length - 1];
  const { eventHandlers, selectedValues } = lastCall[0] as {
    eventHandlers: EventHandlers;
    selectedValues: Record<number, string>;
  };
  return {
    eventHandlers,
    onContextMenu,
    setDataMask,
    onLegendStateChanged,
    selectedValues,
  };
}

beforeEach(() => {
  mockedEchart.mockClear();
});

test('context menu exposes drill to detail for the selected category', () => {
  const { eventHandlers, onContextMenu } = setup();

  eventHandlers.contextmenu({
    name: 'A',
    data: { name: categoryKeyA },
    event: { stop: jest.fn(), event: { clientX: 10, clientY: 20 } },
  });

  expect(onContextMenu).toHaveBeenCalledTimes(1);
  const [x, y, payload] = onContextMenu.mock.calls[0];
  expect(x).toBe(10);
  expect(y).toBe(20);
  expect(payload.drillToDetail).toEqual([
    expect.objectContaining({
      col: 'category',
      op: '==',
      val: 'A',
      formattedVal: 'A',
    }),
  ]);
});

test('context menu exposes drill by for the selected category', () => {
  const { eventHandlers, onContextMenu } = setup();

  eventHandlers.contextmenu({
    name: 'A',
    data: { name: categoryKeyA },
    event: { stop: jest.fn(), event: { clientX: 10, clientY: 20 } },
  });

  const payload = onContextMenu.mock.calls[0][2];
  expect(payload.drillBy).toEqual({
    filters: [
      expect.objectContaining({
        col: 'category',
        op: '==',
        val: 'A',
        formattedVal: 'A',
      }),
    ],
    groupbyFieldName: 'groupby',
  });
});

test('click emits cross-filter for the selected category', () => {
  const { eventHandlers, setDataMask } = setup();

  eventHandlers.click({ name: 'B', data: { name: categoryKeyB } });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [{ col: 'category', op: 'IN', val: ['B'] }],
      },
      filterState: {
        value: [['B']],
        selectedValues: [categoryKeyB],
      },
    }),
  );
});

test('click clears cross-filter when the category is already selected', () => {
  const { eventHandlers, setDataMask } = setup({
    filterState: { selectedValues: [categoryKeyB] },
  });

  eventHandlers.click({ name: 'B', data: { name: categoryKeyB } });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [],
      },
      filterState: {
        value: null,
        selectedValues: null,
      },
    }),
  );
});

test('legend selection forwards legend state to the chart hook', () => {
  const onLegendStateChanged = jest.fn();
  const { eventHandlers } = setup({ onLegendStateChanged });
  const selected = { left_sum: true, right_sum: false };

  eventHandlers.legendselectchanged({ selected });
  eventHandlers.legendselectall({ selected });
  eventHandlers.legendinverseselect({ selected });

  expect(onLegendStateChanged).toHaveBeenCalledTimes(3);
  expect(onLegendStateChanged).toHaveBeenCalledWith(selected);
});

test('passes selectedValues through to the chart component', () => {
  const { selectedValues } = setup({
    filterState: { selectedValues: [categoryKeyA] },
  });

  expect(selectedValues).toEqual({ 0: categoryKeyA });
});
