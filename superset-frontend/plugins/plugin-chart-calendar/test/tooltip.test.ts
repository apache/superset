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

import { CALENDAR_TOOLTIP_CLASS } from '../src/tooltip';

// The vendor file is @ts-nocheck, so its export lacks type info.
// Mirror the minimal constructor interface defined in Calendar.ts.
interface CalHeatMapInstance {
  init(config: Record<string, unknown>): void;
  destroy(): null;
}

const createSVGPointDescriptor = Object.getOwnPropertyDescriptor(
  window.SVGSVGElement.prototype,
  'createSVGPoint',
);

function installCreateSVGPointMock() {
  Object.defineProperty(window.SVGSVGElement.prototype, 'createSVGPoint', {
    configurable: true,
    value: () => ({
      matrixTransform: () => ({ x: 0, y: 0 }),
    }),
  });
}

function restoreCreateSVGPointMock() {
  if (createSVGPointDescriptor) {
    Object.defineProperty(
      window.SVGSVGElement.prototype,
      'createSVGPoint',
      createSVGPointDescriptor,
    );
  } else {
    delete (
      window.SVGSVGElement.prototype as Partial<
        Pick<SVGSVGElement, 'createSVGPoint'>
      >
    ).createSVGPoint;
  }
}

function getCalendarTooltips() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`.${CALENDAR_TOOLTIP_CLASS}`),
  );
}

afterEach(() => {
  jest.resetModules();
  restoreCreateSVGPointMock();
  document.body.innerHTML = '';
});

test('CalHeatMap destroy tolerates partially initialized instances', () => {
  let CalHeatMap!: new () => CalHeatMapInstance;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    CalHeatMap = require('../src/vendor/cal-heatmap')
      .default as new () => CalHeatMapInstance;
  });

  const partiallyInitializedHeatmap = new CalHeatMap();

  expect(() => partiallyInitializedHeatmap.destroy()).not.toThrow();
  expect(getCalendarTooltips()).toHaveLength(0);
});

test('CalHeatMap destroy removes only the destroyed instance tooltips', () => {
  installCreateSVGPointMock();

  let CalHeatMap!: new () => CalHeatMapInstance;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    CalHeatMap = require('../src/vendor/cal-heatmap')
      .default as new () => CalHeatMapInstance;
  });

  const firstCalendar = document.createElement('div');
  const secondCalendar = document.createElement('div');
  document.body.append(firstCalendar, secondCalendar);

  const firstHeatmap = new CalHeatMap();
  firstHeatmap.init({
    itemSelector: firstCalendar,
    paintOnLoad: false,
    tooltip: true,
    valueFormatter: String,
    timeFormatter: String,
  });

  const firstTooltips = getCalendarTooltips();
  expect(firstTooltips).toHaveLength(2);

  const secondHeatmap = new CalHeatMap();
  secondHeatmap.init({
    itemSelector: secondCalendar,
    paintOnLoad: false,
    tooltip: true,
    valueFormatter: String,
    timeFormatter: String,
  });

  const allTooltips = getCalendarTooltips();
  const secondTooltips = allTooltips.filter(
    tooltip => !firstTooltips.includes(tooltip),
  );

  expect(secondTooltips).toHaveLength(2);

  firstHeatmap.destroy();

  expect(firstTooltips.every(tooltip => !tooltip.isConnected)).toBe(true);
  expect(secondTooltips.every(tooltip => tooltip.isConnected)).toBe(true);
  expect(getCalendarTooltips()).toHaveLength(2);

  secondHeatmap.destroy();

  expect(getCalendarTooltips()).toHaveLength(0);
});
