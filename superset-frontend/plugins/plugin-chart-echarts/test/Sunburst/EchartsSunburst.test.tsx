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
import { render } from '../../../../spec/helpers/testing-library';
import EchartsSunburst from '../../src/Sunburst/EchartsSunburst';
import Echart from '../../src/components/Echart';
import { EventHandlers } from '../../src/types';
import {
  EchartsSunburstFormData,
  SunburstTransformedProps,
} from '../../src/Sunburst/types';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

// 2003-10-01T00:00:00Z, the start of the month bucket a monthly grain returns.
const OCTOBER_2003 = 1064966400000;

const rightClickOctoberClassicCars = (formData: Record<string, unknown>) => {
  mockedEchart.mockClear();
  const onContextMenu = jest.fn();
  const props = {
    echartOptions: {},
    formData: {
      columns: ['order_date', 'product_line'],
      dateFormat: 'smart_date',
      numberFormat: 'SMART_NUMBER',
      vizType: 'sunburst_v2',
      ...formData,
    } as unknown as EchartsSunburstFormData,
    height: 400,
    width: 400,
    refs: {},
    selectedValues: {},
    setDataMask: jest.fn(),
    emitCrossFilters: false,
    coltypeMapping: {},
    onContextMenu,
  } as unknown as SunburstTransformedProps;

  render(<EchartsSunburst {...props} />);

  const lastCall = mockedEchart.mock.calls[mockedEchart.mock.calls.length - 1];
  const { eventHandlers } = lastCall[0] as { eventHandlers: EventHandlers };
  eventHandlers.contextmenu({
    data: { records: [OCTOBER_2003, 'Classic Cars'] },
    treePathInfo: [
      { name: '', dataIndex: 0, value: 100 },
      { name: 'October', dataIndex: 1, value: 60 },
      { name: 'Classic Cars', dataIndex: 2, value: 40 },
    ],
    event: { stop: jest.fn(), event: { clientX: 10, clientY: 20 } },
  });
  return onContextMenu.mock.calls[0][2].drillToDetail;
};

test('drill to detail on a grained temporal level filters the whole time bucket', () => {
  expect(
    rightClickOctoberClassicCars({
      timeGrainSqla: 'P1M',
      temporalColumnsLookup: { order_date: true },
    }),
  ).toEqual([
    {
      col: 'order_date',
      op: '==',
      val: OCTOBER_2003,
      formattedVal: 'October',
      grain: 'P1M',
    },
    {
      col: 'product_line',
      op: '==',
      val: 'Classic Cars',
      formattedVal: 'Classic Cars',
    },
  ]);
});

test('drill to detail uses the dashboard time grain over the saved one', () => {
  const [temporalFilter] = rightClickOctoberClassicCars({
    timeGrainSqla: 'P1M',
    granularitySqla: 'order_date',
    extraFormData: { time_grain_sqla: 'P1Y' },
  });
  expect(temporalFilter.grain).toBe('P1Y');
});

test('drill to detail adds no grain to raw temporal or categorical levels', () => {
  const ungrained = [
    {},
    { timeGrainSqla: 'P1M' },
    { temporalColumnsLookup: { order_date: true } },
    {
      timeGrainSqla: 'P1M',
      temporalColumnsLookup: { order_date: true },
      columns: [
        { expressionType: 'SQL', sqlExpression: 'order_date', label: 'od' },
        'product_line',
      ],
    },
  ];
  ungrained.forEach(formData =>
    rightClickOctoberClassicCars(formData).forEach(
      (filter: Record<string, unknown>) =>
        expect(filter).not.toHaveProperty('grain'),
    ),
  );
});
