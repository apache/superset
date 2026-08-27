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

/**
 * End-to-end check, across the two real widgets rather than
 * `collectActiveFilters.ts` in isolation: a standalone `filter.select`
 * picking a value must cause a sibling `echarts` widget on the same dataset
 * to actually re-fetch with that value included — the exact path a report
 * flagged as broken ("no new request at all") while the equivalent
 * chart-cross-filter path kept working.
 */
import {
  fireEvent,
  render,
  screen,
  selectOption,
  waitFor,
} from 'spec/helpers/testing-library';
import DashboardProvider from '../DashboardProvider';
import { registerBuiltInWidgets } from '../registerBuiltInWidgets';
import FilterSelectWidget from './FilterSelectWidget';
import FilterBarWidget from './FilterBarWidget';
import ChartWidget from './ChartWidget';

interface FakeBinding {
  filters?: unknown[];
}

const mockFetchQueryData = jest.fn(async (_binding: FakeBinding) => ({
  rows: [{ x: 'a', y: 1 }],
}));

jest.mock('echarts/core', () => ({
  __esModule: true,
  use: jest.fn(),
  init: jest.fn(() => ({
    setOption: jest.fn(),
    resize: jest.fn(),
    dispose: jest.fn(),
    on: jest.fn(),
  })),
}));

jest.mock('../chartData', () => ({
  __esModule: true,
  fetchQueryData: (binding: FakeBinding) => mockFetchQueryData(binding),
}));

beforeAll(() => {
  registerBuiltInWidgets();
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
  mockFetchQueryData.mockClear();
});

const DATASET_ID = 7;
const COLUMN = 'region';

test('picking a standalone filter value re-fetches a sibling chart on the same dataset', async () => {
  const rootId = provider.getRoot().id;
  const filterId = provider.addWidget(rootId, 0, {
    type: 'filter.select',
    props: { datasetId: DATASET_ID, column: COLUMN, options: ['east', 'west'] },
  });
  const chartId = provider.addWidget(rootId, 1, {
    type: 'echarts',
    props: {
      dataBinding: { datasetId: DATASET_ID, metrics: ['count'] },
      echartsOptions: { series: [{ type: 'bar' }] },
    },
  });

  render(
    <>
      <FilterSelectWidget nodeId={filterId} />
      <ChartWidget nodeId={chartId} />
    </>,
  );

  await waitFor(() => expect(mockFetchQueryData).toHaveBeenCalledTimes(1));
  const initialFilters = mockFetchQueryData.mock.calls[0]?.[0]?.filters;
  expect(JSON.stringify(initialFilters ?? [])).not.toContain('west');

  await selectOption('west', `Filter by ${COLUMN}`);

  await waitFor(() => expect(mockFetchQueryData).toHaveBeenCalledTimes(2));
  const refetchedFilters = mockFetchQueryData.mock.calls[1]?.[0]?.filters;
  expect(JSON.stringify(refetchedFilters)).toContain('west');
});

test('a filter inside a filter.bar reaches a sibling chart once Apply is clicked', async () => {
  const rootId = provider.getRoot().id;
  const barId = provider.addWidget(rootId, 0, { type: 'filter.bar' });
  provider.addWidget(barId, 0, {
    type: 'filter.select',
    props: { datasetId: DATASET_ID, column: COLUMN, options: ['east', 'west'] },
  });
  const chartId = provider.addWidget(rootId, 1, {
    type: 'echarts',
    props: {
      dataBinding: { datasetId: DATASET_ID, metrics: ['count'] },
      echartsOptions: { series: [{ type: 'bar' }] },
    },
  });

  render(
    <>
      <FilterBarWidget nodeId={barId} />
      <ChartWidget nodeId={chartId} />
    </>,
  );

  await waitFor(() => expect(mockFetchQueryData).toHaveBeenCalledTimes(1));

  await selectOption('west', `Filter by ${COLUMN}`);
  // Picking a value inside a bar only stages it — no refetch yet.
  expect(mockFetchQueryData).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByTestId(`filter-bar-apply-${barId}`));

  await waitFor(() => expect(mockFetchQueryData).toHaveBeenCalledTimes(2));
  const refetchedFilters = mockFetchQueryData.mock.calls[1]?.[0]?.filters;
  expect(JSON.stringify(refetchedFilters)).toContain('west');
});
