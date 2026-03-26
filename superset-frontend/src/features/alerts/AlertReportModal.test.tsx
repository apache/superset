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
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
  createStore,
  fireEvent,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { buildErrorTooltipMessage } from './buildErrorTooltipMessage';
import AlertReportModal, { AlertReportModalProps } from './AlertReportModal';
import { AlertObject, NotificationMethodOption } from './types';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: () => true,
}));

jest.mock('src/features/databases/state.ts', () => ({
  useCommonConf: () => ({
    ALERT_REPORTS_NOTIFICATION_METHODS: ['Email', 'Slack', 'SlackV2'],
  }),
}));

const mockGetChartDataRequest = jest.fn().mockResolvedValue({
  json: { result: [{ data: [] }] },
});
jest.mock('src/components/Chart/chartAction', () => ({
  ...jest.requireActual('src/components/Chart/chartAction'),
  getChartDataRequest: (...args: unknown[]) => mockGetChartDataRequest(...args),
}));

const generateMockPayload = (dashboard = true) => {
  const mockPayload = {
    active: false,
    context_markdown: 'string',
    creation_method: 'alerts_reports',
    crontab: '0 0 * * *',
    custom_width: null,
    database: {
      database_name: 'examples',
      id: 1,
      value: 1,
    },
    description: 'Some description',
    extra: {},
    force_screenshot: true,
    grace_period: 14400,
    id: 1,
    last_eval_dttm: null,
    last_state: 'Not triggered',
    last_value: null,
    last_value_row_json: null,
    log_retention: 90,
    name: 'Test Alert',
    owners: [
      {
        first_name: 'Superset',
        id: 1,
        last_name: 'Admin',
      },
    ],
    recipients: [
      {
        id: 1,
        recipient_config_json: '{"target": "test@user.com"}',
        type: 'Email',
      },
    ],
    report_format: 'PNG',
    sql: 'Select * From DB',
    timezone: 'America/Rainy_River',
    type: 'Alert',
    validator_config_json: '{"threshold": 10.0, "op": "<"}',
    validator_type: 'operator',
    working_timeout: 3600,
  };
  if (dashboard) {
    return {
      ...mockPayload,
      dashboard: { id: 1, dashboard_title: 'Test Dashboard' },
    };
  }
  return {
    ...mockPayload,
    chart: {
      id: 1,
      slice_name: 'test chart',
      viz_type: 'table',
      value: 1,
    },
  };
};

// mocking resource endpoints
const FETCH_DASHBOARD_ENDPOINT = 'glob:*/api/v1/report/1';
const FETCH_CHART_ENDPOINT = 'glob:*/api/v1/report/2';
const FETCH_REPORT_WITH_FILTERS_ENDPOINT = 'glob:*/api/v1/report/3';
const FETCH_REPORT_NO_FILTER_NAME_ENDPOINT = 'glob:*/api/v1/report/4';
const FETCH_REPORT_OVERWRITE_ENDPOINT = 'glob:*/api/v1/report/5';

fetchMock.get(
  FETCH_DASHBOARD_ENDPOINT,
  { result: generateMockPayload(true) },
  { name: FETCH_DASHBOARD_ENDPOINT },
);
fetchMock.get(
  FETCH_CHART_ENDPOINT,
  { result: generateMockPayload(false) },
  { name: FETCH_CHART_ENDPOINT },
);
fetchMock.get(FETCH_REPORT_WITH_FILTERS_ENDPOINT, {
  result: {
    ...generateMockPayload(true),
    id: 3,
    type: 'Report',
    extra: {
      dashboard: {
        anchor: 'TAB_1',
        nativeFilters: [
          {
            nativeFilterId: 'NATIVE_FILTER-abc123',
            filterName: 'Country',
            filterType: 'filter_select',
            columnName: 'country',
            columnLabel: 'Country',
            filterValues: ['USA'],
          },
        ],
      },
    },
  },
});
fetchMock.get(FETCH_REPORT_NO_FILTER_NAME_ENDPOINT, {
  result: {
    ...generateMockPayload(true),
    id: 4,
    type: 'Report',
    extra: {
      dashboard: {
        nativeFilters: [
          {
            nativeFilterId: 'NATIVE_FILTER-xyz789',
            filterType: 'filter_select',
            columnName: 'region',
            columnLabel: 'Region',
            filterValues: ['West'],
          },
        ],
      },
    },
  },
});
fetchMock.get(FETCH_REPORT_OVERWRITE_ENDPOINT, {
  result: {
    ...generateMockPayload(true),
    id: 5,
    type: 'Report',
    extra: {
      dashboard: {
        nativeFilters: [
          {
            nativeFilterId: 'NATIVE_FILTER-abc123',
            filterName: 'Country',
            filterType: 'filter_select',
            columnName: 'country',
            columnLabel: 'Country',
            filterValues: ['USA'],
          },
        ],
      },
    },
  },
});

const FETCH_REPORT_INVALID_ANCHOR_ENDPOINT = 'glob:*/api/v1/report/7';
fetchMock.get(FETCH_REPORT_INVALID_ANCHOR_ENDPOINT, {
  result: {
    ...generateMockPayload(true),
    id: 7,
    type: 'Report',
    extra: {
      dashboard: {
        anchor: 'TAB_999',
        nativeFilters: [],
      },
    },
  },
});

// Related mocks — component uses /api/v1/report/related/* endpoints for both
// alerts and reports, so we mock both the legacy alert paths and the actual
// report paths used by the component.
const ownersEndpoint = 'glob:*/api/v1/alert/related/owners?*';
const databaseEndpoint = 'glob:*/api/v1/alert/related/database?*';
const dashboardEndpoint = 'glob:*/api/v1/alert/related/dashboard?*';
const chartEndpoint = 'glob:*/api/v1/alert/related/chart?*';
const reportDashboardEndpoint = 'glob:*/api/v1/report/related/dashboard?*';
const reportChartEndpoint = 'glob:*/api/v1/report/related/chart?*';
const tabsEndpoint = 'glob:*/api/v1/dashboard/1/tabs';

fetchMock.get(ownersEndpoint, { result: [] });
fetchMock.get(databaseEndpoint, { result: [] });
fetchMock.get(dashboardEndpoint, { result: [] });
fetchMock.get(chartEndpoint, { result: [{ text: 'table chart', value: 1 }] });
fetchMock.get(reportDashboardEndpoint, { result: [] });
fetchMock.get(reportChartEndpoint, {
  result: [{ text: 'table chart', value: 1 }],
});
fetchMock.get(
  tabsEndpoint,
  {
    result: {
      all_tabs: {},
      tab_tree: [],
    },
  },
  { name: tabsEndpoint },
);

// Chart detail endpoint — called by getChartVisualizationType when a chart is selected
fetchMock.get('glob:*/api/v1/chart/*', {
  result: { viz_type: 'table' },
});

// Restore the default tabs route and remove any test-specific overrides.
// Called in afterEach so cleanup runs even when a test fails mid-way.
const restoreDefaultTabsRoute = () => {
  for (const name of [
    'clear-icon-tabs',
    'clear-icon-chart-data',
    'deferred-tabs',
    'overwrite-chart-data',
  ]) {
    try {
      fetchMock.removeRoute(name);
    } catch {
      // route may not exist if the test that adds it didn't run
    }
  }
  // Re-add the default empty tabs route if it was replaced
  try {
    fetchMock.removeRoute(tabsEndpoint);
  } catch {
    // already removed
  }
  fetchMock.get(
    tabsEndpoint,
    { result: { all_tabs: {}, tab_tree: [] } },
    { name: tabsEndpoint },
  );
};

afterEach(() => {
  restoreDefaultTabsRoute();

  // Clear call history so stale counts don't leak between tests
  fetchMock.callHistory.clear();

  // Remove test-specific named routes (try/catch — may not exist)
  for (const name of [
    'put-condition',
    'put-edit',
    'put-extra-dashboard',
    'create-post',
    'put-dashboard-payload',
    'put-report-1',
    'put-no-recipients',
    'tabs-99',
  ]) {
    try {
      fetchMock.removeRoute(name);
    } catch {
      // route may not exist
    }
  }

  // Reset chartData mock so stale resolved values don't leak
  mockGetChartDataRequest.mockReset();
  mockGetChartDataRequest.mockResolvedValue({
    json: { result: [{ data: [] }] },
  });
});

// Create a valid alert with all required fields entered for validation check

// @ts-expect-error will add id in factory function
const validAlert: AlertObject = {
  active: false,
  changed_on_delta_humanized: 'now',
  created_on: '2023-12-12T22:33:25.927764',
  creation_method: 'alerts_reports',
  crontab: '0 0 * * *',
  dashboard_id: 0,
  chart_id: 1,
  force_screenshot: false,
  last_state: 'Not triggered',
  name: 'Test Alert',
  owners: [
    {
      first_name: 'Superset',
      id: 1,
      last_name: 'Admin',
    },
  ],
  recipients: [
    {
      type: NotificationMethodOption.Email,
      recipient_config_json: { target: 'test@user.com' },
    },
  ],
  timezone: 'America/Rainy_River',
  type: 'Alert',
  database: {
    id: 1,
    value: 1,
    database_name: 'test_db',
  } as any,
  sql: 'SELECT COUNT(*) FROM test_table',
  validator_config_json: {
    op: '>',
    threshold: 10.0,
  },
  working_timeout: 3600,
  chart: {
    id: 1,
    value: 1,
    label: 'Test Chart',
    slice_name: 'Test Chart',
    viz_type: 'table',
  } as any,
};

jest.mock('./buildErrorTooltipMessage', () => ({
  buildErrorTooltipMessage: jest.fn(),
}));

const generateMockedProps = (
  isReport = false,
  useValidAlert = false,
  useDashboard = true,
): AlertReportModalProps => {
  let alert;
  // switching ids for endpoint when testing dashboard vs chart edits
  if (useDashboard) {
    alert = { ...validAlert, id: 1 };
  } else {
    alert = { ...validAlert, id: 2 };
  }

  return {
    addDangerToast: () => {},
    addSuccessToast: () => {},
    onAdd: jest.fn(() => []),
    onHide: jest.fn(),
    alert: useValidAlert ? alert : null,
    show: true,
    isReport,
  };
};

// combobox selector for mocking user input
const comboboxSelect = async (
  element: HTMLElement,
  value: string,
  newElementQuery: Function,
) => {
  expect(element).toBeInTheDocument();
  userEvent.type(element, `${value}{enter}`);
  const newElement = newElementQuery();
  expect(newElement).toBeInTheDocument();
};

// --------------- TEST SECTION ------------------
test('properly renders add alert text', () => {
  const addAlertProps = generateMockedProps();
  render(<AlertReportModal {...addAlertProps} />, { useRedux: true });
  // The title is now in the modal header, not as a heading role
  expect(screen.getByText('Add alert')).toBeInTheDocument();
  const addButton = screen.getByRole('button', { name: /add/i });
  expect(addButton).toBeInTheDocument();
});

test('properly renders edit alert text', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true)} />, {
    useRedux: true,
  });
  // The title is now in the modal header, not as a heading role
  expect(screen.getByText('Edit alert')).toBeInTheDocument();
  const saveButton = screen.getByRole('button', { name: /save/i });
  expect(saveButton).toBeInTheDocument();
});

test('properly renders add report text', () => {
  render(<AlertReportModal {...generateMockedProps(true)} />, {
    useRedux: true,
  });
  // The title is now in the modal header, not as a heading role
  expect(screen.getByText('Add report')).toBeInTheDocument();
  const addButton = screen.getByRole('button', { name: /add/i });
  expect(addButton).toBeInTheDocument();
});

test('properly renders edit report text', async () => {
  render(<AlertReportModal {...generateMockedProps(true, true)} />, {
    useRedux: true,
  });

  // The title is now in the modal header, not as a heading role
  expect(screen.getByText('Edit report')).toBeInTheDocument();
  const saveButton = screen.getByRole('button', { name: /save/i });
  expect(saveButton).toBeInTheDocument();
});

test('renders 4 sections for reports', () => {
  render(<AlertReportModal {...generateMockedProps(true)} />, {
    useRedux: true,
  });
  const sections = screen.getAllByRole('tab');
  expect(sections.length).toBe(4);
});

test('renders 5 sections for alerts', () => {
  render(<AlertReportModal {...generateMockedProps(false)} />, {
    useRedux: true,
  });

  const sections = screen.getAllByRole('tab');
  expect(sections.length).toBe(5);
});

// Validation
test('renders 5 checkmarks for a valid alert', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });

  // Wait for validation to complete by waiting for the modal to fully render
  await screen.findByText('Edit alert');

  const checkmarks = await screen.findAllByRole('img', {
    name: /check-circle/i,
  });
  expect(checkmarks.length).toEqual(5);
});

test('renders single checkmarks when creating a new alert', async () => {
  render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
    useRedux: true,
  });
  const checkmarks = await screen.findAllByRole('img', {
    name: /check-circle/i,
  });
  expect(checkmarks.length).toEqual(1);
});

test('disables save when validation fails', () => {
  render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
    useRedux: true,
  });

  expect(screen.getByRole('button', { name: /add/i })).toBeDisabled();
});

test('calls build tooltip', async () => {
  render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
    useRedux: true,
  });
  expect(buildErrorTooltipMessage).toHaveBeenCalled();
  expect(buildErrorTooltipMessage).toHaveBeenLastCalledWith({
    alertConditionSection: {
      errors: ['database', 'sql', 'alert condition'],
      name: 'Alert condition',
      hasErrors: true,
    },
    contentSection: {
      errors: ['content type'],
      name: 'Alert contents',
      hasErrors: true,
    },
    generalSection: {
      errors: ['name'],
      name: 'General information',
      hasErrors: true,
    },
    notificationSection: {
      errors: ['recipients'],
      name: 'Notification method',
      hasErrors: true,
    },
    scheduleSection: { errors: [], name: 'Schedule', hasErrors: false },
  });
});

// General Section
test('opens General Section on render', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });
  const general_header = within(
    screen.getByRole('tab', { expanded: true }),
  ).queryByText(/general information/i);
  expect(general_header).toBeInTheDocument();
});

test('renders all fields in General Section', () => {
  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });
  const name = screen.getByPlaceholderText(/enter alert name/i);
  const owners = screen.getByTestId('owners-select');
  const description = screen.getByPlaceholderText(
    /include description to be sent with alert/i,
  );
  const activeSwitch = screen.getByRole('switch');

  expect(name).toBeInTheDocument();
  expect(owners).toBeInTheDocument();
  expect(description).toBeInTheDocument();
  expect(activeSwitch).toBeInTheDocument();
});

// Alert Condition Section
/* A Note on textbox total numbers:
  Because the General Info panel is open by default, the Name and Description textboxes register as being in the document on all tests, thus the total number of textboxes in each subsequent panel's tests will always be n+2. This is most significant in the Alert Condition panel tests because the nature of the SQL field as a TextAreaContol component may only be queried by role */
test('opens Alert Condition Section on click', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('alert-condition-panel'));
  const alertConditionHeader = within(
    screen.getByRole('tab', { expanded: true }),
  ).queryByText(/alert condition/i);
  expect(alertConditionHeader).toBeInTheDocument();
});
test('renders all Alert Condition fields', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('alert-condition-panel'));
  const database = screen.getByRole('combobox', { name: /database/i });
  const sql = screen.getByRole('textbox');
  const condition = screen.getByRole('combobox', { name: /condition/i });
  const threshold = screen.getByRole('spinbutton');
  expect(database).toBeInTheDocument();
  expect(sql).toBeInTheDocument();
  expect(condition).toBeInTheDocument();
  expect(threshold).toBeInTheDocument();
});
test('disables condition threshold if not null condition is selected', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('alert-condition-panel'));
  await screen.findByText(/smaller than/i);
  const condition = screen.getByRole('combobox', { name: /condition/i });
  const spinButton = screen.getByRole('spinbutton');
  expect(spinButton).toHaveValue(10);
  await comboboxSelect(
    condition,
    'not null',
    () => screen.getAllByText(/not null/i)[0],
  );
  expect(spinButton).toHaveValue(null);
  expect(spinButton).toBeDisabled();
});

// Content Section
test('opens Contents Section on click', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('contents-panel'));
  const contentsHeader = within(
    screen.getByRole('tab', { expanded: true }),
  ).queryByText(/contents/i);
  expect(contentsHeader).toBeInTheDocument();
});

test('renders screenshot options when dashboard is selected', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, true)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);
  expect(
    screen.getByRole('combobox', { name: /select content type/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('combobox', { name: /dashboard/i }),
  ).toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  expect(
    screen.getByRole('checkbox', {
      name: /ignore cache when generating report/i,
    }),
  ).toBeInTheDocument();
});

test('renders tab selection when Dashboard is selected', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, true)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);
  expect(
    screen.getByRole('combobox', { name: /select content type/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('combobox', { name: /dashboard/i }),
  ).toBeInTheDocument();
  expect(screen.getAllByText(/select tab/i)).toHaveLength(1);
});

test('changes to content options when chart is selected', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, true)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);
  const contentTypeSelector = screen.getByRole('combobox', {
    name: /select content type/i,
  });
  await comboboxSelect(contentTypeSelector, 'Chart', () =>
    screen.getByRole('combobox', { name: /chart/i }),
  );
  expect(
    screen.getByRole('combobox', {
      name: /select format/i,
    }),
  ).toBeInTheDocument();
});

test('removes ignore cache checkbox when chart is selected', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, true)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);
  expect(
    screen.getByRole('checkbox', {
      name: /ignore cache when generating report/i,
    }),
  ).toBeInTheDocument();
  const contentTypeSelector = screen.getByRole('combobox', {
    name: /select content type/i,
  });
  await comboboxSelect(
    contentTypeSelector,
    'Chart',
    () => screen.getAllByText(/select chart/i)[0],
  );
  expect(
    screen.queryByRole('checkbox', {
      name: /ignore cache when generating report/i,
    }),
  ).not.toBeInTheDocument();
});

test('does not show screenshot width when csv is selected', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test chart/i);
  const contentTypeSelector = screen.getByRole('combobox', {
    name: /select content type/i,
  });
  await comboboxSelect(contentTypeSelector, 'Chart', () =>
    screen.getByText(/select chart/i),
  );
  const reportFormatSelector = screen.getByRole('combobox', {
    name: /select format/i,
  });
  await comboboxSelect(
    reportFormatSelector,
    'CSV',
    () => screen.getAllByText(/Send as CSV/i)[0],
  );
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
});

test('shows screenshot width when PDF is selected', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test chart/i);
  const contentTypeSelector = screen.getByRole('combobox', {
    name: /select content type/i,
  });
  await comboboxSelect(contentTypeSelector, 'Chart', () =>
    screen.getByText(/select chart/i),
  );
  const reportFormatSelector = screen.getByRole('combobox', {
    name: /select format/i,
  });
  await comboboxSelect(
    reportFormatSelector,
    'PDF',
    () => screen.getAllByText(/Send as PDF/i)[0],
  );
  expect(screen.getByText(/screenshot width/i)).toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toBeInTheDocument();
});

// Schedule Section
test('opens Schedule Section on click', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('schedule-panel'));
  const scheduleHeader = within(
    screen.getByRole('tab', { expanded: true }),
  ).queryAllByText(/schedule/i)[0];
  expect(scheduleHeader).toBeInTheDocument();
});
test('renders default Schedule fields', async () => {
  render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('schedule-panel'));
  const scheduleType = screen.getByRole('combobox', {
    name: /schedule type/i,
  });
  // Wait for timezone selector to render after delay
  const timezone = await screen.findByRole('combobox', {
    name: /timezone selector/i,
  });
  const logRetention = screen.getByRole('combobox', {
    name: /log retention/i,
  });
  const gracePeriod = screen.getByPlaceholderText(/time in seconds/i);
  expect(scheduleType).toBeInTheDocument();
  expect(timezone).toBeInTheDocument();
  expect(logRetention).toBeInTheDocument();
  expect(gracePeriod).toBeInTheDocument();
});
test('renders working timout as report', async () => {
  render(<AlertReportModal {...generateMockedProps(true, false, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('schedule-panel'));
  expect(screen.getByText(/working timeout/i)).toBeInTheDocument();
});
test('renders grace period as alert', async () => {
  render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('schedule-panel'));
  expect(screen.getByText(/grace period/i)).toBeInTheDocument();
});
test('shows CRON Expression when CRON is selected', async () => {
  render(<AlertReportModal {...generateMockedProps(true, false, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('schedule-panel'));
  userEvent.click(screen.getByRole('combobox', { name: /schedule type/i }));
  userEvent.type(
    screen.getByRole('combobox', { name: /schedule type/i }),
    'cron schedule{enter}',
  );
  expect(screen.getByPlaceholderText(/cron expression/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/cron expression/i)).toBeInTheDocument();
});
test('defaults to day when CRON is not selected', async () => {
  render(<AlertReportModal {...generateMockedProps(true, false, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('schedule-panel'));
  const day = screen.getByText('day');
  expect(day).toBeInTheDocument();
});

// Notification Method Section
test('opens Notification Method Section on click', async () => {
  render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('notification-method-panel'));
  const notificationMethodHeader = within(
    screen.getByRole('tab', { expanded: true }),
  ).queryAllByText(/notification method/i)[0];
  expect(notificationMethodHeader).toBeInTheDocument();
});

test('renders all notification fields', async () => {
  render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('notification-method-panel'));
  const notificationMethod = screen.getByRole('combobox', {
    name: /delivery method/i,
  });
  const recipients = screen.getByTestId('recipients');
  const addNotificationMethod = screen.getByText(
    /add another notification method/i,
  );
  expect(notificationMethod).toBeInTheDocument();
  expect(recipients).toBeInTheDocument();
  expect(addNotificationMethod).toBeInTheDocument();
});

test('adds another notification method section after clicking add notification method', async () => {
  render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('notification-method-panel'));
  const addNotificationMethod = screen.getByText(
    /add another notification method/i,
  );
  userEvent.click(addNotificationMethod);
  expect(
    screen.getAllByRole('combobox', {
      name: /delivery method/i,
    }).length,
  ).toBe(2);
  await comboboxSelect(
    screen.getAllByRole('combobox', {
      name: /delivery method/i,
    })[1],
    'Slack',
    () => screen.getAllByRole('textbox')[1],
  );
  expect(screen.getAllByTestId('recipients').length).toBe(2);
});

test('removes notification method on clicking trash can', async () => {
  render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('notification-method-panel'));
  const addNotificationMethod = screen.getByText(
    /add another notification method/i,
  );
  userEvent.click(addNotificationMethod);
  await comboboxSelect(
    screen.getAllByRole('combobox', {
      name: /delivery method/i,
    })[1],
    'Email',
    () => screen.getAllByRole('textbox')[1],
  );
  const images = screen.getAllByRole('img');
  const trash = images[images.length - 1];
  userEvent.click(trash);
  expect(
    screen.getAllByRole('combobox', { name: /delivery method/i }).length,
  ).toBe(1);
});

test('renders dashboard filter dropdowns', async () => {
  render(<AlertReportModal {...generateMockedProps(true, true)} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByTestId('contents-panel'));
  const filterOptionDropdown = screen.getByRole('combobox', {
    name: /select filter/i,
  });
  expect(filterOptionDropdown).toBeInTheDocument();
});

// --------------- PHASE 2: Dashboard/Tab/Filter Interaction Tests ------------------

const tabsWithFilters = {
  result: {
    all_tabs: { TAB_1: 'Tab 1', TAB_2: 'Tab 2' },
    tab_tree: [
      { title: 'Tab 1', value: 'TAB_1' },
      { title: 'Tab 2', value: 'TAB_2' },
    ],
    native_filters: {
      all: [
        {
          id: 'NATIVE_FILTER-F1',
          name: 'Country Filter',
          filterType: 'filter_select',
          targets: [{ column: { name: 'country' }, datasetId: 1 }],
          adhoc_filters: [],
        },
        {
          id: 'NATIVE_FILTER-F2',
          name: 'City Filter',
          filterType: 'filter_select',
          targets: [{ column: { name: 'city' }, datasetId: 2 }],
          adhoc_filters: [],
        },
      ],
      TAB_1: [
        {
          id: 'NATIVE_FILTER-F1',
          name: 'Country Filter',
          filterType: 'filter_select',
          targets: [{ column: { name: 'country' }, datasetId: 1 }],
          adhoc_filters: [],
        },
      ],
      TAB_2: [
        {
          id: 'NATIVE_FILTER-F2',
          name: 'City Filter',
          filterType: 'filter_select',
          targets: [{ column: { name: 'city' }, datasetId: 2 }],
          adhoc_filters: [],
        },
      ],
    },
  },
};

const noTabsResponse = {
  result: {
    all_tabs: {},
    tab_tree: [],
    native_filters: {},
  },
};

test('dashboard with no tabs disables tab selector', async () => {
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(tabsEndpoint, noTabsResponse, { name: tabsEndpoint });

  render(<AlertReportModal {...generateMockedProps(true, true)} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);

  const tabSelector = document.querySelector('.ant-select-disabled');
  expect(tabSelector).toBeInTheDocument();
});

test('dashboard with no tabs and no filters hides filter add link', async () => {
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(tabsEndpoint, noTabsResponse, { name: tabsEndpoint });

  render(<AlertReportModal {...generateMockedProps(true, true)} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);

  // Wait for tabs fetch to complete
  await waitFor(() => {
    expect(fetchMock.callHistory.calls(tabsEndpoint).length).toBeGreaterThan(0);
  });

  // Tab selector should be disabled (no tabs)
  const disabledSelects = document.querySelectorAll('.ant-select-disabled');
  expect(disabledSelects.length).toBeGreaterThanOrEqual(1);

  // Filter Select should also be disabled (no filter options available)
  expect(disabledSelects.length).toBeGreaterThanOrEqual(2);

  // "Apply another dashboard filter" link should NOT appear
  // because noTabsResponse has empty native_filters ({})
  expect(
    screen.queryByText(/apply another dashboard filter/i),
  ).not.toBeInTheDocument();
});

test('dashboard switching resets tab and filter selections', async () => {
  // Return dashboard options so user can switch
  const dashboardOptions = {
    result: [
      { text: 'Test Dashboard', value: 1 },
      { text: 'Other Dashboard', value: 99 },
    ],
    count: 2,
  };
  fetchMock.removeRoute(dashboardEndpoint);
  fetchMock.get(dashboardEndpoint, dashboardOptions);
  fetchMock.removeRoute(reportDashboardEndpoint);
  fetchMock.get(reportDashboardEndpoint, dashboardOptions);

  // Dashboard 1 has tabs and filters
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(tabsEndpoint, tabsWithFilters, { name: tabsEndpoint });

  // Dashboard 99 has no tabs
  const tabs99 = 'glob:*/api/v1/dashboard/99/tabs';
  fetchMock.get(tabs99, noTabsResponse, { name: tabs99 });

  render(<AlertReportModal {...generateMockedProps(true, true)} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);

  // Wait for tabs endpoint call to complete (proves filter data is loaded)
  await waitFor(
    () => {
      expect(fetchMock.callHistory.calls(tabsEndpoint).length).toBeGreaterThan(
        0,
      );
    },
    { timeout: 5000 },
  );

  // Wait for tabs to load from dashboard 1
  await waitFor(() => {
    expect(screen.getAllByText(/select tab/i)).toHaveLength(1);
  });

  // Verify filters are available — this proves dashboard 1 has filter options
  const filterCombobox = await waitFor(() =>
    screen.getByRole('combobox', { name: /select filter/i }),
  );

  // Confirm the filter dropdown has options by opening it
  fireEvent.mouseDown(filterCombobox);
  await screen.findByText('Country Filter', {}, { timeout: 5000 });
  // Close the dropdown by pressing Escape
  fireEvent.keyDown(filterCombobox, { key: 'Escape' });

  // Switch to "Other Dashboard"
  const dashboardSelect = screen.getByRole('combobox', {
    name: /dashboard/i,
  });
  userEvent.clear(dashboardSelect);
  userEvent.type(dashboardSelect, 'Other Dashboard{enter}');

  // Tab selector should reset: "Other Dashboard" has no tabs, so disabled with placeholder
  await waitFor(
    () => {
      expect(screen.getByText(/select a tab/i)).toBeInTheDocument();
    },
    { timeout: 10000 },
  );

  // Filter row should reset to empty (no filter selected)
  await waitFor(() => {
    const filterSelects = screen.getAllByRole('combobox', {
      name: /select filter/i,
    });
    // Filter select should have no selected value (placeholder state)
    filterSelects.forEach(select => {
      const container = select.closest('.ant-select');
      expect(
        container?.querySelector('.ant-select-selection-item'),
      ).not.toBeInTheDocument();
    });
  });

  // Restore dashboard endpoints
  fetchMock.removeRoute(dashboardEndpoint);
  fetchMock.get(dashboardEndpoint, { result: [] });
  fetchMock.removeRoute(reportDashboardEndpoint);
  fetchMock.get(reportDashboardEndpoint, { result: [] });
  fetchMock.removeRoute(tabs99);
}, 45000);

test('different dashboard populates its own tabs and filters', async () => {
  // Set up a report (id:99) that uses dashboard 99 instead of dashboard 1.
  // This tests that the component correctly loads tabs and filters for a
  // different dashboard (the "dashboard B has its own data" case).
  const FETCH_REPORT_DASH99_ENDPOINT = 'glob:*/api/v1/report/99';
  fetchMock.get(FETCH_REPORT_DASH99_ENDPOINT, {
    result: {
      ...generateMockPayload(true),
      id: 99,
      type: 'Report',
      dashboard: { id: 99, dashboard_title: 'Other Dashboard' },
    },
  });

  // Dashboard 99 has its own tabs (Tab Alpha, Tab Beta) and a Region Filter
  const tabs99Endpoint = 'glob:*/api/v1/dashboard/99/tabs';
  const dash99Tabs = {
    result: {
      all_tabs: { TAB_A: 'Tab Alpha', TAB_B: 'Tab Beta' },
      tab_tree: [
        { title: 'Tab Alpha', value: 'TAB_A' },
        { title: 'Tab Beta', value: 'TAB_B' },
      ],
      native_filters: {
        all: [
          {
            id: 'NATIVE_FILTER-R1',
            name: 'Region Filter',
            filterType: 'filter_select',
            targets: [{ column: { name: 'region' }, datasetId: 3 }],
            adhoc_filters: [],
          },
        ],
        TAB_A: [
          {
            id: 'NATIVE_FILTER-R1',
            name: 'Region Filter',
            filterType: 'filter_select',
            targets: [{ column: { name: 'region' }, datasetId: 3 }],
            adhoc_filters: [],
          },
        ],
        TAB_B: [],
      },
    },
  };
  fetchMock.get(tabs99Endpoint, dash99Tabs, { name: 'tabs-99' });

  const props = generateMockedProps(true, true);
  const dash99Props = { ...props, alert: { ...validAlert, id: 99 } };

  render(<AlertReportModal {...dash99Props} />, { useRedux: true });

  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/other dashboard/i);

  // Wait for dashboard 99 tabs to load — increase timeout because the
  // component must first fetch /api/v1/report/99, then extract dashboard_id,
  // then fetch /api/v1/dashboard/99/tabs. This three-step async chain needs
  // more time in CI.
  await waitFor(
    () => {
      expect(fetchMock.callHistory.calls('tabs-99').length).toBeGreaterThan(0);
    },
    { timeout: 10000 },
  );

  // Tab selector should be enabled (dashboard 99 has tabs)
  await waitFor(() => {
    const treeSelect = document.querySelector('.ant-tree-select');
    expect(treeSelect).toBeInTheDocument();
    expect(treeSelect).not.toHaveClass('ant-select-disabled');
  });

  // Filter dropdown should show dashboard 99's "Region Filter"
  const filterSelect = await waitFor(() =>
    screen.getByRole('combobox', { name: /select filter/i }),
  );
  fireEvent.mouseDown(filterSelect);

  await screen.findByText('Region Filter', {}, { timeout: 5000 });

  // Dashboard 1's filters (Country/City) should NOT appear
  expect(screen.queryByText('Country Filter')).not.toBeInTheDocument();

  // Cleanup
  fetchMock.removeRoute(FETCH_REPORT_DASH99_ENDPOINT);
  fetchMock.removeRoute('tabs-99');
}, 45000);

test('dashboard tabs fetch failure shows error toast', async () => {
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(tabsEndpoint, 500, { name: tabsEndpoint });

  const store = createStore({}, reducerIndex);

  render(<AlertReportModal {...generateMockedProps(true, true)} />, {
    useRedux: true,
    store,
  });

  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);

  // Tab selector should remain disabled (no tabs loaded)
  const tabSelector = document.querySelector('.ant-select-disabled');
  expect(tabSelector).toBeInTheDocument();

  // Verify the tabs request was attempted
  const tabsCalls = fetchMock.callHistory.calls(tabsEndpoint);
  expect(tabsCalls.length).toBeGreaterThan(0);

  // Verify danger toast was dispatched for the fetch failure
  await waitFor(() => {
    const toasts = (store.getState() as any).messageToasts;
    expect(toasts.length).toBeGreaterThan(0);
    expect(
      toasts.some((t: { text: string }) =>
        t.text.includes('error retrieving dashboard tabs'),
      ),
    ).toBe(true);
  });
});

test('switching content type to chart hides tab and filter sections', async () => {
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(tabsEndpoint, tabsWithFilters, { name: tabsEndpoint });

  render(<AlertReportModal {...generateMockedProps(true, true)} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);

  // Tab selector and filter dropdowns should be visible for dashboard
  expect(screen.getAllByText(/select tab/i)).toHaveLength(1);
  expect(
    screen.getByRole('combobox', { name: /select filter/i }),
  ).toBeInTheDocument();

  // Switch to chart
  const contentTypeSelector = screen.getByRole('combobox', {
    name: /select content type/i,
  });
  await comboboxSelect(contentTypeSelector, 'Chart', () =>
    screen.getByRole('combobox', { name: /chart/i }),
  );

  // Tab and filter sections should be hidden
  expect(screen.queryByText(/select tab/i)).not.toBeInTheDocument();
  expect(
    screen.queryByRole('combobox', { name: /select filter/i }),
  ).not.toBeInTheDocument();
});

test('adding and removing dashboard filter rows', async () => {
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(tabsEndpoint, tabsWithFilters, { name: tabsEndpoint });

  render(<AlertReportModal {...generateMockedProps(true, true)} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);

  // Wait for filter options to load
  await waitFor(() => {
    expect(
      screen.getByRole('combobox', { name: /select filter/i }),
    ).toBeInTheDocument();
  });

  // Should start with 1 filter row
  const initialFilterSelects = screen.getAllByRole('combobox', {
    name: /select filter/i,
  });
  expect(initialFilterSelects).toHaveLength(1);

  // Click "Apply another dashboard filter"
  const addFilterButton = screen.getByText(/apply another dashboard filter/i);
  userEvent.click(addFilterButton);

  // Should now have 2 filter rows
  await waitFor(() => {
    expect(
      screen.getAllByRole('combobox', { name: /select filter/i }),
    ).toHaveLength(2);
  });

  // Remove the second filter row by clicking its delete icon
  const deleteIcons = document.querySelectorAll('.filters-trashcan');
  expect(deleteIcons.length).toBeGreaterThanOrEqual(2);
  fireEvent.click(deleteIcons[deleteIcons.length - 1]);

  // Should be back to 1 filter row
  await waitFor(() => {
    expect(
      screen.getAllByRole('combobox', { name: /select filter/i }),
    ).toHaveLength(1);
  });
});

test('alert shows condition section, report does not', () => {
  // Alert has 5 sections
  const { unmount } = render(
    <AlertReportModal {...generateMockedProps(false)} />,
    { useRedux: true },
  );
  expect(screen.getAllByRole('tab')).toHaveLength(5);
  expect(screen.getByTestId('alert-condition-panel')).toBeInTheDocument();
  unmount();

  // Report has 4 sections, no condition panel
  render(<AlertReportModal {...generateMockedProps(true)} />, {
    useRedux: true,
  });
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  expect(screen.queryByTestId('alert-condition-panel')).not.toBeInTheDocument();
});

test('submit includes conditionNotNull without threshold in alert payload', async () => {
  // Mock payload returns id:1, so updateResource PUTs to /api/v1/report/1
  fetchMock.put(
    'glob:*/api/v1/report/1',
    { id: 1, result: {} },
    { name: 'put-condition' },
  );

  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });

  // Wait for resource to load and all validation to pass
  await waitFor(
    () => {
      expect(
        screen.queryAllByRole('img', { name: /check-circle/i }),
      ).toHaveLength(5);
    },
    { timeout: 10000 },
  );

  // Open condition panel and select "not null"
  userEvent.click(screen.getByTestId('alert-condition-panel'));
  await screen.findByText(/smaller than/i);
  const condition = screen.getByRole('combobox', { name: /condition/i });
  await comboboxSelect(
    condition,
    'not null',
    () => screen.getAllByText(/not null/i)[0],
  );

  // Wait for the threshold input to become disabled after "not null" selection —
  // in CI the state update from comboboxSelect can lag behind the DOM assertion.
  await waitFor(() => {
    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });

  // Wait for Save to be enabled and click
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });
  userEvent.click(screen.getByRole('button', { name: /save/i }));

  // Verify the PUT payload
  await waitFor(() => {
    const calls = fetchMock.callHistory.calls('put-condition');
    expect(calls.length).toBeGreaterThan(0);
  });

  const calls = fetchMock.callHistory.calls('put-condition');
  const body = JSON.parse(calls[calls.length - 1].options.body as string);
  expect(body.validator_type).toBe('not null');
  expect(body.validator_config_json).toEqual({});

  fetchMock.removeRoute('put-condition');
}, 45000);

test('edit mode submit uses PUT and excludes read-only fields', async () => {
  // Mock payload returns id:1, so updateResource PUTs to /api/v1/report/1
  fetchMock.put(
    'glob:*/api/v1/report/1',
    { id: 1, result: {} },
    { name: 'put-edit' },
  );

  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });

  // Wait for resource to load and all validation to pass
  await waitFor(() => {
    expect(
      screen.queryAllByRole('img', { name: /check-circle/i }),
    ).toHaveLength(5);
  });

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });
  userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    const calls = fetchMock.callHistory.calls('put-edit');
    expect(calls.length).toBeGreaterThan(0);
  });

  const calls = fetchMock.callHistory.calls('put-edit');
  const body = JSON.parse(calls[calls.length - 1].options.body as string);

  // Edit mode strips these read-only fields
  expect(body).not.toHaveProperty('id');
  expect(body).not.toHaveProperty('created_by');
  expect(body).not.toHaveProperty('last_eval_dttm');
  expect(body).not.toHaveProperty('last_state');
  expect(body).not.toHaveProperty('last_value');
  expect(body).not.toHaveProperty('last_value_row_json');

  // Core fields remain
  expect(body.type).toBe('Alert');
  expect(body.name).toBe('Test Alert');

  // Recipients from the loaded resource should be in payload
  expect(body.recipients).toBeDefined();
  expect(body.recipients.length).toBeGreaterThan(0);
  expect(body.recipients[0].type).toBe('Email');

  fetchMock.removeRoute('put-edit');
});

test('edit mode preserves extra.dashboard tab/filter state in payload', async () => {
  // Report 3 has extra.dashboard.nativeFilters + anchor:'TAB_1'
  fetchMock.put(
    'glob:*/api/v1/report/3',
    { id: 3, result: {} },
    { name: 'put-extra-dashboard' },
  );

  // Provide tabs so TAB_1 is in allTabs and anchor is preserved
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(tabsEndpoint, tabsWithFilters, { name: tabsEndpoint });

  const props = {
    ...generateMockedProps(true, true, true),
    alert: { ...validAlert, id: 3 },
  };

  render(<AlertReportModal {...props} />, {
    useRedux: true,
  });

  // Wait for Save to be enabled (report type has fewer validation sections)
  await waitFor(
    () => {
      expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    },
    { timeout: 10000 },
  );
  userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    const calls = fetchMock.callHistory.calls('put-extra-dashboard');
    expect(calls.length).toBeGreaterThan(0);
  });

  const calls = fetchMock.callHistory.calls('put-extra-dashboard');
  const body = JSON.parse(calls[calls.length - 1].options.body as string);

  // extra.dashboard structure must be preserved in the payload
  expect(body.extra).toBeDefined();
  expect(body.extra.dashboard).toBeDefined();
  expect(body.extra.dashboard.nativeFilters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ nativeFilterId: 'NATIVE_FILTER-abc123' }),
    ]),
  );
  expect(body.extra.dashboard.anchor).toBe('TAB_1');

  fetchMock.removeRoute('put-extra-dashboard');
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(
    tabsEndpoint,
    { result: { all_tabs: {}, tab_tree: [] } },
    { name: tabsEndpoint },
  );
});

test('create mode submits POST and calls onAdd with response', async () => {
  fetchMock.post(
    'glob:*/api/v1/report/',
    { id: 100, result: {} },
    { name: 'create-post' },
  );

  const props = generateMockedProps(true); // isReport, create mode (no alert)
  const onAdd = jest.fn();
  const createProps = { ...props, onAdd };

  render(<AlertReportModal {...createProps} />, { useRedux: true });

  expect(screen.getByText('Add report')).toBeInTheDocument();

  // Fill name — fireEvent.change is instant vs userEvent.type firing 13
  // individual keystroke events, keeping this test well under the 20s timeout.
  const nameInput = screen.getByPlaceholderText(/enter report name/i);
  fireEvent.change(nameInput, { target: { value: 'My New Report' } });

  // Open contents panel — content type defaults to Dashboard
  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByRole('combobox', { name: /select content type/i });

  // Switch content type to Chart (default is Dashboard)
  const contentTypeSelect = screen.getByRole('combobox', {
    name: /select content type/i,
  });
  userEvent.click(contentTypeSelect);
  const chartOption = await screen.findByText('Chart');
  userEvent.click(chartOption);

  // Select a chart from the chart combobox
  const chartSelect = await screen.findByRole('combobox', {
    name: /chart/i,
  });
  userEvent.type(chartSelect, 'table');
  const tableChart = await screen.findByText('table chart');
  userEvent.click(tableChart);

  // Open notification panel and set recipient email
  userEvent.click(screen.getByTestId('notification-method-panel'));
  const recipientInput = await screen.findByTestId('recipients');
  fireEvent.change(recipientInput, { target: { value: 'test@example.com' } });

  // Wait for Add button to be enabled (use exact name to avoid matching
  // "Add CC Recipients" and "Add BCC Recipients" buttons)
  await waitFor(
    () => {
      expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    },
    { timeout: 5000 },
  );

  // Click Add
  userEvent.click(screen.getByRole('button', { name: 'Add' }));

  // Verify POST was called (not PUT)
  await waitFor(() => {
    const calls = fetchMock.callHistory.calls('create-post');
    expect(calls.length).toBeGreaterThan(0);
  });

  const calls = fetchMock.callHistory.calls('create-post');
  const body = JSON.parse(calls[0].options.body as string);

  expect(body.type).toBe('Report');
  expect(body.name).toBe('My New Report');
  expect(body.chart).toBe(1);
  // Chart content type means dashboard is null (mutually exclusive)
  expect(body.dashboard).toBeNull();
  expect(body.recipients).toBeDefined();
  expect(body.recipients[0].type).toBe('Email');
  expect(body.recipients[0].recipient_config_json.target).toBe(
    'test@example.com',
  );

  // Verify onAdd was called with the response id
  await waitFor(() => {
    expect(onAdd).toHaveBeenCalledWith(100);
  });

  fetchMock.removeRoute('create-post');
}, 45000);

test('create mode defaults to dashboard content type with chart null', async () => {
  // Coverage strategy: the create-mode POST pathway is tested via the chart
  // POST test above. The dashboard content payload (dashboard=value, chart=null)
  // is tested via the edit-mode PUT test below. This test verifies that create
  // mode reports default to Dashboard content type, completing the coverage:
  //   create POST method ← chart POST test
  //   dashboard payload shape ← edit-mode dashboard PUT test
  //   default content type = Dashboard ← THIS test

  const props = generateMockedProps(true); // isReport, create mode
  render(<AlertReportModal {...props} />, { useRedux: true });

  // Open contents panel
  userEvent.click(screen.getByTestId('contents-panel'));
  const contentTypeSelect = await screen.findByRole('combobox', {
    name: /select content type/i,
  });

  // Default content type should be "Dashboard" (not "Chart")
  const selectedItem = contentTypeSelect
    .closest('.ant-select')
    ?.querySelector('.ant-select-selection-item');
  expect(selectedItem).toBeInTheDocument();
  expect(selectedItem?.textContent).toBe('Dashboard');

  // Dashboard selector should be rendered (not chart selector)
  expect(
    screen.getByRole('combobox', { name: /dashboard/i }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('combobox', { name: /chart/i }),
  ).not.toBeInTheDocument();
});

test('dashboard content type submits dashboard id and null chart', async () => {
  // Use a custom alert prop with dashboard content from the start,
  // matching the fetched resource shape (FETCH_DASHBOARD_ENDPOINT).
  const dashboardAlert: AlertObject = {
    ...validAlert,
    id: 1,
    dashboard_id: 1,
    chart_id: 0,
    dashboard: {
      id: 1,
      value: 1,
      label: 'Test Dashboard',
      dashboard_title: 'Test Dashboard',
    } as any,
    chart: undefined as any,
  };

  fetchMock.put(
    'glob:*/api/v1/report/1',
    { id: 1, result: {} },
    { name: 'put-dashboard-payload' },
  );

  const props = generateMockedProps(false, false);
  const editProps = { ...props, alert: dashboardAlert };

  render(<AlertReportModal {...editProps} />, {
    useRedux: true,
  });

  // Wait for resource to load and all validation to pass
  await waitFor(
    () => {
      expect(
        screen.queryAllByRole('img', { name: /check-circle/i }),
      ).toHaveLength(5);
    },
    { timeout: 5000 },
  );

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });
  userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    const calls = fetchMock.callHistory.calls('put-dashboard-payload');
    expect(calls.length).toBeGreaterThan(0);
  });

  const calls = fetchMock.callHistory.calls('put-dashboard-payload');
  const body = JSON.parse(calls[calls.length - 1].options.body as string);

  // Dashboard payload: dashboard field is the numeric ID, chart is null
  expect(body.dashboard).toBe(1);
  expect(body.chart).toBeNull();
  expect(body.name).toBe('Test Alert');
  expect(body.recipients).toBeDefined();

  fetchMock.removeRoute('put-dashboard-payload');
});

// --------------- Existing filter reappear test ------------------

test('filter reappears in dropdown after clearing with X icon', async () => {
  const chartDataEndpoint = 'glob:*/api/v1/chart/data*';

  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(
    tabsEndpoint,
    {
      result: {
        all_tabs: { tab1: 'Tab 1' },
        tab_tree: [{ title: 'Tab 1', value: 'tab1' }],
        native_filters: {
          all: [
            {
              id: 'NATIVE_FILTER-test1',
              name: 'Test Filter 1',
              filterType: 'filter_select',
              targets: [{ column: { name: 'test_column_1' } }],
              adhoc_filters: [],
            },
          ],
          tab1: [
            {
              id: 'NATIVE_FILTER-test2',
              name: 'Test Filter 2',
              filterType: 'filter_select',
              targets: [{ column: { name: 'test_column_2' } }],
              adhoc_filters: [],
            },
          ],
        },
      },
    },
    { name: tabsEndpoint },
  );

  fetchMock.post(
    chartDataEndpoint,
    { result: [{ data: [] }] },
    {
      name: 'clear-icon-chart-data',
    },
  );

  render(<AlertReportModal {...generateMockedProps(true, true)} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);

  // Wait for tabs endpoint to be called so filter options are populated before
  // opening the dropdown — in CI the async chain (fetch report → set dashboard →
  // fetch tabs → set filter options) can lag behind the UI interactions.
  await waitFor(
    () => {
      const tabsCalls = fetchMock.callHistory.calls(tabsEndpoint);
      expect(tabsCalls.length).toBeGreaterThan(0);
    },
    { timeout: 5000 },
  );

  const filterDropdown = screen.getByRole('combobox', {
    name: /select filter/i,
  });
  expect(filterDropdown).toBeInTheDocument();

  // Value selector should be disabled before any filter is selected
  const valueSelect = screen.getByRole('combobox', { name: /select value/i });
  expect(valueSelect.closest('.ant-select')).toHaveClass('ant-select-disabled');

  // Open dropdown and find filter option. Use waitFor to retry mouseDown
  // because Ant Design Select may not open on the first attempt in CI.
  let filterOption: HTMLElement;
  await waitFor(
    () => {
      fireEvent.mouseDown(filterDropdown);
      filterOption = screen.getByText('Test Filter 1');
      expect(filterOption).toBeInTheDocument();
    },
    { timeout: 10000 },
  );

  userEvent.click(filterOption!);

  await waitFor(() => {
    const selectionItem = document.querySelector(
      '.ant-select-selection-item[title="Test Filter 1"]',
    );
    expect(selectionItem).toBeInTheDocument();
  });

  // After selecting a filter, getChartDataRequest resolves and value selector becomes enabled
  await waitFor(() => {
    expect(valueSelect.closest('.ant-select')).not.toHaveClass(
      'ant-select-disabled',
    );
  });

  const selectContainer = filterDropdown.closest('.ant-select');

  const clearIcon = selectContainer?.querySelector(
    '.ant-select-clear [aria-label="close-circle"]',
  );
  expect(clearIcon).toBeInTheDocument();
  userEvent.click(clearIcon as Element);

  await waitFor(() => {
    const selectionItem = document.querySelector(
      '.ant-select-selection-item[title="Test Filter 1"]',
    );
    expect(selectionItem).not.toBeInTheDocument();
  });

  // After clearing, value selector should be disabled again (optionFilterValues reset)
  await waitFor(() => {
    expect(valueSelect.closest('.ant-select')).toHaveClass(
      'ant-select-disabled',
    );
  });

  // Re-open the dropdown — the filter should reappear as an option.
  // Use waitFor to retry the mouseDown + text check because Ant Design
  // may still be processing the clear event internally.
  await waitFor(
    () => {
      fireEvent.mouseDown(filterDropdown);
      expect(screen.getByText('Test Filter 1')).toBeInTheDocument();
    },
    { timeout: 10000 },
  );
}, 45000);

const setupAnchorMocks = (
  nativeFilters: Record<string, unknown>,
  anchor = 'TAB-abc',
  tabsOverride?: {
    all_tabs: Record<string, string>;
    tab_tree: { title: string; value: string }[];
  },
) => {
  const payloadWithAnchor = {
    ...generateMockPayload(true),
    extra: { dashboard: { anchor } },
  };

  const defaultTabs = {
    all_tabs: { [anchor]: `Tab ${anchor}` },
    tab_tree: [{ title: `Tab ${anchor}`, value: anchor }],
  };
  const tabs = tabsOverride ?? defaultTabs;

  // Clear call history so waitFor assertions don't match calls from prior tests.
  fetchMock.callHistory.clear();

  // Only replace the named routes that need anchor-specific overrides;
  // unnamed related-endpoint routes (owners, database, etc.) stay intact.
  fetchMock.removeRoute(FETCH_DASHBOARD_ENDPOINT);
  fetchMock.removeRoute(FETCH_CHART_ENDPOINT);
  fetchMock.removeRoute(tabsEndpoint);

  fetchMock.get(
    FETCH_DASHBOARD_ENDPOINT,
    { result: payloadWithAnchor },
    { name: FETCH_DASHBOARD_ENDPOINT },
  );
  fetchMock.get(
    FETCH_CHART_ENDPOINT,
    { result: generateMockPayload(false) },
    { name: FETCH_CHART_ENDPOINT },
  );
  fetchMock.get(
    tabsEndpoint,
    {
      result: {
        ...tabs,
        native_filters: nativeFilters,
      },
    },
    { name: tabsEndpoint },
  );
};

const restoreAnchorMocks = () => {
  fetchMock.removeRoute(FETCH_DASHBOARD_ENDPOINT);
  fetchMock.get(
    FETCH_DASHBOARD_ENDPOINT,
    { result: generateMockPayload(true) },
    { name: FETCH_DASHBOARD_ENDPOINT },
  );
  fetchMock.removeRoute(FETCH_CHART_ENDPOINT);
  fetchMock.get(
    FETCH_CHART_ENDPOINT,
    { result: generateMockPayload(false) },
    { name: FETCH_CHART_ENDPOINT },
  );
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(
    tabsEndpoint,
    { result: { all_tabs: {}, tab_tree: [] } },
    { name: tabsEndpoint },
  );
};

test('no error toast when anchor tab has no scoped native filters', async () => {
  setupAnchorMocks({
    all: [
      {
        id: 'NATIVE_FILTER-1',
        name: 'Filter 1',
        filterType: 'filter_select',
        targets: [{ column: { name: 'col' } }],
        adhoc_filters: [],
      },
    ],
  });

  const store = createStore({}, reducerIndex);

  try {
    render(<AlertReportModal {...generateMockedProps(true, true)} />, {
      store,
    });

    userEvent.click(screen.getByTestId('contents-panel'));
    await screen.findByText(/test dashboard/i);

    await waitFor(() => {
      expect(
        fetchMock.callHistory
          .calls()
          .some(c => c.url.includes('/dashboard/1/tabs')),
      ).toBe(true);
    });

    const toasts = (store.getState() as Record<string, unknown>)
      .messageToasts as { text: string }[];
    expect(
      toasts.some(
        (toast: { text: string }) =>
          toast.text === 'There was an error retrieving dashboard tabs.',
      ),
    ).toBe(false);
  } finally {
    restoreAnchorMocks();
  }
});

test('no error toast when anchor tab set and dashboard has zero native filters', async () => {
  setupAnchorMocks({});

  const store = createStore({}, reducerIndex);

  try {
    render(<AlertReportModal {...generateMockedProps(true, true)} />, {
      store,
    });

    userEvent.click(screen.getByTestId('contents-panel'));
    await screen.findByText(/test dashboard/i);

    await waitFor(() => {
      expect(
        fetchMock.callHistory
          .calls()
          .some(c => c.url.includes('/dashboard/1/tabs')),
      ).toBe(true);
    });

    const toasts = (store.getState() as Record<string, unknown>)
      .messageToasts as { text: string }[];
    expect(
      toasts.some(
        (toast: { text: string }) =>
          toast.text === 'There was an error retrieving dashboard tabs.',
      ),
    ).toBe(false);
  } finally {
    restoreAnchorMocks();
  }
});

test('stale JSON array anchor is cleared without crash or toast', async () => {
  const staleAnchor = JSON.stringify(['TAB-abc', 'TAB-missing']);
  setupAnchorMocks(
    {
      all: [
        {
          id: 'NATIVE_FILTER-1',
          name: 'Filter 1',
          filterType: 'filter_select',
          targets: [{ column: { name: 'col' } }],
          adhoc_filters: [],
        },
      ],
    },
    staleAnchor,
    {
      all_tabs: { 'TAB-abc': 'Tab ABC' },
      tab_tree: [{ title: 'Tab ABC', value: 'TAB-abc' }],
    },
  );

  const store = createStore({}, reducerIndex);

  try {
    render(<AlertReportModal {...generateMockedProps(true, true)} />, {
      store,
    });

    userEvent.click(screen.getByTestId('contents-panel'));
    await screen.findByText(/test dashboard/i);

    // Wait for the tabs useEffect to process the stale anchor
    await waitFor(() => {
      expect(
        fetchMock.callHistory
          .calls()
          .some(c => c.url.includes('/dashboard/1/tabs')),
      ).toBe(true);
    });

    // Wait for the anchor state to be cleared. The .then() callback calls
    // updateAnchorState(undefined) after finding that not all elements in
    // the JSON array anchor are valid tabs. When the anchor is cleared,
    // the tab selector shows its placeholder text instead of a selected value.
    await waitFor(
      () => {
        expect(screen.getByText(/select a tab/i)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // No error toast dispatched (the .then() handler ran without crashing)
    const toasts = (store.getState() as Record<string, unknown>)
      .messageToasts as { text: string }[];
    expect(
      toasts.some(
        (toast: { text: string }) =>
          toast.text === 'There was an error retrieving dashboard tabs.',
      ),
    ).toBe(false);

    // Verify anchor was cleared at the payload level: trigger save and
    // inspect the PUT body to confirm extra.dashboard.anchor is undefined
    const updateEndpoint = 'glob:*/api/v1/report/1';
    fetchMock.put(
      updateEndpoint,
      { id: 1, result: {} },
      { name: 'put-report-1' },
    );

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).not.toBeDisabled();
    userEvent.click(saveButton);

    await waitFor(() => {
      const putCalls = fetchMock.callHistory
        .calls()
        .filter(
          c => c.url.includes('/api/v1/report/') && c.options?.method === 'put',
        );
      expect(putCalls).toHaveLength(1);
    });

    const putCall = fetchMock.callHistory
      .calls()
      .find(
        c => c.url.includes('/api/v1/report/') && c.options?.method === 'put',
      );
    const body = JSON.parse(putCall!.options?.body as string);
    expect(body.extra.dashboard.anchor).toBeUndefined();
  } finally {
    fetchMock.removeRoute('put-report-1');
    restoreAnchorMocks();
  }
});

test('tabs API failure shows danger toast via Redux store', async () => {
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(tabsEndpoint, 500, { name: tabsEndpoint });

  const store = createStore({}, reducerIndex);

  try {
    render(<AlertReportModal {...generateMockedProps(true, true)} />, {
      store,
    });

    userEvent.click(screen.getByTestId('contents-panel'));

    await waitFor(() => {
      const toasts = (store.getState() as Record<string, unknown>)
        .messageToasts as { text: string }[];
      expect(
        toasts.some(
          (toast: { text: string }) =>
            toast.text === 'There was an error retrieving dashboard tabs.',
        ),
      ).toBe(true);
    });
  } finally {
    fetchMock.removeRoute(tabsEndpoint);
    fetchMock.get(
      tabsEndpoint,
      { result: { all_tabs: {}, tab_tree: [] } },
      { name: tabsEndpoint },
    );
  }
});

test('null all_tabs does not crash or show error toast', async () => {
  setupAnchorMocks({
    all: [
      {
        id: 'NATIVE_FILTER-1',
        name: 'Filter 1',
        filterType: 'filter_select',
        targets: [{ column: { name: 'col' } }],
        adhoc_filters: [],
      },
    ],
  });

  // Override tabs endpoint with null all_tabs
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(
    tabsEndpoint,
    {
      result: {
        all_tabs: null,
        tab_tree: [{ title: 'Tab ABC', value: 'TAB-abc' }],
        native_filters: {
          all: [
            {
              id: 'NATIVE_FILTER-1',
              name: 'Filter 1',
              filterType: 'filter_select',
              targets: [{ column: { name: 'col' } }],
              adhoc_filters: [],
            },
          ],
        },
      },
    },
    { name: tabsEndpoint },
  );

  const store = createStore({}, reducerIndex);

  try {
    render(<AlertReportModal {...generateMockedProps(true, true)} />, {
      store,
    });

    userEvent.click(screen.getByTestId('contents-panel'));
    await screen.findByText(/test dashboard/i);

    // Wait for tabs useEffect to complete
    await waitFor(() => {
      expect(
        fetchMock.callHistory
          .calls()
          .some(c => c.url.includes('/dashboard/1/tabs')),
      ).toBe(true);
    });

    // No error toast dispatched
    const toasts = (store.getState() as Record<string, unknown>)
      .messageToasts as { text: string }[];
    expect(
      toasts.some(
        (toast: { text: string }) =>
          toast.text === 'There was an error retrieving dashboard tabs.',
      ),
    ).toBe(false);

    // Component remains interactive
    expect(
      screen.getByRole('combobox', { name: /select filter/i }),
    ).toBeInTheDocument();
  } finally {
    restoreAnchorMocks();
  }
});

test('missing native_filters in tabs response does not crash or show error toast', async () => {
  setupAnchorMocks({});

  // Override tabs endpoint with no native_filters key
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(
    tabsEndpoint,
    {
      result: {
        all_tabs: { 'TAB-abc': 'Tab ABC' },
        tab_tree: [{ title: 'Tab ABC', value: 'TAB-abc' }],
      },
    },
    { name: tabsEndpoint },
  );

  const store = createStore({}, reducerIndex);

  try {
    render(<AlertReportModal {...generateMockedProps(true, true)} />, {
      store,
    });

    userEvent.click(screen.getByTestId('contents-panel'));
    await screen.findByText(/test dashboard/i);

    // Wait for tabs useEffect to complete
    await waitFor(() => {
      expect(
        fetchMock.callHistory
          .calls()
          .some(c => c.url.includes('/dashboard/1/tabs')),
      ).toBe(true);
    });

    // No error toast dispatched
    const toasts = (store.getState() as Record<string, unknown>)
      .messageToasts as { text: string }[];
    expect(
      toasts.some(
        (toast: { text: string }) =>
          toast.text === 'There was an error retrieving dashboard tabs.',
      ),
    ).toBe(false);
  } finally {
    restoreAnchorMocks();
  }
});

test('anchor tab with scoped filters loads filter options correctly', async () => {
  // Use JSON-parseable non-array anchor to exercise the scoped filter
  // code path at line 1108 (JSON.parse('42') → 42, not an array)
  setupAnchorMocks(
    {
      all: [
        {
          id: 'NATIVE_FILTER-1',
          name: 'Global Filter',
          filterType: 'filter_select',
          targets: [{ column: { name: 'col' } }],
          adhoc_filters: [],
        },
      ],
      '42': [
        {
          id: 'NATIVE_FILTER-2',
          name: 'Tab Scoped Filter',
          filterType: 'filter_select',
          targets: [{ column: { name: 'col2' } }],
          adhoc_filters: [],
        },
      ],
    },
    '42',
  );

  const store = createStore({}, reducerIndex);

  try {
    render(<AlertReportModal {...generateMockedProps(true, true)} />, {
      store,
    });

    userEvent.click(screen.getByTestId('contents-panel'));
    await screen.findByText(/test dashboard/i);

    // Wait for the tabs fetch to complete so filter options are populated
    await waitFor(
      () => {
        expect(
          fetchMock.callHistory
            .calls()
            .some(c => c.url.includes('/dashboard/1/tabs')),
        ).toBe(true);
      },
      { timeout: 5000 },
    );

    const filterDropdown = screen.getByRole('combobox', {
      name: /select filter/i,
    });
    // Use waitFor with mouseDown retry — the dropdown may not open or
    // populate on the first attempt if the .then() callback hasn't
    // finished setting filter options yet.
    await waitFor(
      () => {
        fireEvent.mouseDown(filterDropdown);
        expect(
          screen.getByRole('option', { name: /Tab Scoped Filter/ }),
        ).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    const toasts = (store.getState() as Record<string, unknown>)
      .messageToasts as { text: string }[];
    expect(
      toasts.some(
        (toast: { text: string }) =>
          toast.text === 'There was an error retrieving dashboard tabs.',
      ),
    ).toBe(false);
  } finally {
    restoreAnchorMocks();
  }
});

test('edit mode shows friendly filter names instead of raw IDs', async () => {
  const props = generateMockedProps(true, true);
  const editProps = {
    ...props,
    alert: { ...validAlert, id: 3 },
  };

  render(<AlertReportModal {...editProps} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByTestId('contents-panel'));

  await waitFor(() => {
    const selectionItem = document.querySelector(
      '.ant-select-selection-item[title="Country"]',
    );
    expect(selectionItem).toBeInTheDocument();
  });

  expect(
    document.querySelector(
      '.ant-select-selection-item[title="NATIVE_FILTER-abc123"]',
    ),
  ).not.toBeInTheDocument();
});

test('edit mode falls back to raw ID when filterName is missing', async () => {
  const props = generateMockedProps(true, true);
  const editProps = {
    ...props,
    alert: { ...validAlert, id: 4 },
  };

  render(<AlertReportModal {...editProps} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByTestId('contents-panel'));

  await waitFor(() => {
    const selectionItem = document.querySelector(
      '.ant-select-selection-item[title="NATIVE_FILTER-xyz789"]',
    );
    expect(selectionItem).toBeInTheDocument();
  });
});

test('tabs metadata overwrites seeded filter options', async () => {
  const chartDataEndpoint = 'glob:*/api/v1/chart/data*';

  // Deferred promise to control when the tabs response resolves
  let resolveTabsResponse!: (value: unknown) => void;
  const deferredTabs = new Promise(resolve => {
    resolveTabsResponse = resolve;
  });

  const tabsResult = {
    result: {
      all_tabs: { tab1: 'Tab 1' },
      tab_tree: [{ title: 'Tab 1', value: 'tab1' }],
      native_filters: {
        all: [
          {
            id: 'NATIVE_FILTER-abc123',
            name: 'Country (All Filters)',
            filterType: 'filter_select',
            targets: [{ column: { name: 'country' }, datasetId: 1 }],
            adhoc_filters: [],
          },
        ],
        tab1: [],
      },
    },
  };

  // Replace only the tabs route with a deferred version
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(tabsEndpoint, () => deferredTabs.then(() => tabsResult), {
    name: 'deferred-tabs',
  });
  fetchMock.post(
    chartDataEndpoint,
    { result: [{ data: [] }] },
    {
      name: 'overwrite-chart-data',
    },
  );

  const props = generateMockedProps(true, true);
  const editProps = {
    ...props,
    alert: { ...validAlert, id: 5 },
  };

  render(<AlertReportModal {...editProps} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByTestId('contents-panel'));

  // Seeded label from saved data appears before tabs respond
  const filterSelect = screen.getByRole('combobox', {
    name: /select filter/i,
  });
  const selectContainer = filterSelect.closest('.ant-select') as HTMLElement;
  await waitFor(() => {
    expect(within(selectContainer).getByTitle('Country')).toBeInTheDocument();
  });

  // Resolve the deferred tabs response
  await act(async () => {
    resolveTabsResponse(undefined);
  });

  // Tabs metadata overwrites the seeded label
  await waitFor(() => {
    expect(
      within(selectContainer).getByTitle('Country (All Filters)'),
    ).toBeInTheDocument();
  });
  expect(
    within(selectContainer).queryByTitle('Country'),
  ).not.toBeInTheDocument();
});

test('selecting filter triggers chart data request with correct params', async () => {
  mockGetChartDataRequest.mockReset();
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(tabsEndpoint, tabsWithFilters, { name: tabsEndpoint });

  mockGetChartDataRequest.mockResolvedValue({
    json: { result: [{ data: [{ country: 'US' }, { country: 'UK' }] }] },
  });

  render(<AlertReportModal {...generateMockedProps(true, true)} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);

  // Wait for filter dropdown to be available
  const filterDropdown = await waitFor(() =>
    screen.getByRole('combobox', { name: /select filter/i }),
  );

  // Select the Country Filter using comboboxSelect pattern
  await comboboxSelect(filterDropdown, 'Country Filter', () =>
    document.querySelector(
      '.ant-select-selection-item[title="Country Filter"]',
    ),
  );

  // getChartDataRequest should have been called for filter values
  await waitFor(() => {
    expect(mockGetChartDataRequest).toHaveBeenCalledTimes(1);
  });

  // Verify it was called with correct datasource and groupby
  const callArgs = mockGetChartDataRequest.mock.calls[0][0];
  expect(callArgs.formData.groupby).toEqual(['country']);
  expect(callArgs.formData.datasource).toBe('1__table');

  mockGetChartDataRequest.mockReset();
});

test('selected filter excluded from other row dropdowns', async () => {
  mockGetChartDataRequest.mockReset();
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(tabsEndpoint, tabsWithFilters, { name: tabsEndpoint });

  mockGetChartDataRequest.mockResolvedValue({
    json: { result: [{ data: [{ country: 'US' }] }] },
  });

  render(<AlertReportModal {...generateMockedProps(true, true)} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);

  // Wait for tabs endpoint to complete so filter options are populated
  await waitFor(
    () => {
      expect(fetchMock.callHistory.calls(tabsEndpoint).length).toBeGreaterThan(
        0,
      );
    },
    { timeout: 5000 },
  );

  // Wait for filter dropdown
  const filterDropdown = await waitFor(() =>
    screen.getByRole('combobox', { name: /select filter/i }),
  );

  // Select Country Filter in row 1
  await comboboxSelect(filterDropdown, 'Country Filter', () =>
    document.querySelector(
      '.ant-select-selection-item[title="Country Filter"]',
    ),
  );

  // Wait for getChartDataRequest to complete AND state update to propagate.
  // The value dropdown becomes non-disabled once optionFilterValues is populated.
  await waitFor(() => {
    expect(mockGetChartDataRequest).toHaveBeenCalled();
  });
  await waitFor(
    () => {
      const valueSelects = screen.queryAllByRole('combobox', {
        name: /select value/i,
      });
      expect(valueSelects.length).toBeGreaterThan(0);
    },
    { timeout: 5000 },
  );

  // Add second filter row
  const addFilterButton = screen.getByText(/apply another dashboard filter/i);
  userEvent.click(addFilterButton);

  // Wait for second row
  await waitFor(() => {
    expect(
      screen.getAllByRole('combobox', { name: /select filter/i }),
    ).toHaveLength(2);
  });

  // Open filter dropdown in row 2 — use fireEvent.mouseDown because
  // Ant Design Select opens on mouseDown, not click.
  const filterDropdowns = screen.getAllByRole('combobox', {
    name: /select filter/i,
  });
  fireEvent.mouseDown(filterDropdowns[1]);

  // Country Filter should be excluded (dedup), City Filter should remain.
  // Scope to the last dropdown popup to avoid matching selected items in row 1.
  await waitFor(
    () => {
      const dropdowns = document.querySelectorAll('.ant-select-dropdown');
      const lastDropdown = dropdowns[dropdowns.length - 1];
      expect(
        within(lastDropdown as HTMLElement).queryByText('Country Filter'),
      ).not.toBeInTheDocument();
      expect(
        within(lastDropdown as HTMLElement).getByText('City Filter'),
      ).toBeInTheDocument();
    },
    { timeout: 10000 },
  );
}, 60000);

test('invalid CC email blocks submit', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });

  // Wait for validation to fully propagate (fetch → state → validate → enforce)
  await screen.findByText('Edit alert');
  await waitFor(
    () => {
      expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    },
    { timeout: 5000 },
  );

  // Open notification panel and show CC field
  userEvent.click(screen.getByTestId('notification-method-panel'));
  const addCcButton = await screen.findByText(/Add CC Recipients/i);
  userEvent.click(addCcButton);

  // Type invalid email in CC field
  const ccInput = await screen.findByTestId('cc');
  userEvent.type(ccInput, 'not-an-email');
  fireEvent.blur(ccInput);

  // Save should now be disabled due to invalid email format
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });
});

test('invalid BCC email blocks submit', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });

  // Wait for validation to fully propagate (fetch → state → validate → enforce)
  await screen.findByText('Edit alert');
  await waitFor(
    () => {
      expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    },
    { timeout: 5000 },
  );

  // Open notification panel and show BCC field
  userEvent.click(screen.getByTestId('notification-method-panel'));
  const addBccButton = await screen.findByText(/Add BCC Recipients/i);
  userEvent.click(addBccButton);

  // Type invalid email in BCC field
  const bccInput = await screen.findByTestId('bcc');
  userEvent.type(bccInput, 'not-an-email');
  fireEvent.blur(bccInput);

  // Save should now be disabled due to invalid email format
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });
});

test('invalid saved anchor is reset on dashboard load', async () => {
  fetchMock.removeRoute(tabsEndpoint);
  fetchMock.get(tabsEndpoint, tabsWithFilters, { name: tabsEndpoint });

  const props = generateMockedProps(true, true);
  const editProps = {
    ...props,
    alert: { ...validAlert, id: 7 },
  };

  render(<AlertReportModal {...editProps} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByTestId('contents-panel'));
  await screen.findByText(/test dashboard/i);

  // Wait for dashboard tabs to load
  await waitFor(() => {
    expect(fetchMock.callHistory.calls(tabsEndpoint).length).toBeGreaterThan(0);
  });

  // The saved anchor 'TAB_999' is NOT in the dashboard's tabs (TAB_1, TAB_2),
  // so it should be reset to undefined. Tab selector shows placeholder.
  await waitFor(() => {
    expect(screen.getByText(/select a tab/i)).toBeInTheDocument();
  });

  // TAB_999 should NOT appear as a selected value anywhere
  expect(screen.queryAllByTitle('TAB_999')).toHaveLength(0);
});

test('clearing notification recipients disables submit and prevents API call', async () => {
  fetchMock.put(
    'glob:*/api/v1/report/2',
    { id: 2, result: {} },
    { name: 'put-no-recipients' },
  );

  render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
    useRedux: true,
  });

  // Wait for all validation to pass (5 checkmarks = fully valid alert)
  await waitFor(() => {
    expect(
      screen.queryAllByRole('img', { name: /check-circle/i }),
    ).toHaveLength(5);
  });

  // Save should be enabled initially
  expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();

  // Open notification panel and clear the recipients field
  userEvent.click(screen.getByTestId('notification-method-panel'));
  const recipientInput = await screen.findByTestId('recipients');
  userEvent.clear(recipientInput);
  fireEvent.blur(recipientInput);

  // Save should be disabled — empty recipients block submission
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  // No PUT was emitted — the disabled button prevented any payload from being sent.
  // This confirms that a payload with empty recipients is never transmitted.
  expect(fetchMock.callHistory.calls('put-no-recipients')).toHaveLength(0);

  fetchMock.removeRoute('put-no-recipients');
});

test('modal reopen resets local state', async () => {
  const props = generateMockedProps(true, false, true);

  const { unmount } = render(<AlertReportModal {...props} />, {
    useRedux: true,
  });

  // Type a name to dirty the form
  const nameInput = screen.getByPlaceholderText(/enter report name/i);
  await userEvent.type(nameInput, 'Temporary Report');
  expect(nameInput).toHaveValue('Temporary Report');

  // Click Cancel
  userEvent.click(screen.getByRole('button', { name: /cancel/i }));

  // Unmount and remount to simulate reopening
  unmount();
  render(<AlertReportModal {...props} />, { useRedux: true });

  // Fresh mount should have empty name
  await waitFor(() => {
    expect(screen.getByPlaceholderText(/enter report name/i)).toHaveValue('');
  });
});
