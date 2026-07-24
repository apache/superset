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
import { memo } from 'react';
import { act, cleanup, render, screen } from 'spec/helpers/testing-library';
import ReactCalendar from '../src/ReactCalendar';

const CALENDAR_TOOLTIP_CLASS = 'superset-legacy-chart-calendar-tooltip';

interface MockCalHeatMapConfig {
  itemSelector: Element;
  tooltipClassName: string;
}

let mockNextInstanceId = 0;
let mockNextOwnerId = 0;

jest.mock('../src/vendor/cal-heatmap', () => ({
  __esModule: true,
  default: class MockCalHeatMap {
    private tooltips: HTMLElement[] = [];

    init(config: MockCalHeatMapConfig) {
      const mockTooltipClass = 'superset-legacy-chart-calendar-tooltip';

      mockNextInstanceId += 1;

      const owner = config.itemSelector.closest(
        '.superset-legacy-chart-calendar',
      ) as HTMLElement | null;
      if (!owner) {
        throw new Error('Expected tooltip owner calendar container');
      }

      if (!owner.dataset.tooltipOwner) {
        mockNextOwnerId += 1;
        owner.dataset.tooltipOwner = `calendar-owner-${mockNextOwnerId}`;
      }

      const { tooltipOwner } = owner.dataset;
      if (!tooltipOwner) {
        throw new Error('Expected owner-specific tooltip marker');
      }

      this.tooltips = [0, 1].map(index => {
        const tooltip = global.document.createElement('div');
        tooltip.className = [
          'd3-tip',
          mockTooltipClass,
          config.tooltipClassName,
        ].join(' ');
        tooltip.dataset.tooltipOwner = tooltipOwner;
        tooltip.dataset.tooltipInstance = String(mockNextInstanceId);
        tooltip.dataset.tooltipIndex = String(index);
        tooltip.textContent = `${tooltipOwner}-tooltip-${mockNextInstanceId}-${index}`;
        global.document.body.appendChild(tooltip);
        return tooltip;
      });
    }

    destroy() {
      this.tooltips.forEach(tooltip => tooltip.remove());
      this.tooltips = [];
      return null;
    }
  },
}));

interface CalendarHarnessProps {
  firstMetricName: string;
  secondMetricName?: string;
  showFirstCalendar?: boolean;
}

const CALENDAR_START = 1704067200000;

function createCalendarProps(metricName: string) {
  return {
    data: {
      data: {
        [metricName]: {
          [String(CALENDAR_START)]: 1,
          [String(CALENDAR_START + 86400000)]: 2,
        },
      },
      domain: 'month',
      range: 1,
      start: CALENDAR_START,
      subdomain: 'day',
    },
    height: 160,
    domainGranularity: 'month',
    linearColorScheme: 'schemeRdYlBu',
    showLegend: false,
    showMetricName: true,
    showValues: false,
    steps: 3,
    subdomainGranularity: 'day',
    timeFormatter: (value: number | string) => String(value),
    valueFormatter: (value: number) => String(value),
    verboseMap: {
      [metricName]: metricName,
    },
  };
}

const StableSecondCalendar = memo(function StableSecondCalendar({
  metricName,
}: {
  metricName: string;
}) {
  return (
    <div data-test="calendar-second">
      <ReactCalendar {...createCalendarProps(metricName)} />
    </div>
  );
});

function CalendarHarness({
  firstMetricName,
  secondMetricName = 'second-metric',
  showFirstCalendar = true,
}: CalendarHarnessProps) {
  return (
    <>
      {showFirstCalendar ? (
        <div data-test="calendar-first">
          <ReactCalendar {...createCalendarProps(firstMetricName)} />
        </div>
      ) : null}
      <StableSecondCalendar metricName={secondMetricName} />
    </>
  );
}

function getCalendarOwner(testId: string) {
  const owner = screen
    .getByTestId(testId)
    .querySelector('.superset-legacy-chart-calendar');

  if (!(owner instanceof HTMLElement)) {
    throw new Error(`Expected mounted calendar owner for ${testId}`);
  }

  return owner;
}

function getTooltipOwnerId(owner: HTMLElement) {
  const tooltipOwnerId = owner.dataset.tooltipOwner;

  if (!tooltipOwnerId) {
    throw new Error('Expected mounted calendar to have a tooltip owner id');
  }

  return tooltipOwnerId;
}

function getOwnerTooltips(tooltipOwnerId: string) {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      `.d3-tip[data-tooltip-owner="${tooltipOwnerId}"]`,
    ),
  );
}

function getSingleTooltipInstanceId(tooltips: HTMLElement[]) {
  const tooltipInstanceIds = new Set(
    tooltips.map(tooltip => tooltip.dataset.tooltipInstance),
  );

  expect(tooltipInstanceIds.size).toBe(1);

  const [tooltipInstanceId] = Array.from(tooltipInstanceIds);
  if (!tooltipInstanceId) {
    throw new Error('Expected tooltip instance id');
  }

  return tooltipInstanceId;
}

afterEach(() => {
  cleanup();
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  mockNextInstanceId = 0;
  mockNextOwnerId = 0;
  document.body.innerHTML = '';
});

test('rerender and unmount clean up only the affected calendar tooltips', () => {
  jest.useFakeTimers();

  const { rerender, unmount } = render(
    <CalendarHarness firstMetricName="first-metric-initial" />,
  );

  const firstCalendarOwner = getCalendarOwner('calendar-first');
  const secondCalendarOwner = getCalendarOwner('calendar-second');

  const firstTooltipOwnerId = getTooltipOwnerId(firstCalendarOwner);
  const secondTooltipOwnerId = getTooltipOwnerId(secondCalendarOwner);

  const firstInitialTooltips = getOwnerTooltips(firstTooltipOwnerId);
  const secondInitialTooltips = getOwnerTooltips(secondTooltipOwnerId);

  expect(firstInitialTooltips).toHaveLength(2);
  expect(secondInitialTooltips).toHaveLength(2);
  expect(document.querySelectorAll(`.${CALENDAR_TOOLTIP_CLASS}`)).toHaveLength(
    4,
  );

  const firstInitialInstanceId =
    getSingleTooltipInstanceId(firstInitialTooltips);
  const secondInitialInstanceId = getSingleTooltipInstanceId(
    secondInitialTooltips,
  );

  rerender(<CalendarHarness firstMetricName="first-metric-rerendered" />);

  const firstRerenderedTooltips = getOwnerTooltips(firstTooltipOwnerId);
  const secondPreservedTooltips = getOwnerTooltips(secondTooltipOwnerId);

  expect(firstRerenderedTooltips).toHaveLength(2);
  expect(secondPreservedTooltips).toHaveLength(2);
  expect(document.querySelectorAll(`.${CALENDAR_TOOLTIP_CLASS}`)).toHaveLength(
    4,
  );
  expect(firstInitialTooltips.every(tooltip => !tooltip.isConnected)).toBe(
    true,
  );
  expect(secondInitialTooltips.every(tooltip => tooltip.isConnected)).toBe(
    true,
  );

  expect(getSingleTooltipInstanceId(firstRerenderedTooltips)).not.toEqual(
    firstInitialInstanceId,
  );
  expect(getSingleTooltipInstanceId(secondPreservedTooltips)).toEqual(
    secondInitialInstanceId,
  );

  rerender(
    <CalendarHarness
      firstMetricName="first-metric-rerendered"
      showFirstCalendar={false}
    />,
  );

  expect(getOwnerTooltips(firstTooltipOwnerId)).toHaveLength(2);
  expect(getOwnerTooltips(secondTooltipOwnerId)).toHaveLength(2);
  expect(document.querySelectorAll(`.${CALENDAR_TOOLTIP_CLASS}`)).toHaveLength(
    4,
  );

  act(() => {
    jest.runOnlyPendingTimers();
  });

  expect(getOwnerTooltips(firstTooltipOwnerId)).toHaveLength(0);
  expect(getOwnerTooltips(secondTooltipOwnerId)).toHaveLength(2);
  expect(document.querySelectorAll(`.${CALENDAR_TOOLTIP_CLASS}`)).toHaveLength(
    2,
  );
  expect(
    getSingleTooltipInstanceId(getOwnerTooltips(secondTooltipOwnerId)),
  ).toEqual(secondInitialInstanceId);

  unmount();
});

test('surviving calendar render synchronously sweeps disconnected sibling tooltips', () => {
  jest.useFakeTimers();

  const { rerender, unmount } = render(
    <CalendarHarness
      firstMetricName="first-metric-initial"
      secondMetricName="second-metric-initial"
    />,
  );

  const firstCalendarOwner = getCalendarOwner('calendar-first');
  const secondCalendarOwner = getCalendarOwner('calendar-second');

  const firstTooltipOwnerId = getTooltipOwnerId(firstCalendarOwner);
  const secondTooltipOwnerId = getTooltipOwnerId(secondCalendarOwner);

  const secondInitialInstanceId = getSingleTooltipInstanceId(
    getOwnerTooltips(secondTooltipOwnerId),
  );

  rerender(
    <CalendarHarness
      firstMetricName="first-metric-initial"
      secondMetricName="second-metric-initial"
      showFirstCalendar={false}
    />,
  );

  expect(getOwnerTooltips(firstTooltipOwnerId)).toHaveLength(2);
  expect(getOwnerTooltips(secondTooltipOwnerId)).toHaveLength(2);
  expect(document.querySelectorAll(`.${CALENDAR_TOOLTIP_CLASS}`)).toHaveLength(
    4,
  );

  rerender(
    <CalendarHarness
      firstMetricName="first-metric-initial"
      secondMetricName="second-metric-rerendered"
      showFirstCalendar={false}
    />,
  );

  const secondRerenderedTooltips = getOwnerTooltips(secondTooltipOwnerId);

  expect(getOwnerTooltips(firstTooltipOwnerId)).toHaveLength(0);
  expect(secondRerenderedTooltips).toHaveLength(2);
  expect(document.querySelectorAll(`.${CALENDAR_TOOLTIP_CLASS}`)).toHaveLength(
    2,
  );
  expect(getSingleTooltipInstanceId(secondRerenderedTooltips)).not.toEqual(
    secondInitialInstanceId,
  );

  unmount();
});
