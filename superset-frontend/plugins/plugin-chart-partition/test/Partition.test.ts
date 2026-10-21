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
import Partition from '../src/Partition';

const CHART_WIDTH = 400;
const CHART_HEIGHT = 300;
const TOOLTIP_WIDTH = 120;
const TOOLTIP_OFFSET = 15;

const props = {
  width: CHART_WIDTH,
  height: CHART_HEIGHT,
  data: [
    {
      name: 'sum__num',
      val: 100,
      children: [
        { name: 'boy', val: 60 },
        { name: 'girl', val: 40 },
      ],
    },
  ],
  colorScheme: 'supersetColors',
  dateTimeFormat: '%Y-%m-%d',
  equalDateSize: true,
  levels: ['gender'],
  metrics: ['sum__num'],
  numberFormat: ',d',
  partitionLimit: 0,
  partitionThreshold: 0,
  timeSeriesOption: 'not_time',
  useLogScale: false,
  useRichTooltip: false,
  sliceId: 1,
};

let container: HTMLDivElement;
let rectSpy: jest.SpyInstance;
let offsetWidthSpy: jest.SpyInstance;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  // jsdom performs no layout: give the container a fixed box so the
  // pointer coordinates d3.mouse() derives from clientX are deterministic.
  rectSpy = jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function getRect(this: HTMLElement) {
      const isTooltip = this.classList.contains('partition-tooltip');
      const width = isTooltip ? TOOLTIP_WIDTH : CHART_WIDTH;

      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: CHART_HEIGHT,
        width,
        height: CHART_HEIGHT,
        toJSON: () => ({}),
      } as DOMRect;
    });
  offsetWidthSpy = jest
    .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
    .mockImplementation(function getOffsetWidth(this: HTMLElement) {
      return this.classList.contains('partition-tooltip')
        ? TOOLTIP_WIDTH
        : CHART_WIDTH;
    });
});

afterEach(() => {
  rectSpy.mockRestore();
  offsetWidthSpy.mockRestore();
  container.remove();
});

function hoverAt(clientX: number, clientY: number): HTMLElement {
  Partition(container, props);
  const node = container.querySelector('svg g rect') as SVGRectElement;
  node.dispatchEvent(
    new MouseEvent('mousemove', { bubbles: true, clientX, clientY }),
  );

  return container.querySelector('.partition-tooltip') as HTMLElement;
}

test('places the tooltip right of the cursor when there is room', () => {
  const tooltip = hoverAt(50, 100);

  expect(tooltip.style.left).toBe(`${50 + TOOLTIP_OFFSET}px`);
  expect(tooltip.style.top).toBe('100px');
});

test('keeps the tooltip inside the chart when hovering near the right edge', () => {
  const cursorX = CHART_WIDTH - 10;
  const tooltip = hoverAt(cursorX, 100);

  const left = parseFloat(tooltip.style.left);
  expect(left + TOOLTIP_WIDTH).toBeLessThanOrEqual(CHART_WIDTH);
  // shifted to the left of the cursor rather than overlapping it
  expect(left + TOOLTIP_WIDTH).toBeLessThanOrEqual(cursorX);
});
