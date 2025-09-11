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
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
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
      slice_name: 'Test Chart',
      viz_type: 'table',
    },
  };
};

// mocking resource endpoints
const FETCH_DASHBOARD_ENDPOINT = 'glob:*/api/v1/report/1';
const FETCH_CHART_ENDPOINT = 'glob:*/api/v1/report/2';

fetchMock.get(FETCH_DASHBOARD_ENDPOINT, { result: generateMockPayload(true) });
fetchMock.get(FETCH_CHART_ENDPOINT, { result: generateMockPayload(false) });

// Related mocks
const ownersEndpoint = 'glob:*/api/v1/alert/related/owners?*';
const databaseEndpoint = 'glob:*/api/v1/alert/related/database?*';
const dashboardEndpoint = 'glob:*/api/v1/alert/related/dashboard?*';
const chartEndpoint = 'glob:*/api/v1/alert/related/chart?*';

fetchMock.get(ownersEndpoint, { result: [] });
fetchMock.get(databaseEndpoint, { result: [] });
fetchMock.get(dashboardEndpoint, { result: [] });
fetchMock.get(chartEndpoint, { result: [{ text: 'table chart', value: 1 }] });

// Create a valid alert with all required fields entered for validation check

// @ts-ignore will add id in factory function
const validAlert: AlertObject = {
  active: false,
  changed_on_delta_humanized: 'now',
  created_on: '2023-12-12T22:33:25.927764',
  creation_method: 'alerts_reports',
  crontab: '0 0 * * *',
  dashboard_id: 0,
  chart_id: 0,
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
  await waitFor(() => {
    const element = newElementQuery();
    expect(element).toBeInTheDocument();
  });
};

// --------------- TEST SECTION ------------------
test('properly renders add alert text', () => {
  const addAlertProps = generateMockedProps();
  render(<AlertReportModal {...addAlertProps} />, { useRedux: true });
  const addAlertHeading = screen.getByRole('heading', { name: /add alert/i });
  expect(addAlertHeading).toBeInTheDocument();
  const addButton = screen.getByRole('button', { name: /add/i });
  expect(addButton).toBeInTheDocument();
});

test('properly renders edit alert text', async () => {
  render(<AlertReportModal {...generateMockedProps(false, true)} />, {
    useRedux: true,
  });
  const editAlertHeading = screen.getByRole('heading', {
    name: /edit alert/i,
  });
  expect(editAlertHeading).toBeInTheDocument();
  const saveButton = screen.getByRole('button', { name: /save/i });
  expect(saveButton).toBeInTheDocument();
});

test('properly renders add report text', () => {
  render(<AlertReportModal {...generateMockedProps(true)} />, {
    useRedux: true,
  });
  const addReportHeading = screen.getByRole('heading', {
    name: /add report/i,
  });
  expect(addReportHeading).toBeInTheDocument();
  const addButton = screen.getByRole('button', { name: /add/i });
  expect(addButton).toBeInTheDocument();
});

test('properly renders edit report text', async () => {
  render(<AlertReportModal {...generateMockedProps(true, true)} />, {
    useRedux: true,
  });

  const editReportHeading = screen.getByRole('heading', {
    name: /edit report/i,
  });
  expect(editReportHeading).toBeInTheDocument();
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
  const sql = screen.getAllByRole('textbox')[2];
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
  ).toBe(null);
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
  const timezone = screen.getByRole('combobox', {
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
  await comboboxSelect(
    screen.getByRole('combobox', { name: /schedule type/i }),
    'cron schedule',
    () => screen.getByPlaceholderText(/cron expression/i),
  );
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
