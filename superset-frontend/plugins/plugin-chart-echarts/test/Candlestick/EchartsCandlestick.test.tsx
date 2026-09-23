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

test('opens drill-to-detail with x-axis and series filters on right-click', () => {
  const onContextMenu = jest.fn();
  const transformed = transformProps(
    new ChartProps({
      formData: {
        datasource: '3__table',
        x_axis: 'date',
        open: 'open',
        close: 'close',
        high: 'high',
        low: 'low',
        series: 'symbol',
        moving_averages: [],
      },
      width: 800,
      height: 600,
      queriesData: [
        {
          data: [
            {
              date: '2017-10-24',
              symbol: 'AAPL',
              open: 20,
              close: 34,
              low: 10,
              high: 38,
            },
          ],
        },
      ],
      theme: supersetTheme,
      hooks: { onContextMenu },
    }) as unknown as EchartsCandlestickChartProps,
  );

  render(<EchartsCandlestick {...transformed} onContextMenu={onContextMenu} />);

  const { eventHandlers } = mockedEchart.mock.calls[0][0] as {
    eventHandlers: EventHandlers;
  };
  const stop = jest.fn();
  eventHandlers.contextmenu({
    event: { stop, event: { clientX: 12, clientY: 34 } },
    dataIndex: 0,
    seriesName: 'AAPL',
    seriesType: 'candlestick',
  });

  expect(stop).toHaveBeenCalled();
  expect(onContextMenu).toHaveBeenCalledWith(
    12,
    34,
    expect.objectContaining({
      drillToDetail: [
        expect.objectContaining({ col: 'date', val: '2017-10-24' }),
        expect.objectContaining({ col: 'symbol', val: 'AAPL' }),
      ],
    }),
  );
});

test('emits IS NULL when drill-to-detail hits a null x-category', () => {
  const onContextMenu = jest.fn();
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
          data: [{ date: null, open: 20, close: 34, low: 10, high: 38 }],
        },
      ],
      theme: supersetTheme,
      hooks: { onContextMenu },
    }) as unknown as EchartsCandlestickChartProps,
  );

  render(<EchartsCandlestick {...transformed} onContextMenu={onContextMenu} />);

  const { eventHandlers } = mockedEchart.mock.calls[0][0] as {
    eventHandlers: EventHandlers;
  };
  eventHandlers.contextmenu({
    event: { stop: jest.fn(), event: { clientX: 12, clientY: 34 } },
    dataIndex: 0,
    seriesType: 'candlestick',
  });

  expect(onContextMenu).toHaveBeenCalledWith(
    12,
    34,
    expect.objectContaining({
      drillToDetail: [expect.objectContaining({ col: 'date', op: 'IS NULL' })],
    }),
  );
});
