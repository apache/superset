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
import DashboardProvider from '../DashboardProvider';
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

jest.mock('../chartData', () => ({
  __esModule: true,
  fetchQueryData: jest.fn(async () => ({ rows: [{ x: 'a', y: 1 }] })),
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
  mockOn.mockClear();
});

/** The click handler `EchartsCanvas` registered on the (mocked) chart instance — simulates a data-point click by calling it directly. */
function click(params: { name: string }) {
  const [, handler] = mockOn.mock.calls.find(([event]) => event === 'click')!;
  handler(params);
}

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

const DATASET_ID = 42;

const createCrossFilterChart = (crossFilter: boolean | undefined) =>
  provider.addWidget(provider.getRoot().id, 0, {
    type: 'echarts',
    props: {
      crossFilter,
      dataBinding: {
        datasetId: DATASET_ID,
        dimensions: ['region'],
        metrics: [],
      },
      echartsOptions: { series: [{ type: 'bar' }] },
    },
  });

test('clicking a data point does nothing when crossFilter is not enabled', async () => {
  const id = createCrossFilterChart(undefined);
  render(<ChartWidget nodeId={id} />);
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  click({ name: 'west' });

  expect(
    provider.getValue(id, dashboardApi.VALUE_CHANGED_EVENT),
  ).toBeUndefined();
});

test('clicking a data point emits a resolved filter naming the first dimension', async () => {
  const id = createCrossFilterChart(true);
  render(<ChartWidget nodeId={id} />);
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  click({ name: 'west' });

  expect(provider.getValue(id, dashboardApi.VALUE_CHANGED_EVENT)).toEqual({
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
  const id = createCrossFilterChart(true);
  render(<ChartWidget nodeId={id} />);
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  click({ name: 'west' });
  click({ name: 'west' });

  expect(provider.getValue(id, dashboardApi.VALUE_CHANGED_EVENT)).toEqual({
    selection: null,
    resolved: null,
  });
});

test('a click still bubbles normally when crossFilter is off', async () => {
  const id = createCrossFilterChart(undefined);
  const onAncestorClick = jest.fn();
  const { getByTestId } = render(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div onClick={onAncestorClick}>
      <ChartWidget nodeId={id} />
    </div>,
  );
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  fireEvent.click(getByTestId(`chart-${id}`));

  // A plain chart is still an ordinary selectable widget — only a
  // cross-filter-enabled one gets its click kept local.
  expect(onAncestorClick).toHaveBeenCalledTimes(1);
});

test("a cross-filter-enabled chart excludes itself from the grid's own drag-start detection", async () => {
  const id = createCrossFilterChart(true);
  const { getByTestId } = render(<ChartWidget nodeId={id} />);
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  // RootGrid's own GridStack instance treats a press anywhere in a widget
  // as a potential drag unless the target matches its cancel selector
  // (see RootGrid.tsx's `cancelSelectorFor`) — without this attribute, a
  // data-point click never reaches ECharts' own click detection at all,
  // drag or not.
  expect(getByTestId(`chart-${id}`)).toHaveAttribute('data-widget-interactive');
});

test('a plain chart does not claim the drag-cancel attribute it has no need for', async () => {
  const id = createCrossFilterChart(undefined);
  const { getByTestId } = render(<ChartWidget nodeId={id} />);
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  expect(getByTestId(`chart-${id}`)).not.toHaveAttribute(
    'data-widget-interactive',
  );
});
