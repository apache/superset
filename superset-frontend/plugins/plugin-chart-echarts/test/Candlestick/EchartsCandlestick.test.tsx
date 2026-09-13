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
import EchartsCandlestick from '../../src/Candlestick/EchartsCandlestick';
import transformProps from '../../src/Candlestick/transformProps';
import { EchartsCandlestickChartProps } from '../../src/Candlestick/types';
import Echart from '../../src/components/Echart';
import { EventHandlers } from '../../src/types';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

beforeEach(() => {
  mockedEchart.mockClear();
});

test('forwards legend selection changes', () => {
  const onLegendStateChanged = jest.fn();
  const selected = { Candlestick: false };
  const transformed = transformProps(
    new ChartProps({
      formData: {
        datasource: '3__table',
        x_axis: 'date',
        open: 'open',
        close: 'close',
        high: 'high',
        low: 'low',
        moving_averages: [],
      },
      width: 800,
      height: 600,
      queriesData: [
        {
          data: [
            { date: '2017-10-24', open: 20, close: 34, low: 10, high: 38 },
          ],
        },
      ],
      theme: supersetTheme,
      hooks: { onLegendStateChanged },
    }) as unknown as EchartsCandlestickChartProps,
  );

  render(
    <EchartsCandlestick
      {...transformed}
      onLegendStateChanged={onLegendStateChanged}
    />,
  );

  const { eventHandlers } = mockedEchart.mock.calls[0][0] as {
    eventHandlers: EventHandlers;
  };
  eventHandlers.legendselectchanged({ selected });
  eventHandlers.legendselectall({ selected });
  eventHandlers.legendinverseselect({ selected });

  expect(onLegendStateChanged).toHaveBeenCalledTimes(3);
  expect(onLegendStateChanged).toHaveBeenCalledWith(selected);
});
