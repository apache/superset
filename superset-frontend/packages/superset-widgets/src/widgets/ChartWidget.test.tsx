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
import { dashboard as dashboardApi } from '@apache-superset/core';
import { fireEvent, render, waitFor } from 'spec/helpers/testing-library';
import { WidgetBusContext, createWidgetBus } from '../bus';
import { WidgetDataClientContext } from '../dataClient';
import type { WidgetBus, WidgetDataClient } from '../types';
import ChartWidget from './ChartWidget';

const mockSetOption = jest.fn();
const mockOn = jest.fn();

jest.mock('echarts/core', () => ({
  __esModule: true,
  use: jest.fn(),
  init: jest.fn(() => ({
    setOption: mockSetOption,
    resize: jest.fn(),
    dispose: jest.fn(),
    on: mockOn,
  })),
}));

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

const fetchData = jest.fn();
const client: WidgetDataClient = { fetchData, fetchValues: jest.fn() };
let bus: WidgetBus;

beforeEach(() => {
  bus = createWidgetBus();
  mockSetOption.mockClear();
  mockOn.mockClear();
  fetchData.mockReset();
  fetchData.mockResolvedValue({
    columns: ['x', 'y'],
    rows: [{ x: 'a', y: 1 }],
  });
});

const INSTANCE = 'chart_1';

const renderChart = (props: Record<string, unknown>, savedId?: string) =>
  render(
    <WidgetBusContext.Provider value={bus}>
      <WidgetDataClientContext.Provider value={client}>
        <ChartWidget instanceId={INSTANCE} props={props} savedId={savedId} />
      </WidgetDataClientContext.Provider>
    </WidgetBusContext.Provider>,
  );

function click(params: { name: string }) {
  const [, handler] = mockOn.mock.calls.find(([event]) => event === 'click')!;
  handler(params);
}

test('a chart does not draw the title its surrounding header carries', async () => {
  renderChart({
    dataBinding: { datasetId: 1, metrics: [] },
    echartsOptions: {
      title: { text: 'Sales by Territory' },
      series: [{ type: 'bar' }],
    },
  });

  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  const [option] = mockSetOption.mock.calls[0];
  expect(option).not.toHaveProperty('title');
  expect(option).toHaveProperty('series');
});

test('the query goes through the data client as an inline widget, or by saved id', async () => {
  const props = { dataBinding: { datasetId: 1, metrics: ['count'] } };
  const { unmount } = renderChart(props);
  await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
  expect(fetchData).toHaveBeenLastCalledWith({
    instanceId: INSTANCE,
    widget: { type: 'echarts', props },
    filters: [],
  });
  unmount();

  renderChart(props, 'saved-uuid');
  await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(2));
  expect(fetchData).toHaveBeenLastCalledWith({
    instanceId: INSTANCE,
    widget: { id: 'saved-uuid', type: 'echarts', props },
    filters: [],
  });
});

test('an existing raw-only echarts widget (no chartType) renders exactly as before', async () => {
  const rawSeries = [{ type: 'pie', data: [{ name: 'a', value: 1 }] }];
  renderChart({
    dataBinding: { datasetId: 1, metrics: [] },
    echartsOptions: { legend: { show: true }, series: rawSeries },
  });

  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  const [option] = mockSetOption.mock.calls[0];
  expect(option.series).toEqual(rawSeries);
  expect(option.legend).toEqual({ show: true });
});

test('selecting a structured chart type replaces series with one generated per metric', async () => {
  fetchData.mockResolvedValue({
    columns: ['count'],
    rows: [{ count: 3 }, { count: 5 }],
  });
  renderChart({
    dataBinding: { datasetId: 1, metrics: ['count'] },
    echartsOptions: {
      legend: { show: true },
      series: [{ type: 'pie', data: [] }],
    },
    chartType: 'bar',
  });

  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  const [option] = mockSetOption.mock.calls[0];
  expect(option.legend).toEqual({ show: true });
  expect(option.series).toEqual([
    {
      name: 'count',
      type: 'bar',
      data: [3, 5],
      itemStyle: { color: '#e74c3c' },
    },
  ]);
});

test('structured chrome applies alongside raw echartsOptions, independent of chartType', async () => {
  renderChart({
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
  });

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

const DATASET_ID = 42;

const crossFilterProps = (crossFilter: boolean | undefined) => ({
  crossFilter,
  dataBinding: { datasetId: DATASET_ID, dimensions: ['region'], metrics: [] },
  echartsOptions: { series: [{ type: 'bar' }] },
});

test('clicking a data point does nothing when crossFilter is not enabled', async () => {
  renderChart(crossFilterProps(undefined));
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  click({ name: 'west' });

  expect(
    bus.getValue(INSTANCE, dashboardApi.VALUE_CHANGED_EVENT),
  ).toBeUndefined();
});

test('clicking a data point emits a resolved filter naming the first dimension', async () => {
  renderChart(crossFilterProps(true));
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  click({ name: 'west' });

  expect(bus.getValue(INSTANCE, dashboardApi.VALUE_CHANGED_EVENT)).toEqual({
    selection: 'west',
    resolved: {
      column: 'region',
      operator: 'EQUALS',
      value: 'west',
      datasource: DATASET_ID,
    },
  });
});

test('clicking the same point again clears the cross-filter', async () => {
  renderChart(crossFilterProps(true));
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  click({ name: 'west' });
  click({ name: 'west' });

  expect(bus.getValue(INSTANCE, dashboardApi.VALUE_CHANGED_EVENT)).toEqual({
    selection: null,
    resolved: null,
  });
});

test('another source on the same dataset narrows the query', async () => {
  renderChart({ dataBinding: { datasetId: DATASET_ID, metrics: ['count'] } });
  await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));

  bus.emit('host:region', dashboardApi.VALUE_CHANGED_EVENT, {
    selection: 'west',
    resolved: {
      column: 'region',
      operator: 'EQUALS',
      value: 'west',
      datasource: DATASET_ID,
    },
  });

  await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(2));
  expect(fetchData.mock.calls[1][0].filters).toEqual([
    { column: 'region', operator: 'EQUALS', value: 'west', datasource: 42 },
  ]);
});

test('a click still bubbles normally when crossFilter is off', async () => {
  const onAncestorClick = jest.fn();
  const { getByTestId } = render(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div onClick={onAncestorClick}>
      <WidgetBusContext.Provider value={bus}>
        <WidgetDataClientContext.Provider value={client}>
          <ChartWidget
            instanceId={INSTANCE}
            props={crossFilterProps(undefined)}
          />
        </WidgetDataClientContext.Provider>
      </WidgetBusContext.Provider>
    </div>,
  );
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  fireEvent.click(getByTestId(`chart-${INSTANCE}`));

  expect(onAncestorClick).toHaveBeenCalledTimes(1);
});

test('a cross-filter-enabled chart excludes itself from drag-start detection', async () => {
  const { getByTestId } = renderChart(crossFilterProps(true));
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  expect(getByTestId(`chart-${INSTANCE}`)).toHaveAttribute(
    'data-widget-interactive',
  );
});
