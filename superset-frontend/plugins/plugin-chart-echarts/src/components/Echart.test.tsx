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
import { render, waitFor } from '../../../../spec/helpers/testing-library';
import type { EChartsCoreOption } from 'echarts/core';
import Echart, { isReportScreenshotMode } from './Echart';
import type { EchartsProps } from '../types';

type Handler = (params: unknown) => void;
type Listener = {
  query?: string;
  handler: Handler;
};

const listeners: Record<string, Listener[]> = {};

const mockChart = {
  dispatchAction: jest.fn(),
  dispose: jest.fn(),
  getOption: jest.fn(() => ({})),
  getZr: jest.fn(() => ({
    off: jest.fn(),
    on: jest.fn(),
  })),
  off: jest.fn((name: string, handler?: Handler) => {
    if (!handler) {
      delete listeners[name];
      return;
    }
    listeners[name] = (listeners[name] || []).filter(
      listener => listener.handler !== handler,
    );
  }),
  on: jest.fn(
    (name: string, queryOrHandler: string | Handler, handler?: Handler) => {
      listeners[name] = listeners[name] || [];
      listeners[name].push(
        handler
          ? { query: queryOrHandler as string, handler }
          : { handler: queryOrHandler as Handler },
      );
    },
  ),
  resize: jest.fn(),
  setOption: jest.fn(),
};

jest.mock('echarts/core', () => ({
  init: jest.fn(() => mockChart),
  registerLocale: jest.fn(),
  use: jest.fn(),
}));

jest.mock('echarts/charts', () => ({
  BarChart: 'BarChart',
  BoxplotChart: 'BoxplotChart',
  CustomChart: 'CustomChart',
  FunnelChart: 'FunnelChart',
  GaugeChart: 'GaugeChart',
  GraphChart: 'GraphChart',
  HeatmapChart: 'HeatmapChart',
  LineChart: 'LineChart',
  PieChart: 'PieChart',
  RadarChart: 'RadarChart',
  SankeyChart: 'SankeyChart',
  ScatterChart: 'ScatterChart',
  SunburstChart: 'SunburstChart',
  TreeChart: 'TreeChart',
  TreemapChart: 'TreemapChart',
}));

jest.mock('echarts/components', () => ({
  AriaComponent: 'AriaComponent',
  DataZoomComponent: 'DataZoomComponent',
  GraphicComponent: 'GraphicComponent',
  GridComponent: 'GridComponent',
  LegendComponent: 'LegendComponent',
  MarkAreaComponent: 'MarkAreaComponent',
  MarkLineComponent: 'MarkLineComponent',
  TitleComponent: 'TitleComponent',
  ToolboxComponent: 'ToolboxComponent',
  TooltipComponent: 'TooltipComponent',
  VisualMapComponent: 'VisualMapComponent',
}));

jest.mock('echarts/features', () => ({
  LabelLayout: 'LabelLayout',
}));

jest.mock('echarts/renderers', () => ({
  CanvasRenderer: 'CanvasRenderer',
}));

const initialState = {
  common: {
    locale: 'en',
  },
  dashboardState: {
    isRefreshing: false,
  },
};

const defaultProps: EchartsProps = {
  echartOptions: { series: [] } as EChartsCoreOption,
  height: 100,
  refs: {},
  width: 100,
};

const renderEchart = (props: Partial<EchartsProps> = {}) => (
  <Echart {...defaultProps} {...props} />
);

const trigger = (name: string) => {
  (listeners[name] || []).forEach(listener => listener.handler({}));
};

const originalLocation = `${window.location.pathname}${window.location.search}`;

const setStandalone = (standalone?: string) => {
  window.history.replaceState(
    {},
    '',
    standalone === undefined ? '/' : `/?standalone=${standalone}`,
  );
};

afterEach(() => {
  window.history.replaceState({}, '', originalLocation);
});

beforeEach(() => {
  Object.keys(listeners).forEach(name => {
    delete listeners[name];
  });
  Object.values(mockChart).forEach(value => {
    if (jest.isMockFunction(value)) {
      value.mockClear();
    }
  });
});

test('replaces stale query event handlers without clearing regular event handlers', async () => {
  const regularClickHandler = jest.fn();
  const firstQueryHandler = jest.fn();
  const secondQueryHandler = jest.fn();

  const { rerender } = render(
    renderEchart({
      eventHandlers: {
        click: regularClickHandler,
      },
      queryEventHandlers: [
        {
          handler: firstQueryHandler,
          name: 'click',
          query: 'xAxis.category',
        },
      ],
    }),
    { initialState, useRedux: true },
  );

  await waitFor(() =>
    expect(mockChart.on).toHaveBeenCalledWith(
      'click',
      'xAxis.category',
      firstQueryHandler,
    ),
  );

  rerender(
    renderEchart({
      eventHandlers: {
        click: regularClickHandler,
      },
      queryEventHandlers: [
        {
          handler: secondQueryHandler,
          name: 'click',
          query: 'xAxis.category',
        },
      ],
    }),
  );

  await waitFor(() =>
    expect(mockChart.on).toHaveBeenCalledWith(
      'click',
      'xAxis.category',
      secondQueryHandler,
    ),
  );

  trigger('click');

  expect(regularClickHandler).toHaveBeenCalledTimes(1);
  expect(firstQueryHandler).not.toHaveBeenCalled();
  expect(secondQueryHandler).toHaveBeenCalledTimes(1);

  regularClickHandler.mockClear();
  secondQueryHandler.mockClear();

  rerender(
    renderEchart({
      eventHandlers: {
        click: regularClickHandler,
      },
      queryEventHandlers: [],
    }),
  );

  await waitFor(() =>
    expect(mockChart.off).toHaveBeenCalledWith('click', secondQueryHandler),
  );

  trigger('click');

  expect(regularClickHandler).toHaveBeenCalledTimes(1);
  expect(firstQueryHandler).not.toHaveBeenCalled();
  expect(secondQueryHandler).not.toHaveBeenCalled();
});

test.each([
  // Report/thumbnail screenshots render in standalone "true" (charts) or 3 (reports)
  ['true', true],
  ['3', true],
  // Live embeds use 1/2 and must keep animation
  ['1', false],
  ['2', false],
  ['0', false],
  [undefined, false],
])(
  'isReportScreenshotMode() is %p for standalone=%p',
  (standalone, expected) => {
    setStandalone(standalone);
    expect(isReportScreenshotMode()).toBe(expected);
  },
);

test('disables animation when rendering in report screenshot mode', async () => {
  setStandalone('true');
  render(renderEchart(), { initialState, useRedux: true });

  await waitFor(() => expect(mockChart.setOption).toHaveBeenCalled());

  const lastOptions = mockChart.setOption.mock.calls.at(-1)?.[0];
  expect(lastOptions.animation).toBe(false);
});

test('keeps animation enabled when not in report screenshot mode', async () => {
  setStandalone(undefined);
  render(renderEchart(), { initialState, useRedux: true });

  await waitFor(() => expect(mockChart.setOption).toHaveBeenCalled());

  const lastOptions = mockChart.setOption.mock.calls.at(-1)?.[0];
  expect(lastOptions.animation).not.toBe(false);
});
