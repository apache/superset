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
          targets: [{ column: { name: 'country' } }],
          adhoc_filters: [],
        },
        {
          id: 'NATIVE_FILTER-F2',
          name: 'City Filter',
          filterType: 'filter_select',
          targets: [{ column: { name: 'city' } }],
          adhoc_filters: [],
        },
      ],
      TAB_1: [
        {
          id: 'NATIVE_FILTER-F1',
          name: 'Country Filter',
          filterType: 'filter_select',
          targets: [{ column: { name: 'country' } }],
          adhoc_filters: [],
        },
      ],
      TAB_2: [
        {
          id: 'NATIVE_FILTER-F2',
          name: 'City Filter',
          filterType: 'filter_select',
          targets: [{ column: { name: 'city' } }],
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

test('dashboard switching resets tab and filter selections', async () => {
  // Return dashboard options so user can switch
  fetchMock.removeRoute(dashboardEndpoint);
  fetchMock.get(dashboardEndpoint, {
    result: [
      { text: 'Test Dashboard', value: 1 },
      { text: 'Other Dashboard', value: 99 },
    ],
    count: 2,
  });

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

  // Wait for tabs to load from dashboard 1
  await waitFor(() => {
    expect(screen.getAllByText(/select tab/i)).toHaveLength(1);
  });

  // Verify filters are available
  await waitFor(() => {
    expect(
      screen.getByRole('combobox', { name: /select filter/i }),
    ).toBeInTheDocument();
  });

  // Switch to "Other Dashboard"
  const dashboardSelect = screen.getByRole('combobox', {
    name: /dashboard/i,
  });
  userEvent.clear(dashboardSelect);
  userEvent.type(dashboardSelect, 'Other Dashboard{enter}');

  // After switching, tab selector should be disabled (reset to empty)
  await waitFor(() => {
    const disabledSelects = document.querySelectorAll('.ant-select-disabled');
    expect(disabledSelects.length).toBeGreaterThan(0);
  });

  // Restore dashboard endpoint
  fetchMock.removeRoute(dashboardEndpoint);
  fetchMock.get(dashboardEndpoint, { result: [] });
  fetchMock.removeRoute(tabs99);
});

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
  await waitFor(() => {
    expect(
      screen.queryAllByRole('img', { name: /check-circle/i }),
    ).toHaveLength(5);
  });

  // Open condition panel and select "not null"
  userEvent.click(screen.getByTestId('alert-condition-panel'));
  await screen.findByText(/smaller than/i);
  const condition = screen.getByRole('combobox', { name: /condition/i });
  await comboboxSelect(condition, 'not null', () =>
    screen.getAllByText(/not null/i)[0],
  );

  expect(screen.getByRole('spinbutton')).toBeDisabled();

  // Wait for Save to be enabled and click
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: /save/i }),
    ).toBeEnabled();
  });
  await waitFor(() =>
    userEvent.click(screen.getByRole('button', { name: /save/i })),
  );

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
});

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
    expect(
      screen.getByRole('button', { name: /save/i }),
    ).toBeEnabled();
  });
  await waitFor(() =>
    userEvent.click(screen.getByRole('button', { name: /save/i })),
  );

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
  expect(body.recipients[0].type).toBe('Email');

  fetchMock.removeRoute('put-edit');
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
