/*
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

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { WithLegend } from '@superset-ui/core';

jest.mock('@visx/responsive', () => ({
  ParentSize: ({
    children,
  }: {
    children: (props: { width: number; height: number }) => React.ReactNode;
  }) => children({ width: 800, height: 600 }),
}));

test('WithLegend applies custom className', () => {
  const { container } = render(
    <WithLegend
      className="test-class"
      renderChart={() => <div className="chart" />}
    />,
  );
  expect(container.querySelector('.with-legend.test-class')).toBeInTheDocument();
});

test('WithLegend renders chart without legend when renderLegend is not provided', () => {
  const renderChart = jest.fn(() => <div data-test="chart" />);
  const { container } = render(
    <WithLegend renderChart={renderChart} />,
  );
  expect(container.querySelector('[data-test="chart"]')).toBeInTheDocument();
  expect(renderChart).toHaveBeenCalledTimes(1);
  expect(container.querySelector('.legend-container')).not.toBeInTheDocument();
});

test('WithLegend renders both chart and legend', () => {
  const renderChart = jest.fn(() => <div data-test="chart" />);
  const renderLegend = jest.fn(() => <div data-test="legend" />);
  const { container } = render(
    <WithLegend renderChart={renderChart} renderLegend={renderLegend} />,
  );
  expect(container.querySelector('[data-test="chart"]')).toBeInTheDocument();
  expect(container.querySelector('[data-test="legend"]')).toBeInTheDocument();
  expect(renderChart).toHaveBeenCalledTimes(1);
  expect(renderLegend).toHaveBeenCalledTimes(1);
});

test('WithLegend renders legend at top position with column direction', () => {
  const { container } = render(
    <WithLegend
      position="top"
      renderChart={() => <div />}
      renderLegend={() => <div data-testid="legend" />}
    />,
  );
  const wrapper = container.querySelector('.with-legend') as HTMLElement;
  expect(wrapper.style.flexDirection).toBe('column');
});

test('WithLegend renders legend at bottom position with column-reverse direction', () => {
  const { container } = render(
    <WithLegend
      position="bottom"
      renderChart={() => <div />}
      renderLegend={() => <div data-testid="legend" />}
    />,
  );
  const wrapper = container.querySelector('.with-legend') as HTMLElement;
  expect(wrapper.style.flexDirection).toBe('column-reverse');
});

test('WithLegend renders legend at left position with row direction', () => {
  const renderLegend = jest.fn(() => <div />);
  const { container } = render(
    <WithLegend
      position="left"
      renderChart={() => <div />}
      renderLegend={renderLegend}
    />,
  );
  const wrapper = container.querySelector('.with-legend') as HTMLElement;
  expect(wrapper.style.flexDirection).toBe('row');
  expect(renderLegend).toHaveBeenCalledWith(
    expect.objectContaining({ direction: 'column' }),
  );
});

test('WithLegend renders legend at right position with row-reverse direction', () => {
  const renderLegend = jest.fn(() => <div />);
  const { container } = render(
    <WithLegend
      position="right"
      renderChart={() => <div />}
      renderLegend={renderLegend}
    />,
  );
  const wrapper = container.querySelector('.with-legend') as HTMLElement;
  expect(wrapper.style.flexDirection).toBe('row-reverse');
  expect(renderLegend).toHaveBeenCalledWith(
    expect.objectContaining({ direction: 'column' }),
  );
});

test('WithLegend applies custom legendJustifyContent', () => {
  const { container } = render(
    <WithLegend
      position="right"
      legendJustifyContent="flex-start"
      renderChart={() => <div />}
      renderLegend={() => <div />}
    />,
  );
  const legendContainer = container.querySelector(
    '.legend-container',
  ) as HTMLElement;
  expect(legendContainer.style.justifyContent).toBe('flex-start');
});
