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
} from 'spec/helpers/testing-library';
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

fetchMock.get(FETCH_DASHBOARD_ENDPOINT, { result: generateMockPayload(true) });
fetchMock.get(FETCH_CHART_ENDPOINT, { result: generateMockPayload(false) });
fetchMock.get(FETCH_REPORT_WITH_FILTERS_ENDPOINT, {
  result: {
    ...generateMockPayload(true),
    id: 3,
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

// Related mocks
const ownersEndpoint = 'glob:*/api/v1/alert/related/owners?*';
const databaseEndpoint = 'glob:*/api/v1/alert/related/database?*';
const dashboardEndpoint = 'glob:*/api/v1/alert/related/dashboard?*';
const chartEndpoint = 'glob:*/api/v1/alert/related/chart?*';
const tabsEndpoint = 'glob:*/api/v1/dashboard/1/tabs';

fetchMock.get(ownersEndpoint, { result: [] });
fetchMock.get(databaseEndpoint, { result: [] });
fetchMock.get(dashboardEndpoint, { result: [] });
fetchMock.get(chartEndpoint, { result: [{ text: 'table chart', value: 1 }] });
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
    { name: 'clear-icon-tabs' },
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

  const filterDropdown = screen.getByRole('combobox', {
    name: /select filter/i,
  });
  expect(filterDropdown).toBeInTheDocument();

  userEvent.click(filterDropdown);

  const filterOption = await waitFor(() => {
    const virtualList = document.querySelector('.rc-virtual-list');
    return within(virtualList as HTMLElement).getByText('Test Filter 1');
  });

  userEvent.click(filterOption);

  await waitFor(() => {
    const selectionItem = document.querySelector(
      '.ant-select-selection-item[title="Test Filter 1"]',
    );
    expect(selectionItem).toBeInTheDocument();
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

  userEvent.click(filterDropdown);
  await waitFor(() => {
    const virtualList = document.querySelector('.rc-virtual-list');
    expect(
      within(virtualList as HTMLElement).getByText('Test Filter 1'),
    ).toBeInTheDocument();
  });
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
