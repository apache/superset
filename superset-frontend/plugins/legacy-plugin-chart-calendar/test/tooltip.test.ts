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

import {
  CALENDAR_TOOLTIP_CLASS,
  getCalendarTooltipClassName,
  removeDisconnectedCalendarTooltips,
} from '../src/tooltip';

function createCalendarTooltip(className: string) {
  const tooltip = document.createElement('div');
  tooltip.className = `d3-tip ${CALENDAR_TOOLTIP_CLASS} ${className}`;
  document.body.appendChild(tooltip);
  return tooltip;
}

afterEach(() => {
  document.body.innerHTML = '';
});

test('getCalendarTooltipClassName creates stable owner-specific class names', () => {
  const firstCalendar = document.createElement('div');
  const secondCalendar = document.createElement('div');

  const firstClassName = getCalendarTooltipClassName(firstCalendar);
  const secondClassName = getCalendarTooltipClassName(secondCalendar);

  expect(firstClassName).toContain(CALENDAR_TOOLTIP_CLASS);
  expect(secondClassName).toContain(CALENDAR_TOOLTIP_CLASS);
  expect(firstClassName).not.toEqual(secondClassName);
  expect(getCalendarTooltipClassName(firstCalendar)).toEqual(firstClassName);
});

test('removeDisconnectedCalendarTooltips preserves mounted calendar tooltips', () => {
  const firstCalendar = document.createElement('div');
  const secondCalendar = document.createElement('div');
  document.body.append(firstCalendar, secondCalendar);

  const firstClassName = getCalendarTooltipClassName(firstCalendar);
  const secondClassName = getCalendarTooltipClassName(secondCalendar);

  const firstTooltip = document.createElement('div');
  firstTooltip.className = `d3-tip ${CALENDAR_TOOLTIP_CLASS} ${firstClassName}`;
  document.body.appendChild(firstTooltip);

  const secondTooltip = document.createElement('div');
  secondTooltip.className = `d3-tip ${CALENDAR_TOOLTIP_CLASS} ${secondClassName}`;
  document.body.appendChild(secondTooltip);

  removeDisconnectedCalendarTooltips();

  expect(document.querySelector(`.${firstClassName}`)).toBe(firstTooltip);
  expect(document.querySelector(`.${secondClassName}`)).toBe(secondTooltip);
});

test('removeDisconnectedCalendarTooltips removes only disconnected calendar tooltips', () => {
  const firstCalendar = document.createElement('div');
  const secondCalendar = document.createElement('div');
  document.body.append(firstCalendar, secondCalendar);

  const firstClassName = getCalendarTooltipClassName(firstCalendar);
  const secondClassName = getCalendarTooltipClassName(secondCalendar);
  firstCalendar.remove();

  const firstTooltip = document.createElement('div');
  firstTooltip.className = `d3-tip ${CALENDAR_TOOLTIP_CLASS} ${firstClassName}`;
  document.body.appendChild(firstTooltip);

  const secondTooltip = document.createElement('div');
  secondTooltip.className = `d3-tip ${CALENDAR_TOOLTIP_CLASS} ${secondClassName}`;
  document.body.appendChild(secondTooltip);

  const otherTooltip = document.createElement('div');
  otherTooltip.className = 'd3-tip tooltip-other-chart';
  document.body.appendChild(otherTooltip);

  removeDisconnectedCalendarTooltips();

  expect(document.querySelector(`.${firstClassName}`)).toBeNull();
  expect(document.querySelector(`.${secondClassName}`)).toBe(secondTooltip);
  expect(document.querySelector('.tooltip-other-chart')).toBe(otherTooltip);
});

test('reused calendar owners are re-armed for disconnected tooltip cleanup', () => {
  const calendar = document.createElement('div');
  document.body.appendChild(calendar);

  const className = getCalendarTooltipClassName(calendar);
  const firstTooltip = createCalendarTooltip(className);

  calendar.remove();
  removeDisconnectedCalendarTooltips();

  expect(firstTooltip.isConnected).toBe(false);

  document.body.appendChild(calendar);

  expect(getCalendarTooltipClassName(calendar)).toBe(className);

  const secondTooltip = createCalendarTooltip(className);

  calendar.remove();
  removeDisconnectedCalendarTooltips();

  expect(secondTooltip.isConnected).toBe(false);
  expect(document.querySelector(`.${className}`)).toBeNull();
});

test('CalHeatMap tags tips per instance without removing other mounted calendars', () => {
  const firstCalendar = document.createElement('div');
  const secondCalendar = document.createElement('div');
  document.body.append(firstCalendar, secondCalendar);

  const firstClassName = getCalendarTooltipClassName(firstCalendar);
  const secondClassName = getCalendarTooltipClassName(secondCalendar);

  Object.defineProperty(window.SVGSVGElement.prototype, 'createSVGPoint', {
    configurable: true,
    value: () => ({
      matrixTransform: () => ({ x: 0, y: 0 }),
    }),
  });

  // eslint-disable-next-line global-require
  const CalHeatMap = require('../src/vendor/cal-heatmap').default;

  const firstHeatmap = new CalHeatMap();
  firstHeatmap.init({
    itemSelector: firstCalendar,
    paintOnLoad: false,
    tooltip: true,
    tooltipClassName: firstClassName,
    valueFormatter: String,
    timeFormatter: String,
  });

  const secondHeatmap = new CalHeatMap();
  secondHeatmap.init({
    itemSelector: secondCalendar,
    paintOnLoad: false,
    tooltip: true,
    tooltipClassName: secondClassName,
    valueFormatter: String,
    timeFormatter: String,
  });

  expect(document.querySelectorAll(`.${CALENDAR_TOOLTIP_CLASS}`)).toHaveLength(
    4,
  );
  expect(document.querySelectorAll(`.${firstClassName}`)).toHaveLength(2);
  expect(document.querySelectorAll(`.${secondClassName}`)).toHaveLength(2);

  firstHeatmap.destroy();

  expect(document.querySelectorAll(`.${firstClassName}`)).toHaveLength(0);
  expect(document.querySelectorAll(`.${secondClassName}`)).toHaveLength(2);
});
