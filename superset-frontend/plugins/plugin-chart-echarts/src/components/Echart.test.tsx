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
import type { EChartsCoreOption } from 'echarts/core';
import { render, waitFor } from '../../../../spec/helpers/testing-library';
import Echart, {
  ECHARTS_HOST_CLASS,
  ECHARTS_RENDER_FINISHED_CLASS,
} from './Echart';
import type { EchartsProps } from '../types';

type Handler = (params: unknown) => void;

const listeners: Record<string, Handler[]> = {};

const mockChart = {
  dispatchAction: jest.fn(),
  dispose: jest.fn(),
  getOption: jest.fn(() => ({})),
  getZr: jest.fn(() => ({ off: jest.fn(), on: jest.fn() })),
  off: jest.fn(),
  on: jest.fn((name: string, handler: Handler) => {
    listeners[name] = listeners[name] || [];
    listeners[name].push(handler);
  }),
  resize: jest.fn(),
  setOption: jest.fn(),
};

jest.mock('echarts/core', () => ({
  init: jest.fn(() => mockChart),
  registerLocale: jest.fn(),
  use: jest.fn(),
}));
jest.mock('echarts/charts', () => ({}));
jest.mock('echarts/components', () => ({}));
jest.mock('echarts/features', () => ({ LabelLayout: 'LabelLayout' }));
jest.mock('echarts/renderers', () => ({ CanvasRenderer: 'CanvasRenderer' }));

const initialState = {
  common: { locale: 'en' },
  dashboardState: { isRefreshing: false },
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

const trigger = (name: string) =>
  (listeners[name] || []).forEach(handler => handler({}));

beforeEach(() => {
  Object.keys(listeners).forEach(name => delete listeners[name]);
  Object.values(mockChart).forEach(value => {
    if (jest.isMockFunction(value)) value.mockClear();
  });
});

test('tags the ECharts canvas host with the readiness-gate class', async () => {
  const { container } = render(renderEchart(), {
    initialState,
    useRedux: true,
  });
  await waitFor(() => expect(mockChart.setOption).toHaveBeenCalled());
  expect(container.querySelector(`.${ECHARTS_HOST_CLASS}`)).not.toBeNull();
});

test('marks the host painted only on the ECharts `finished` event', async () => {
  const { container } = render(renderEchart(), {
    initialState,
    useRedux: true,
  });
  await waitFor(() => expect(mockChart.setOption).toHaveBeenCalled());

  const host = container.querySelector(`.${ECHARTS_HOST_CLASS}`) as HTMLElement;
  expect(host).not.toBeNull();

  // `setOption` ran during mount, which clears the marker; `finished` has not
  // fired yet, so the host must NOT be flagged as painted.
  expect(host).not.toHaveClass(ECHARTS_RENDER_FINISHED_CLASS);

  // Simulate ECharts completing its draw -> the host is flagged painted.
  trigger('finished');
  expect(host).toHaveClass(ECHARTS_RENDER_FINISHED_CLASS);
});
