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
  act,
  createStore,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import rison from 'rison';
import { removeChart } from 'src/components/Chart/chartAction';
import { stateWithoutNativeFilters } from 'spec/fixtures/mockStore';
import { testWithId } from 'src/utils/testUtils';
import { Preset, getExtensionsRegistry } from '@superset-ui/core';
import {
  TimeFilterPlugin,
  SelectFilterPlugin,
  RangeFilterPlugin,
} from 'src/filters/components';
import fetchMock from 'fetch-mock';
import { FilterBarOrientation, RootState } from 'src/dashboard/types';
import { LIMITS_FAILED_TEXT_ID } from 'src/dashboard/components/DashboardBuilder/TimeRangeLimitsAlert';
import { TIME_RANGE_LIMITS_LOADED } from 'src/dashboard/actions/timeRangeLimits';
import * as dataMaskActions from 'src/dataMask/actions';
import { FILTER_BAR_TEST_ID } from './utils';
import FilterBar from '.';

jest.useFakeTimers({ advanceTimers: true });

class MainPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      plugins: [
        new TimeFilterPlugin().configure({ key: 'filter_time' }),
        new SelectFilterPlugin().configure({ key: 'filter_select' }),
        new RangeFilterPlugin().configure({ key: 'filter_range' }),
      ],
    });
  }
}

new MainPreset().register();

beforeEach(() => {
  jest.clearAllMocks();
});

const getTestId = testWithId<string>(FILTER_BAR_TEST_ID, true);

function createOpenedBarProps(toggleFiltersBar = jest.fn()) {
  return { filtersOpen: true, toggleFiltersBar };
}

function createFilter(overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as string) || 'test-filter';
  return {
    id,
    name: 'Test Filter',
    filterType: 'filter_select',
    targets: [{ datasetId: 1, column: { name: 'test_column' } }],
    defaultDataMask: { filterState: { value: null }, extraFormData: {} },
    controlValues: {},
    cascadeParentIds: [],
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    type: 'NATIVE_FILTER',
    description: '',
    chartsInScope: [],
    tabsInScope: [],
    ...overrides,
  };
}

function createDataMask(
  filterId: string,
  value: unknown = undefined,
  extraFormData: Record<string, unknown> = {},
) {
  return {
    id: filterId,
    filterState: { value },
    extraFormData,
  };
}

function createStateWithFilter(
  filter: ReturnType<typeof createFilter>,
  dataMask: ReturnType<typeof createDataMask>,
  dashboardInfoOverrides: Record<string, unknown> = {},
) {
  return {
    ...stateWithoutNativeFilters,
    dashboardInfo: {
      id: 1,
      dash_edit_perm: true,
      metadata: {
        native_filter_configuration: [filter],
      },
      ...dashboardInfoOverrides,
    },
    dashboardState: {
      ...stateWithoutNativeFilters.dashboardState,
      activeTabs: ['ROOT_ID'],
    },
    dataMask: { [filter.id]: dataMask },
    nativeFilters: {
      filters: { [filter.id]: filter },
      filtersState: {},
    },
  };
}

const TIME_FILTER_ID = 'NATIVE_FILTER-time';
const LIMIT_ERROR = 'Choose a start and an end date. Time range limits are on.';
const LIMITS_UNSET = {
  max_span: null,
  max_look_back: null,
  max_look_forward: null,
};
const LIMITS_SPAN_90 = {
  ...LIMITS_UNSET,
  max_span: { quantity: 90, time_grain: 'P1D' },
};
const TIME_SERVER: Record<string, [string, string]> = {
  'today : now': ['2026-10-30T00:00:00', '2026-10-30T12:00:00'],
  'Last year': ['2025-10-30T00:00:00', '2026-10-30T00:00:00'],
  'Last month': ['2026-09-30T00:00:00', '2026-10-30T00:00:00'],
  'Last week': ['2026-10-23T00:00:00', '2026-10-30T00:00:00'],
};

// The extension point for the bar's date control: picks a value at once.
const PickerStub = ({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string) => void;
}) => (
  <button
    type="button"
    data-value={value}
    onClick={() => onChange('Last week')}
  >
    Pick last week
  </button>
);

function timeRangeState({
  value = 'Last year',
  status = 'loaded',
  holds = {},
  dashboardInfo = {},
}: {
  value?: string;
  status?: string;
  holds?: Record<string, unknown>;
  dashboardInfo?: Record<string, unknown>;
} = {}) {
  const timeFilter = createFilter({
    id: TIME_FILTER_ID,
    name: 'Time range',
    filterType: 'filter_time',
    targets: [{}],
    chartsInScope: [18],
  });
  const state = createStateWithFilter(
    timeFilter,
    createDataMask(TIME_FILTER_ID, value, { time_range: value }),
    { filterBarOrientation: FilterBarOrientation.Vertical, ...dashboardInfo },
  );
  return {
    ...state,
    timeRangeLimits: {
      status,
      dashboardId: 1,
      request: 1,
      payload:
        status === 'loaded'
          ? {
              global: LIMITS_UNSET,
              dashboard: LIMITS_SPAN_90,
              datasets: [],
              timezone: 'UTC',
            }
          : null,
      charts: holds,
    },
  };
}

function setupLimits() {
  window.featureFlags = { TIME_RANGE_LIMITS: true };
  getExtensionsRegistry().set('filter.dateFilterControl', PickerStub);
  fetchMock.removeRoute('time-range');
  fetchMock.get(
    'glob:*/api/v1/time_range/*',
    ({ url }: { url: string }) => {
      const request = rison.decode(new URL(url).searchParams.get('q')!) as
        | string
        | { timeRange: string }[];
      const items =
        typeof request === 'string' ? [{ timeRange: request }] : request;
      return {
        result: items.map(({ timeRange }) => {
          const [since, until] = TIME_SERVER[timeRange] ?? ['', ''];
          return { since, until, timeRange, shift: null };
        }),
      };
    },
    { name: 'time-range' },
  );
  fetchMock.removeRoute('filter-state');
  fetchMock.post(
    'glob:*/api/v1/dashboard/1/filter_state*',
    { key: 'abc' },
    { name: 'filter-state' },
  );
  fetchMock.clearHistory();
}

function teardownLimits() {
  window.featureFlags = {};
  getExtensionsRegistry().set('filter.dateFilterControl', undefined);
  fetchMock.removeRoute('time-range');
  fetchMock.removeRoute('filter-state');
}

// Runs the file's fake timers until the assertion passes: the bar shows its
// filters after its 1 s start, then the picker check answers.
async function until(assertion: () => void, steps = 60) {
  for (let step = 0; ; step += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      if (step >= steps) {
        throw error;
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
  }
}

function renderLimitsBar(state: object) {
  const store = createStore(state, reducerIndex);
  render(
    <FilterBar
      orientation={FilterBarOrientation.Vertical}
      verticalConfig={{
        width: 280,
        height: 400,
        offset: 0,
        ...createOpenedBarProps(),
      }}
    />,
    { store, useDnd: true, useRedux: true, useRouter: true },
  );
  return store as unknown as {
    getState: () => RootState;
    dispatch: (action: object) => void;
  };
}

const applyButton = () => screen.getByTestId(getTestId('apply-button'));

test('limits on: a Time Range value the chart check marked shows the error and locks Apply filters until another value is picked', async () => {
  setupLimits();
  try {
    renderLimitsBar(
      timeRangeState({
        value: 'Last month',
        holds: {
          18: {
            signature: '{}',
            status: 'invalid',
            failures: [
              {
                reason: 'MAX_SPAN_EXCEEDED',
                rule: 'max_span',
                field: 'range',
                limit: {
                  source: 'dashboard',
                  quantity: 90,
                  time_grain: 'P1D',
                },
                message: "Range can't be longer than 90 days.",
                range: {
                  since: '2026-06-30T00:00:00',
                  until: '2026-10-30T00:00:00',
                  time_offset: null,
                  source: [
                    { kind: 'granularity', query_index: 0, index: null },
                  ],
                },
              },
            ],
            attribution: {
              filterId: TIME_FILTER_ID,
              filterValue: 'Last month',
              chart: false,
            },
          },
        },
      }),
    );

    await until(() =>
      expect(screen.getByText('Longer than 90 days')).toBeInTheDocument(),
    );
    expect(applyButton()).toBeDisabled();

    await userEvent.click(screen.getByText('Pick last week'));

    await until(() => expect(applyButton()).toBeEnabled());
    expect(screen.queryByText('Longer than 90 days')).not.toBeInTheDocument();
  } finally {
    teardownLimits();
  }
});

test('limits on: removing a held chart unlocks Apply filters', async () => {
  setupLimits();
  try {
    const store = renderLimitsBar(
      timeRangeState({
        value: 'Last month',
        holds: {
          18: {
            signature: '{}',
            status: 'invalid',
            failures: [
              {
                reason: 'MAX_SPAN_EXCEEDED',
                rule: 'max_span',
                field: 'range',
                limit: {
                  source: 'dashboard',
                  quantity: 90,
                  time_grain: 'P1D',
                },
                message: "Range can't be longer than 90 days.",
                range: {
                  since: '2026-06-30T00:00:00',
                  until: '2026-10-30T00:00:00',
                  time_offset: null,
                  source: [
                    { kind: 'granularity', query_index: 0, index: null },
                  ],
                },
              },
            ],
            attribution: {
              filterId: TIME_FILTER_ID,
              filterValue: 'Last month',
              chart: false,
            },
          },
        },
      }),
    );

    await until(() =>
      expect(screen.getByText('Longer than 90 days')).toBeInTheDocument(),
    );
    expect(applyButton()).toBeDisabled();

    act(() => {
      store.dispatch(removeChart(18));
    });

    await until(() =>
      expect(screen.queryByText('Longer than 90 days')).not.toBeInTheDocument(),
    );
    await userEvent.click(screen.getByText('Pick last week'));
    await until(() => expect(applyButton()).toBeEnabled());
    expect(screen.queryByText('Longer than 90 days')).not.toBeInTheDocument();
  } finally {
    teardownLimits();
  }
});

test('limits on: Apply filters sends the picked value to Redux and the filter key without the error keys', async () => {
  setupLimits();
  const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');
  try {
    const store = renderLimitsBar(timeRangeState());
    await until(() =>
      expect(screen.getByText('Longer than 90 days')).toBeInTheDocument(),
    );
    expect(applyButton()).toBeDisabled();

    await userEvent.click(screen.getByText('Pick last week'));
    await until(() => expect(applyButton()).toBeEnabled());
    await userEvent.click(applyButton());

    await until(() =>
      expect(
        store.getState().dataMask[TIME_FILTER_ID]?.filterState?.value,
      ).toBe('Last week'),
    );
    expect(
      store.getState().dataMask[TIME_FILTER_ID].filterState,
    ).not.toHaveProperty('limitInvalid');
    updateDataMaskSpy.mock.calls.forEach(([, dataMask]) => {
      expect(dataMask.filterState).not.toHaveProperty('limitInvalid');
      expect(dataMask.filterState).not.toHaveProperty('validateMessage');
    });
    await until(() =>
      expect(
        String(fetchMock.callHistory.lastCall('filter-state')?.options.body),
      ).toContain('Last week'),
    );
    const body = String(
      fetchMock.callHistory.lastCall('filter-state')?.options.body,
    );
    expect(body).toContain('Last week');
    expect(body).not.toContain('limitInvalid');
    expect(body).not.toContain('Longer than');
  } finally {
    updateDataMaskSpy.mockRestore();
    teardownLimits();
  }
});

test('limits on: an invalid value the bar applies on its own reaches Redux without the error keys', async () => {
  setupLimits();
  const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');
  try {
    const state = timeRangeState();
    // The bar's auto-apply: a value with no extraFormData applied yet.
    state.dataMask[TIME_FILTER_ID].extraFormData = {};
    const store = renderLimitsBar(state);

    await until(() =>
      expect(updateDataMaskSpy).toHaveBeenCalledWith(TIME_FILTER_ID, {
        extraFormData: { time_range: 'Last year' },
        filterState: { value: 'Last year', validateStatus: undefined },
      }),
    );
    expect(
      store.getState().dataMask[TIME_FILTER_ID].filterState,
    ).not.toHaveProperty('limitInvalid');
    await until(() =>
      expect(screen.getByText('Longer than 90 days')).toBeInTheDocument(),
    );
    expect(applyButton()).toBeDisabled();
  } finally {
    updateDataMaskSpy.mockRestore();
    teardownLimits();
  }
});

test('limits on: Apply filters stays disabled with pending chart customizations', async () => {
  setupLimits();
  try {
    renderLimitsBar(
      timeRangeState({
        dashboardInfo: {
          pendingChartCustomizations: { 'CHART_CUSTOMIZATION-1': { id: 1 } },
        },
      }),
    );

    await until(() =>
      expect(screen.getByText('Longer than 90 days')).toBeInTheDocument(),
    );
    expect(applyButton()).toBeDisabled();
  } finally {
    teardownLimits();
  }
});

test.each(['loading', 'failed'])(
  'limits %s: Apply filters is disabled, also with pending chart customizations',
  async status => {
    setupLimits();
    try {
      renderLimitsBar(
        timeRangeState({
          status,
          dashboardInfo: {
            pendingChartCustomizations: { 'CHART_CUSTOMIZATION-1': { id: 1 } },
          },
        }),
      );

      await until(() => expect(applyButton()).toBeDisabled());
    } finally {
      teardownLimits();
    }
  },
);

test.each([
  ['limits on', 'loaded'],
  ['limits failed', 'failed'],
])(
  '%s: Clear all leaves the time range filter alone',
  async (_label, status) => {
    setupLimits();
    const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');
    try {
      renderLimitsBar(timeRangeState({ value: 'Last week', status }));
      await until(() => {
        expect(screen.getByText('Pick last week')).toBeInTheDocument();
        expect(screen.getByTestId(getTestId('clear-button'))).toBeEnabled();
      });
      updateDataMaskSpy.mockClear();

      await act(async () => {
        await userEvent.click(screen.getByTestId(getTestId('clear-button')));
      });
      await until(() =>
        expect(screen.getByText('Pick last week')).toHaveAttribute(
          'data-value',
          'Last week',
        ),
      );
      expect(screen.queryByText(LIMIT_ERROR)).not.toBeInTheDocument();
      expect(updateDataMaskSpy).not.toHaveBeenCalledWith(
        TIME_FILTER_ID,
        expect.anything(),
      );
    } finally {
      updateDataMaskSpy.mockRestore();
      teardownLimits();
    }
  },
);

test('limits loading: Clear all leaves the time range filter alone once the limits load', async () => {
  setupLimits();
  try {
    const store = renderLimitsBar(
      timeRangeState({ value: 'Last week', status: 'loading' }),
    );
    await until(() =>
      expect(screen.getByTestId(getTestId('clear-button'))).toBeEnabled(),
    );

    await act(async () => {
      await userEvent.click(screen.getByTestId(getTestId('clear-button')));
    });
    act(() => {
      store.dispatch({
        type: TIME_RANGE_LIMITS_LOADED,
        request: 1,
        payload: timeRangeState().timeRangeLimits.payload,
      });
    });

    await until(() =>
      expect(screen.getByText('Pick last week')).toHaveAttribute(
        'data-value',
        'Last week',
      ),
    );
    expect(screen.queryByText(LIMIT_ERROR)).not.toBeInTheDocument();
  } finally {
    teardownLimits();
  }
});

test('limits loaded with no rule: Clear all and Apply filters clear the time range filter', async () => {
  setupLimits();
  const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');
  try {
    const state = timeRangeState({ value: 'Last week' });
    renderLimitsBar({
      ...state,
      timeRangeLimits: {
        ...state.timeRangeLimits,
        payload: {
          global: LIMITS_UNSET,
          dashboard: LIMITS_UNSET,
          datasets: [],
          timezone: 'UTC',
        },
      },
    });
    await until(() =>
      expect(screen.getByText('Pick last week')).toBeInTheDocument(),
    );
    updateDataMaskSpy.mockClear();

    await act(async () => {
      await userEvent.click(screen.getByTestId(getTestId('clear-button')));
    });

    await act(async () => {
      await userEvent.click(applyButton());
    });

    expect(updateDataMaskSpy).toHaveBeenCalledWith(
      TIME_FILTER_ID,
      expect.objectContaining({
        extraFormData: {},
        filterState: expect.objectContaining({ value: undefined }),
      }),
    );
  } finally {
    updateDataMaskSpy.mockRestore();
    teardownLimits();
  }
});

test('flag off: Clear all and Apply filters clear the time range filter', async () => {
  setupLimits();
  window.featureFlags = {};
  const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');
  try {
    renderLimitsBar(timeRangeState({ value: 'Last week' }));
    await until(() =>
      expect(screen.getByText('Pick last week')).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByTestId(getTestId('clear-button')));

    await act(async () => {
      await userEvent.click(applyButton());
    });

    expect(updateDataMaskSpy).toHaveBeenCalledWith(
      TIME_FILTER_ID,
      expect.objectContaining({
        extraFormData: {},
        filterState: expect.objectContaining({ value: undefined }),
      }),
    );
  } finally {
    updateDataMaskSpy.mockRestore();
    teardownLimits();
  }
});

test('while the limits block Apply filters, it points at the invalid filter error, and not once a valid value is picked', async () => {
  setupLimits();
  try {
    renderLimitsBar(timeRangeState());
    await until(() =>
      expect(applyButton()).toHaveAttribute(
        'aria-describedby',
        `${TIME_FILTER_ID}-limit-error`,
      ),
    );
    expect(
      document.getElementById(`${TIME_FILTER_ID}-limit-error`),
    ).toHaveTextContent('Longer than 90 days');

    await userEvent.click(screen.getByText('Pick last week'));

    await until(() => expect(applyButton()).toBeEnabled());
    expect(applyButton()).not.toHaveAttribute('aria-describedby');
  } finally {
    teardownLimits();
  }
});

test('limits failed: Apply filters points at the limits-failed sentence', async () => {
  setupLimits();
  // Stands in for the dashboard's limits-failed alert, which this harness leaves out.
  const sentence = document.createElement('span');
  sentence.id = LIMITS_FAILED_TEXT_ID;
  document.body.appendChild(sentence);
  try {
    renderLimitsBar(timeRangeState({ status: 'failed' }));

    await until(() =>
      expect(applyButton()).toHaveAttribute(
        'aria-describedby',
        LIMITS_FAILED_TEXT_ID,
      ),
    );
    expect(applyButton()).toBeDisabled();
  } finally {
    sentence.remove();
    teardownLimits();
  }
});

test.each([
  [
    'limits failed, the limits-failed sentence not in the page',
    'failed',
    false,
  ],
  ['limits loading', 'loading', true],
])(
  '%s: Apply filters is disabled with no aria-describedby',
  async (_label, status, sentenceInPage) => {
    setupLimits();
    const sentence = document.createElement('span');
    sentence.id = LIMITS_FAILED_TEXT_ID;
    if (sentenceInPage) {
      document.body.appendChild(sentence);
    }
    try {
      renderLimitsBar(timeRangeState({ status }));
      await until(() => expect(applyButton()).toBeDisabled());
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });

      expect(applyButton()).not.toHaveAttribute('aria-describedby');
    } finally {
      sentence.remove();
      teardownLimits();
    }
  },
);

test('flag off: Apply filters has no aria-describedby', async () => {
  setupLimits();
  window.featureFlags = {};
  try {
    renderLimitsBar(timeRangeState());
    await until(() =>
      expect(screen.getByText('Pick last week')).toBeInTheDocument(),
    );

    expect(applyButton()).not.toHaveAttribute('aria-describedby');
  } finally {
    teardownLimits();
  }
});

test('Apply filters records the applied Time Range value for the focus move', async () => {
  setupLimits();
  try {
    const store = renderLimitsBar(timeRangeState());
    await until(() =>
      expect(screen.getByText('Longer than 90 days')).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByText('Pick last week'));
    await until(() => expect(applyButton()).toBeEnabled());

    await userEvent.click(applyButton());

    expect(store.getState().timeRangeLimits.userApply?.filters).toEqual({
      [TIME_FILTER_ID]: 'Last week',
    });
  } finally {
    teardownLimits();
  }
});

test('flag off: Apply filters records nothing', async () => {
  setupLimits();
  window.featureFlags = {};
  try {
    const store = renderLimitsBar(timeRangeState({ value: 'Last month' }));
    await until(() =>
      expect(screen.getByText('Pick last week')).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByText('Pick last week'));
    await until(() => expect(applyButton()).toBeEnabled());

    await userEvent.click(applyButton());

    expect(store.getState().timeRangeLimits.userApply).toBeUndefined();
  } finally {
    teardownLimits();
  }
});
