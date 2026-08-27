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
import { render, waitFor } from 'spec/helpers/testing-library';
import DashboardProvider from '../DashboardProvider';
import ChartWidget from './ChartWidget';

const mockSetOption = jest.fn();

jest.mock('echarts/core', () => ({
  __esModule: true,
  use: jest.fn(),
  init: jest.fn(() => ({
    setOption: mockSetOption,
    resize: jest.fn(),
    dispose: jest.fn(),
  })),
}));

const mockFetchQueryData = jest.fn(async () => ({
  rows: [{ x: 'a', y: 1 }] as Record<string, unknown>[],
}));

jest.mock('../chartData', () => ({
  __esModule: true,
  fetchQueryData: () => mockFetchQueryData(),
}));

/**
 * The stock test double never calls back, so nothing this component draws is
 * ever measured. ECharts has no self-sizing — it draws what it is told to
 * resize to — so a size has to arrive for the canvas to exist at all.
 */
beforeAll(() => {
  window.ResizeObserver = class {
    constructor(private callback: ResizeObserverCallback) {}

    observe() {
      this.callback(
        [{ contentRect: { width: 400, height: 300 } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }

    unobserve() {}

    disconnect() {}
  };
});

const provider = DashboardProvider.getInstance();

beforeEach(() => {
  provider.reset();
  mockSetOption.mockClear();
  mockFetchQueryData.mockClear();
  mockFetchQueryData.mockResolvedValue({ rows: [{ x: 'a', y: 1 }] });
});

test('a chart does not draw the name its header already carries', async () => {
  const id = provider.addWidget(provider.getRoot().id, 0, {
    type: 'echarts',
    props: {
      dataBinding: { datasource: 1, columns: ['x'], metrics: [] },
      echartsOptions: {
        title: { text: 'Sales by Territory' },
        series: [{ type: 'bar' }],
      },
    },
  });
  render(<ChartWidget nodeId={id} />);

  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  // `widgetLabel` reads the title out of this same option to name the widget,
  // so leaving it here would print the chart's name twice, at two sizes, in
  // two places. The rest of the option has to survive untouched.
  const [option] = mockSetOption.mock.calls[0];
  expect(option).not.toHaveProperty('title');
  expect(option).toHaveProperty('series');
});

test('an existing raw-only echarts widget (no chartType) renders exactly as before', async () => {
  const rawSeries = [{ type: 'pie', data: [{ name: 'a', value: 1 }] }];
  const id = provider.addWidget(provider.getRoot().id, 0, {
    type: 'echarts',
    props: {
      dataBinding: { datasetId: 1, metrics: [] },
      echartsOptions: { legend: { show: true }, series: rawSeries },
    },
  });
  render(<ChartWidget nodeId={id} />);

  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  const [option] = mockSetOption.mock.calls[0];
  expect(option.series).toEqual(rawSeries);
  expect(option.legend).toEqual({ show: true });
});

test('selecting a structured chart type replaces series with one generated per metric', async () => {
  mockFetchQueryData.mockResolvedValue({ rows: [{ count: 3 }, { count: 5 }] });
  const id = provider.addWidget(provider.getRoot().id, 0, {
    type: 'echarts',
    props: {
      dataBinding: { datasetId: 1, metrics: ['count'] },
      echartsOptions: {
        legend: { show: true },
        series: [{ type: 'pie', data: [] }],
      },
      chartType: 'bar',
    },
  });
  render(<ChartWidget nodeId={id} />);

  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  const [option] = mockSetOption.mock.calls[0];
  // The structured layer only manages `series` — everything else the raw
  // option authored survives unmanaged.
  expect(option.legend).toEqual({ show: true });
  expect(option.series).toEqual([{ name: 'count', type: 'bar', data: [3, 5] }]);
});

test('a series override is applied by stable metric key when chartType is set', async () => {
  mockFetchQueryData.mockResolvedValue({ rows: [{ count: 3 }] });
  const id = provider.addWidget(provider.getRoot().id, 0, {
    type: 'echarts',
    props: {
      dataBinding: { datasetId: 1, metrics: ['count'] },
      echartsOptions: {},
      chartType: 'line',
      customize: {
        series: { count: { color: '#3498db', displayName: 'Total' } },
      },
    },
  });
  render(<ChartWidget nodeId={id} />);

  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  const [option] = mockSetOption.mock.calls[0];
  expect(option.series).toEqual([
    {
      name: 'Total',
      type: 'line',
      data: [3],
      itemStyle: { color: '#3498db' },
    },
  ]);
});

test('structured chrome (legend/tooltip/axis) applies alongside raw echartsOptions, independent of chartType', async () => {
  const id = provider.addWidget(provider.getRoot().id, 0, {
    type: 'echarts',
    props: {
      dataBinding: { datasetId: 1, metrics: [] },
      echartsOptions: {
        xAxis: { type: 'category', axisLabel: { color: 'red' } },
      },
      chrome: {
        legendShow: false,
        tooltipTrigger: 'axis',
        xAxisName: 'Product',
        xAxisRotate: 45,
      },
    },
  });
  render(<ChartWidget nodeId={id} />);

  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  const [option] = mockSetOption.mock.calls[0];
  expect(option.legend).toEqual({ show: false });
  expect(option.tooltip).toEqual({ trigger: 'axis' });
  expect(option.xAxis).toEqual({
    type: 'category',
    name: 'Product',
    axisLabel: { color: 'red', rotate: 45 },
  });
});
