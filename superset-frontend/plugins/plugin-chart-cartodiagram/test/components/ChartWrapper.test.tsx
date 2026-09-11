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
import type { ComponentType } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { supersetTheme } from '@apache-superset/core/theme';
import ChartWrapper from '../../src/components/ChartWrapper';

const mockGetAsPromise = jest.fn();

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getChartComponentRegistry: () => ({ getAsPromise: mockGetAsPromise }),
}));

const chartConfig = {
  type: 'Feature' as const,
  geometry: { type: 'Point' as const, coordinates: [0, 0] },
  properties: {},
};

const renderWrapper = (vizType: string, onRenderComplete = jest.fn()) =>
  render(
    <ChartWrapper
      vizType={vizType}
      chartConfig={chartConfig}
      width={100}
      height={100}
      theme={supersetTheme}
      locale="en"
      onRenderComplete={onRenderComplete}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

test('reports completion only after the nested module resolves', async () => {
  let resolveChart: (chart: ComponentType) => void = () => {};
  mockGetAsPromise.mockImplementation(
    () =>
      new Promise<ComponentType>(resolve => {
        resolveChart = resolve;
      }),
  );

  const onRenderComplete = jest.fn();
  const { container } = renderWrapper('pie', onRenderComplete);
  expect(onRenderComplete).not.toHaveBeenCalled();

  await act(async () => {
    resolveChart(() => <div>nested chart</div>);
  });

  await waitFor(() => expect(onRenderComplete).toHaveBeenCalledTimes(1));
  expect(container.textContent).toContain('nested chart');
});

test('ignores a nested module that resolves after the visualization changes', async () => {
  const resolvers: ((chart: ComponentType) => void)[] = [];
  mockGetAsPromise.mockImplementation(
    () =>
      new Promise<ComponentType>(resolve => {
        resolvers.push(resolve);
      }),
  );

  const onRenderComplete = jest.fn();
  const { container, rerender } = renderWrapper('pie', onRenderComplete);
  rerender(
    <ChartWrapper
      vizType="bar"
      chartConfig={chartConfig}
      width={100}
      height={100}
      theme={supersetTheme}
      locale="en"
      onRenderComplete={onRenderComplete}
    />,
  );

  await act(async () => {
    resolvers[0](() => <div>stale chart</div>);
  });
  expect(container.textContent).not.toContain('stale chart');
  expect(onRenderComplete).not.toHaveBeenCalled();

  await act(async () => {
    resolvers[1](() => <div>current chart</div>);
  });
  expect(container.textContent).toContain('current chart');
  expect(onRenderComplete).toHaveBeenCalledTimes(1);
});

test('stays loading when a nested chart module rejects', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockGetAsPromise.mockRejectedValue(new Error('missing plugin'));

  const onRenderComplete = jest.fn();
  renderWrapper('missing', onRenderComplete);

  await waitFor(() => expect(warn).toHaveBeenCalled());
  expect(onRenderComplete).not.toHaveBeenCalled();
  warn.mockRestore();
});
