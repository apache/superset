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
import fetchMock from 'fetch-mock';
import rison from 'rison';
import { Preset, type Policy } from '@superset-ui/core';
import chartQueries from 'spec/fixtures/mockChartQueries';
import { dashboardLayout } from 'spec/fixtures/mockDashboardLayout';
import mockDatasource from 'spec/fixtures/mockDatasource';
import { buildNativeFilter } from 'spec/fixtures/mockNativeFilters';
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import {
  RangeFilterPlugin,
  SelectFilterPlugin,
  TimeFilterPlugin,
} from 'src/filters/components';
import { DateFilterTestKey } from 'src/explore/components/controls/DateFilterControl/utils';
import FiltersConfigModal from '../FiltersConfigModal';

export class MainPreset extends Preset {
  constructor() {
    super({
      name: 'Filters',
      plugins: [
        new SelectFilterPlugin().configure({ key: 'filter_select' }),
        new RangeFilterPlugin().configure({ key: 'filter_range' }),
        new TimeFilterPlugin().configure({ key: 'filter_time' }),
      ],
    });
  }
}

export const LIMITS = 'glob:*/api/v1/dashboard/1/time_range_limits/';
export const TIME_RANGE = 'glob:*/api/v1/time_range/*';
export const CHART_DATA = 'glob:*/api/v1/chart/data*';
export const LIMITS_FAILED =
  'Time range limits could not be loaded. Queries are paused to protect the database.';
export const LAST_YEAR_FAILURE = 'Longer than this dashboard allows (3 months)';
export const LIMITS_ALERT = 'This dashboard limits time ranges to 3 months.';
export const LIMITS_SHOWN = /Limit on this|This dashboard limits/;
export const REQUIRED_TITLE =
  /^filter has default value \(required while time range limits are on\)/i;
export const DEFAULT_VALUE = /^filter has default value$/i;
export const PLAIN_OR_REQUIRED = /^filter has default value/i;
export const ALERT_TITLE = 'Values load after you save';
export const LIMIT_ERROR = {
  message: 'Choose a start and an end date. Time range limits are on.',
  error_type: 'TIME_RANGE_LIMIT_ERROR',
  level: 'error',
  extra: { reason_code: 'UNBOUNDED_RANGE' },
};

/*
 * The server's clock is 2025-05-31 14:30; its answers below are the ones
 * /api/v1/time_range/ gives for these ranges at that time.
 */
export const SERVER: Record<string, [string, string]> = {
  'today : now': ['2025-05-31T00:00:00', '2025-05-31T14:30:00'],
  'Last week': ['2025-05-24T00:00:00', '2025-05-31T00:00:00'],
  'Last month': ['2025-04-30T00:00:00', '2025-05-31T00:00:00'],
  'Last quarter': ['2025-02-28T00:00:00', '2025-05-31T00:00:00'],
  'Last year': ['2024-05-31T00:00:00', '2025-05-31T00:00:00'],
  'No filter': ['', ''],
  '2025-01-01 : ': ['2025-01-01T00:00:00', ''],
};

export const rule = (quantity: number, timeGrain: string) => ({
  quantity,
  time_grain: timeGrain,
});

export const policy = (rules: Partial<Policy> = {}): Policy => ({
  max_span: null,
  max_look_back: null,
  max_look_forward: null,
  ...rules,
});

export const POLICY_A = policy({
  max_span: rule(3, 'P1M'),
  max_look_back: rule(13, 'P1M'),
  max_look_forward: rule(0, 'P1D'),
});

export const payload = (
  dashboard: Policy | null = POLICY_A,
  extra: Record<string, unknown> = {},
) => ({
  result: {
    schema_version: 1,
    global_revision: 0,
    global: policy(),
    dashboard: dashboard ?? policy(),
    datasets: [],
    timezone: 'Europe/Warsaw',
    ...extra,
  },
});

let delays: Record<string, number> = {};
let delayedPending = 0;

export const delayedAnswersPending = () => delayedPending;

export const setDelays = (next: Record<string, number>) => {
  delays = next;
};
let limitsAnswer: unknown;

export const setLimitsAnswer = (answer: unknown) => {
  limitsAnswer = answer;
};

export function mockTimeRange() {
  fetchMock.get(TIME_RANGE, async ({ url }: { url: string }) => {
    const request = rison.decode(new URL(url).searchParams.get('q')!) as
      | string
      | { timeRange: string }[];
    const items =
      typeof request === 'string' ? [{ timeRange: request }] : request;
    const delay = Math.max(0, ...items.map(i => delays[i.timeRange] ?? 0));
    if (delay) {
      delayedPending += 1;
      await new Promise(done => setTimeout(done, delay));
      delayedPending -= 1;
    }
    return {
      result: items.map(({ timeRange }) => {
        const [since, until] = SERVER[timeRange] ?? ['', ''];
        return { since, until, timeRange, shift: null };
      }),
    };
  });
}

export const datasetResult = {
  id: 1,
  result: {
    metrics: [],
    columns: [{ column_name: 'state', filterable: true }],
    table_name: 'birth_names',
    database: { id: 1, database_name: 'examples' },
    datasource_type: 'table',
    schema: 'public',
    id: 1,
  },
};

export function mockServer({
  limits = payload() as unknown,
  chartData = {
    result: [
      { status: 'success', data: [{ state: 'CA' }], applied_filters: [] },
    ],
  } as unknown,
  secondDataset = false,
} = {}) {
  limitsAnswer = limits;
  fetchMock.get(LIMITS, () => limitsAnswer as object);
  mockTimeRange();
  fetchMock.get('glob:*/api/v1/dataset/1*', datasetResult);
  if (secondDataset) {
    // A new filter starts on the fixtures' most used dataset, 7.
    fetchMock.get('glob:*/api/v1/dataset/7*', {
      id: 7,
      result: { ...datasetResult.result, id: 7 },
    });
    fetchMock.get('glob:*/api/v1/dataset/2*', {
      id: 2,
      result: { ...datasetResult.result, id: 2, table_name: 'second_table' },
    });
  }
  fetchMock.get(
    'glob:*/api/v1/dataset/?*',
    secondDataset
      ? {
          result: [
            {
              id: 2,
              table_name: 'second_table',
              database: { database_name: 'examples' },
              schema: 'public',
            },
          ],
          count: 1,
        }
      : { result: [], count: 0 },
  );
  fetchMock.post(CHART_DATA, chartData as object);
}

export const timeFilter = (id: string, value?: string, name = 'Date') => ({
  id,
  name,
  filterType: 'filter_time',
  targets: [{}],
  controlValues: {},
  defaultDataMask: {
    extraFormData: value ? { time_range: value } : {},
    filterState: { value },
    ownState: {},
  },
  cascadeParentIds: [],
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
  type: 'NATIVE_FILTER',
  description: '',
});

export const selectFilter = (id = 'NATIVE_FILTER-S1') => {
  const filter = buildNativeFilter(id, 'state', []);
  return { ...filter, defaultDataMask: { extraFormData: {}, filterState: {} } };
};

export type Config = Record<string, unknown>[];

export function renderModal(
  config: Config,
  {
    initialFilterId,
    createNewOnOpen = false,
    // A pending save keeps the modal open, as the tests only read its changes.
    onSave = jest.fn(() => new Promise<void>(() => {})),
    customizations = [],
    timeRangeLimits,
  }: {
    initialFilterId?: string;
    createNewOnOpen?: boolean;
    onSave?: jest.Mock;
    customizations?: Config;
    timeRangeLimits?: Record<string, unknown>;
  } = {},
) {
  render(
    <FiltersConfigModal
      isOpen
      createNewOnOpen={createNewOnOpen}
      initialFilterId={initialFilterId}
      onSave={onSave}
      onCancel={jest.fn()}
    />,
    {
      initialState: {
        datasources: { ...mockDatasource },
        charts: chartQueries,
        dashboardLayout,
        dashboardInfo: {
          id: 1,
          metadata: {
            native_filter_configuration: config,
            chart_customization_config: customizations,
          },
        },
        ...(timeRangeLimits ? { timeRangeLimits } : {}),
      },
      useDnd: true,
      useRedux: true,
    },
  );
  return onSave;
}

export const limitCalls = () => fetchMock.callHistory.calls(LIMITS).length;

export const previewCalls = () =>
  fetchMock.callHistory
    .calls(CHART_DATA)
    .map(call => JSON.parse(call.options.body as string).form_data);

// Role queries are slow on the whole modal, so the busiest lookups use ids.
export const saveButton = () =>
  screen.getByTestId('native-filter-modal-save-button');

export const nameInputs = () =>
  screen.getAllByTestId('filters-config-modal__name-input');

export const visibleNameInput = () =>
  nameInputs().find(
    input => !input.closest('[style*="display: none"]'),
  ) as HTMLElement;

export const defaultValueBox = () =>
  Array.from(document.querySelectorAll('.ant-checkbox-wrapper'))
    .find(
      label =>
        PLAIN_OR_REQUIRED.test(label.textContent ?? '') &&
        !label.closest('[style*="display: none"]'),
    )
    ?.querySelector('input') as HTMLInputElement;

export const listTab = (name: string) =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]')).find(tab =>
    tab.textContent?.startsWith(name),
  ) as HTMLElement;

export const typeName = (name: string) =>
  fireEvent.change(visibleNameInput(), { target: { value: name } });

export async function rename(name = 'Renamed') {
  typeName(name);
  await waitFor(() => expect(saveButton()).toBeEnabled(), { timeout: 3000 });
}

const openDropdown = () => {
  const dropdowns = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
    ),
  );
  return dropdowns[dropdowns.length - 1];
};

export const pickOpenOption = async (text: RegExp) => {
  const option = await waitFor(() => within(openDropdown()).getByText(text));
  await userEvent.click(option);
};

export const flush = () => act(() => new Promise(done => setTimeout(done, 0)));

export const rejectPreview = (error = LIMIT_ERROR) => ({
  status: 400,
  body: { errors: [error] },
  headers: { 'Content-Type': 'application/json' },
});

export const typedCalls = () =>
  previewCalls().filter(formData => formData.type === 'NATIVE_FILTER');

export const previewAlert = () => screen.queryByText(ALERT_TITLE);

export const slot = () =>
  document.querySelector('[data-test="default-input"]') as HTMLElement | null;

export const defaultSlot = () =>
  document.querySelector('[data-test="default-input"]') as HTMLElement;

export const pickerTrigger = (container: HTMLElement) =>
  within(
    within(container).getByTestId(DateFilterTestKey.PopoverOverlay),
  ).getByRole('button');

export const slotTrigger = () => pickerTrigger(defaultSlot());

export const explain = () =>
  defaultSlot().querySelector('.ant-form-item-explain') as HTMLElement | null;

export const explainAlert = () =>
  defaultSlot().querySelector('.ant-form-item-explain [role="alert"]');
