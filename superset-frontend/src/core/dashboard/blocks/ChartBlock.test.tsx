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
import ChartBlock from './ChartBlock';

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
});

test('a chart does not draw the name its header already carries', async () => {
  const id = provider.addBuildingBlock(provider.getRoot().id, 0, {
    type: 'echarts',
    props: {
      dataBinding: { datasource: 1, columns: ['x'], metrics: [] },
      echartsOptions: {
        title: { text: 'Sales by Territory' },
        series: [{ type: 'bar' }],
      },
    },
  });
  render(<ChartBlock nodeId={id} />);

  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  // `blockLabel` reads the title out of this same option to name the block,
  // so leaving it here would print the chart's name twice, at two sizes, in
  // two places. The rest of the option has to survive untouched.
  const [option] = mockSetOption.mock.calls[0];
  expect(option).not.toHaveProperty('title');
  expect(option).toHaveProperty('series');
});
