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

import { triggerResizeObserver } from 'resize-observer-polyfill';
import { promiseTimeout, WithLegend } from '@superset-ui/core';
import { render } from '@testing-library/react';

let renderChart = jest.fn();
let renderLegend = jest.fn();

// TODO: rewrite to rtl
describe.skip('WithLegend', () => {
  beforeEach(() => {
    renderChart = jest.fn(() => <div className="chart" />);
    renderLegend = jest.fn(() => <div className="legend" />);
  });

  it('sets className', () => {
    const { container } = render(
      <WithLegend
        className="test-class"
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );
    expect(container.querySelectorAll('.test-class')).toHaveLength(1);
  });

  it('renders when renderLegend is not set', () => {
    const { container } = render(
      <WithLegend
        debounceTime={1}
        width={500}
        height={500}
        renderChart={renderChart}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    return promiseTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(container.querySelectorAll('div.chart')).toHaveLength(1);
      expect(container.querySelectorAll('div.legend')).toHaveLength(0);
    }, 100);
  });

  it('renders', () => {
    const { container } = render(
      <WithLegend
        debounceTime={1}
        width={500}
        height={500}
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    return promiseTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(container.querySelectorAll('div.chart')).toHaveLength(1);
      expect(container.querySelectorAll('div.legend')).toHaveLength(1);
    }, 100);
  });

  it('renders without width or height', () => {
    const { container } = render(
      <WithLegend
        debounceTime={1}
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    return promiseTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(container.querySelectorAll('div.chart')).toHaveLength(1);
      expect(container.querySelectorAll('div.legend')).toHaveLength(1);
    }, 100);
  });

  it('renders legend on the left', () => {
    const { container } = render(
      <WithLegend
        debounceTime={1}
        position="left"
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    return promiseTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(container.querySelectorAll('div.chart')).toHaveLength(1);
      expect(container.querySelectorAll('div.legend')).toHaveLength(1);
    }, 100);
  });

  it('renders legend on the right', () => {
    const { container } = render(
      <WithLegend
        debounceTime={1}
        position="right"
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    return promiseTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(container.querySelectorAll('div.chart')).toHaveLength(1);
      expect(container.querySelectorAll('div.legend')).toHaveLength(1);
    }, 100);
  });

  it('renders legend on the top', () => {
    const { container } = render(
      <WithLegend
        debounceTime={1}
        position="top"
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    return promiseTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(container.querySelectorAll('div.chart')).toHaveLength(1);
      expect(container.querySelectorAll('div.legend')).toHaveLength(1);
    }, 100);
  });

  it('renders legend on the bottom', () => {
    const { container } = render(
      <WithLegend
        debounceTime={1}
        position="bottom"
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    return promiseTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(container.querySelectorAll('div.chart')).toHaveLength(1);
      expect(container.querySelectorAll('div.legend')).toHaveLength(1);
    }, 100);
  });

  it('renders legend with justifyContent set', () => {
    const { container } = render(
      <WithLegend
        debounceTime={1}
        position="right"
        legendJustifyContent="flex-start"
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    return promiseTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(container.querySelectorAll('div.chart')).toHaveLength(1);
      expect(container.querySelectorAll('div.legend')).toHaveLength(1);
    }, 100);
  });
});
