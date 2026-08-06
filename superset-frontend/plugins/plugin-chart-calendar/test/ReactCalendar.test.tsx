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
import { Component, memo, StrictMode, type ReactNode } from 'react';
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import { CALENDAR_TOOLTIP_CLASS } from '../src/tooltip';

interface MockCalHeatMapConfig {
  itemSelector: Element;
}

type MetricNameInput = string | string[];

let mockNextInstanceId = 0;
let mockNextOwnerId = 0;
let mockInitCallCount = 0;
let mockThrowOnInitCall: number | null = null;
let mockDestroyCallCount = 0;
let mockDestroyedInstanceIds: string[] = [];

const mockTheme = {
  colorBgElevated: '#ffffff',
};

jest.mock('../src/vendor/cal-heatmap', () => ({
  __esModule: true,
  default: class MockCalHeatMap {
    private instanceId?: string;

    private tooltips: HTMLElement[] = [];

    init(config: MockCalHeatMapConfig) {
      const {
        CALENDAR_TOOLTIP_CLASS: mockCalendarTooltipClass,
      } = require('../src/tooltip');

      mockInitCallCount += 1;
      if (mockThrowOnInitCall === mockInitCallCount) {
        throw new Error('Mock CalHeatMap init failure');
      }

      mockNextInstanceId += 1;
      this.instanceId = String(mockNextInstanceId);

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
        tooltip.className = ['d3-tip', mockCalendarTooltipClass].join(' ');
        tooltip.dataset.tooltipOwner = tooltipOwner;
        tooltip.dataset.tooltipInstance = this.instanceId;
        tooltip.dataset.tooltipIndex = String(index);
        tooltip.textContent = `${tooltipOwner}-tooltip-${this.instanceId}-${index}`;
        global.document.body.appendChild(tooltip);
        return tooltip;
      });
    }

    destroy() {
      mockDestroyCallCount += 1;
      if (this.instanceId) {
        mockDestroyedInstanceIds.push(this.instanceId);
      }
      this.tooltips.forEach(tooltip => tooltip.remove());
      this.tooltips = [];
      return null;
    }
  },
}));

const ReactCalendar = require('../src/ReactCalendar').default;
const Calendar = require('../src/Calendar').default;

interface CalendarHarnessProps {
  firstMetricNames: MetricNameInput;
  secondMetricNames?: MetricNameInput;
  showFirstCalendar?: boolean;
}

interface CalendarErrorBoundaryProps {
  children: ReactNode;
}

interface CalendarErrorBoundaryState {
  hasError: boolean;
}

const CALENDAR_START = 1704067200000;

function createCalendarProps(metricNames: MetricNameInput) {
  const normalizedMetricNames = Array.isArray(metricNames)
    ? metricNames
    : [metricNames];

  return {
    data: {
      data: Object.fromEntries(
        normalizedMetricNames.map((metricName, index) => [
          metricName,
          {
            [String(CALENDAR_START)]: index * 2 + 1,
            [String(CALENDAR_START + 86400000)]: index * 2 + 2,
          },
        ]),
      ),
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
    verboseMap: Object.fromEntries(
      normalizedMetricNames.map(metricName => [metricName, metricName]),
    ),
  };
}

class CalendarErrorBoundary extends Component<
  CalendarErrorBoundaryProps,
  CalendarErrorBoundaryState
> {
  state: CalendarErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div>Calendar fallback</div>;
    }

    return this.props.children;
  }
}

const StableSecondCalendar = memo(function StableSecondCalendar({
  metricNames,
}: {
  metricNames: MetricNameInput;
}) {
  return (
    <div data-test="calendar-second">
      <ReactCalendar {...createCalendarProps(metricNames)} />
    </div>
  );
});

function CalendarHarness({
  firstMetricNames,
  secondMetricNames = 'second-metric',
  showFirstCalendar = true,
}: CalendarHarnessProps) {
  return (
    <>
      {showFirstCalendar ? (
        <div data-test="calendar-first">
          <ReactCalendar {...createCalendarProps(firstMetricNames)} />
        </div>
      ) : null}
      <StableSecondCalendar metricNames={secondMetricNames} />
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

function getCalendarTooltips() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`.${CALENDAR_TOOLTIP_CLASS}`),
  );
}

function getTooltipInstanceIds(tooltips: HTMLElement[]) {
  return Array.from(
    new Set(tooltips.map(tooltip => tooltip.dataset.tooltipInstance)),
  )
    .filter((tooltipInstanceId): tooltipInstanceId is string =>
      Boolean(tooltipInstanceId),
    )
    .sort();
}

function getSingleTooltipInstanceId(tooltips: HTMLElement[]) {
  const tooltipInstanceIds = getTooltipInstanceIds(tooltips);

  expect(tooltipInstanceIds).toHaveLength(1);

  return tooltipInstanceIds[0];
}

function flushPendingTimersIfNeeded() {
  try {
    act(() => {
      jest.runOnlyPendingTimers();
    });
  } catch {
    // Ignore tests that did not opt into fake timers.
  }
}

afterEach(() => {
  cleanup();
  flushPendingTimersIfNeeded();
  jest.useRealTimers();
  mockNextInstanceId = 0;
  mockNextOwnerId = 0;
  mockInitCallCount = 0;
  mockThrowOnInitCall = null;
  mockDestroyCallCount = 0;
  mockDestroyedInstanceIds = [];
  document.body.innerHTML = '';
});

test('rerender and unmount clean up only the affected calendar tooltips', () => {
  jest.useFakeTimers();

  const { rerender, unmount } = render(
    <CalendarHarness firstMetricNames="first-metric-initial" />,
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

  rerender(<CalendarHarness firstMetricNames="first-metric-rerendered" />);

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
      firstMetricNames="first-metric-rerendered"
      showFirstCalendar={false}
    />,
  );

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

test('multi-metric calendar rerender and unmount clean up every owned tooltip while preserving siblings', () => {
  jest.useFakeTimers();

  const { rerender, unmount } = render(
    <CalendarHarness
      firstMetricNames={['first-metric-a', 'first-metric-b']}
      secondMetricNames="second-metric-initial"
    />,
  );

  const firstCalendarOwner = getCalendarOwner('calendar-first');
  const secondCalendarOwner = getCalendarOwner('calendar-second');

  const firstTooltipOwnerId = getTooltipOwnerId(firstCalendarOwner);
  const secondTooltipOwnerId = getTooltipOwnerId(secondCalendarOwner);

  const firstInitialTooltips = getOwnerTooltips(firstTooltipOwnerId);
  const secondInitialTooltips = getOwnerTooltips(secondTooltipOwnerId);

  expect(firstInitialTooltips).toHaveLength(4);
  expect(secondInitialTooltips).toHaveLength(2);
  expect(document.querySelectorAll(`.${CALENDAR_TOOLTIP_CLASS}`)).toHaveLength(
    6,
  );

  const firstInitialInstanceIds = getTooltipInstanceIds(firstInitialTooltips);
  const secondInitialInstanceIds = getTooltipInstanceIds(secondInitialTooltips);

  expect(firstInitialInstanceIds).toHaveLength(2);
  expect(secondInitialInstanceIds).toHaveLength(1);

  rerender(
    <CalendarHarness
      firstMetricNames={['first-metric-c', 'first-metric-d']}
      secondMetricNames="second-metric-initial"
    />,
  );

  const firstRerenderedTooltips = getOwnerTooltips(firstTooltipOwnerId);
  const secondPreservedTooltips = getOwnerTooltips(secondTooltipOwnerId);

  expect(firstRerenderedTooltips).toHaveLength(4);
  expect(secondPreservedTooltips).toHaveLength(2);
  expect(document.querySelectorAll(`.${CALENDAR_TOOLTIP_CLASS}`)).toHaveLength(
    6,
  );
  expect(firstInitialTooltips.every(tooltip => !tooltip.isConnected)).toBe(
    true,
  );
  expect(secondInitialTooltips.every(tooltip => tooltip.isConnected)).toBe(
    true,
  );

  expect(getTooltipInstanceIds(firstRerenderedTooltips)).toHaveLength(2);
  expect(getTooltipInstanceIds(firstRerenderedTooltips)).not.toEqual(
    firstInitialInstanceIds,
  );
  expect(getTooltipInstanceIds(secondPreservedTooltips)).toEqual(
    secondInitialInstanceIds,
  );

  rerender(
    <CalendarHarness
      firstMetricNames={['first-metric-c', 'first-metric-d']}
      secondMetricNames="second-metric-initial"
      showFirstCalendar={false}
    />,
  );

  expect(getOwnerTooltips(firstTooltipOwnerId)).toHaveLength(0);
  expect(getOwnerTooltips(secondTooltipOwnerId)).toHaveLength(2);
  expect(document.querySelectorAll(`.${CALENDAR_TOOLTIP_CLASS}`)).toHaveLength(
    2,
  );
  expect(getTooltipInstanceIds(getOwnerTooltips(secondTooltipOwnerId))).toEqual(
    secondInitialInstanceIds,
  );

  unmount();
});

test('Calendar destroys previously initialized metric instances after a later metric init failure', () => {
  const calendarOwner = document.createElement('div');
  document.body.appendChild(calendarOwner);

  mockThrowOnInitCall = 2;

  expect(() => {
    Calendar(calendarOwner, {
      ...createCalendarProps(['failing-metric-a', 'failing-metric-b']),
      theme: mockTheme,
    });
  }).toThrow('Mock CalHeatMap init failure');

  const failedRenderTooltips = getOwnerTooltips(
    getTooltipOwnerId(calendarOwner),
  );
  const failedRenderInstanceIds = getTooltipInstanceIds(failedRenderTooltips);

  expect(failedRenderTooltips).toHaveLength(2);
  expect(failedRenderInstanceIds).toHaveLength(1);

  mockThrowOnInitCall = null;
  Calendar(calendarOwner, {
    ...createCalendarProps('recovered-metric'),
    theme: mockTheme,
  });

  const recoveredTooltips = getOwnerTooltips(getTooltipOwnerId(calendarOwner));

  expect(failedRenderTooltips.every(tooltip => !tooltip.isConnected)).toBe(
    true,
  );
  expect(recoveredTooltips).toHaveLength(2);
  expect(getTooltipInstanceIds(recoveredTooltips)).not.toEqual(
    failedRenderInstanceIds,
  );
});

test('surviving calendar rerender preserves sibling cleanup after another calendar unmounts', () => {
  jest.useFakeTimers();

  const { rerender, unmount } = render(
    <CalendarHarness
      firstMetricNames="first-metric-initial"
      secondMetricNames="second-metric-initial"
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
      firstMetricNames="first-metric-initial"
      secondMetricNames="second-metric-initial"
      showFirstCalendar={false}
    />,
  );

  expect(getOwnerTooltips(firstTooltipOwnerId)).toHaveLength(0);
  expect(getOwnerTooltips(secondTooltipOwnerId)).toHaveLength(2);
  expect(document.querySelectorAll(`.${CALENDAR_TOOLTIP_CLASS}`)).toHaveLength(
    2,
  );

  rerender(
    <CalendarHarness
      firstMetricNames="first-metric-initial"
      secondMetricNames="second-metric-rerendered"
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

test('StrictMode unmount cleans up calendar tooltips for multi-metric calendars', () => {
  const { unmount } = render(
    <StrictMode>
      <ReactCalendar
        {...createCalendarProps(['strict-metric-a', 'strict-metric-b'])}
      />
    </StrictMode>,
  );

  expect(getCalendarTooltips()).toHaveLength(4);

  unmount();

  expect(getCalendarTooltips()).toHaveLength(0);
});

test('ErrorBoundary fallback destroys partially initialized tooltips after a later init failure', async () => {
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);

  mockThrowOnInitCall = 2;

  try {
    const { unmount } = render(
      <CalendarErrorBoundary>
        <ReactCalendar
          {...createCalendarProps(['failing-metric-a', 'failing-metric-b'])}
        />
      </CalendarErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('Calendar fallback')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getCalendarTooltips()).toHaveLength(0);
    });

    expect(mockDestroyCallCount).toBe(2);
    expect(mockDestroyedInstanceIds).toEqual(['1']);

    unmount();

    expect(getCalendarTooltips()).toHaveLength(0);
  } finally {
    consoleErrorSpy.mockRestore();
  }
});
