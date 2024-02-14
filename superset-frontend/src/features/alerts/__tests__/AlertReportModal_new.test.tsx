import React from 'react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  waitFor,
  within,
} from '../../../../spec/helpers/testing-library';

import '@testing-library/jest-dom/extend-expect'; // for additional matchers
import { buildErrorTooltipMessage } from '../buildErrorTooltipMessage';
import AlertReportModal, { AlertReportModalProps } from '../AlertReportModal';
import { AlertObject } from '../types';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: () => true,
}));

const generateMockPayload = (dashboard = true) => {
  const mockPayload = {
    active: false,
    context_markdown: 'string',
    creation_method: 'alerts_reports',
    crontab: '0 * * * *',
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
  crontab: '0 * * * *',
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
      type: 'Email',
      recipient_config_json: { target: 'test@user.com' },
    },
  ],
  timezone: 'America/Rainy_River',
  type: 'Alert',
};

jest.mock('../buildErrorTooltipMessage', () => ({
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
describe('properly renders the modal', () => {
  it('properly renders add alert text', () => {
    const addAlertProps = generateMockedProps();
    render(<AlertReportModal {...addAlertProps} />, { useRedux: true });
    const addAlertHeading = screen.getByRole('heading', { name: /add alert/i });
    expect(addAlertHeading).toBeInTheDocument();
    const addButton = screen.getByRole('button', { name: /add/i });
    expect(addButton).toBeInTheDocument();
  });

  it('properly renders edit alert text', async () => {
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

  it('properly renders add report text', () => {
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

  it('properly renders edit report text', async () => {
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

  it('renders 4 sections for reports', () => {
    render(<AlertReportModal {...generateMockedProps(true)} />, {
      useRedux: true,
    });
    const sections = screen.getAllByRole('tab', { expanded: false });
    expect(sections.length).toBe(4);
  });

  it('renders 5 sections for alerts', () => {
    render(<AlertReportModal {...generateMockedProps(false)} />, {
      useRedux: true,
    });

    const sections = screen.getAllByRole('tab', { expanded: false });
    expect(sections.length).toBe(5);
  });
});

// Validation
describe('Validation', () => {
  it('renders 5 checkmarks for a valid alert', async () => {
    render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
      useRedux: true,
    });
    const checkmarks = await screen.findAllByRole('img', {
      name: /check-circle/i,
    });
    expect(checkmarks.length).toEqual(5);
  });

  it('renders single checkmarks when creating a new alert', async () => {
    render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
      useRedux: true,
    });
    const checkmarks = await screen.findAllByRole('img', {
      name: /check-circle/i,
    });
    expect(checkmarks.length).toEqual(1);
  });

  it('disables save when validation fails', () => {
    render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
      useRedux: true,
    });

    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled();
  });

  it('calls build tooltip', async () => {
    render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
      useRedux: true,
    });
    expect(buildErrorTooltipMessage).toHaveBeenCalled();
    expect(buildErrorTooltipMessage).toHaveBeenLastCalledWith(
      true,
      expect.anything(),
      {
        alertConditionSection: {
          errors: ['database', 'sql', 'alert condition'],
          name: 'Alert condition',
          status: false,
        },
        contentSection: {
          errors: ['content type'],
          name: 'Report contents',
          status: false,
        },
        generalSection: {
          errors: ['name'],
          name: 'General information',
          status: false,
        },
        notificationSection: {
          errors: ['recipients'],
          name: 'Notification methods',
          status: false,
        },
        scheduleSection: { errors: [], name: 'Schedule', status: true },
      },
    );
  });
});

// General Section
describe('General Section', () => {
  it('opens on click', async () => {
    render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('general-information-panel'));
    const general_header = within(
      screen.getByRole('tab', { expanded: true }),
    ).queryByText(/general information/i);
    expect(general_header).toBeInTheDocument();
  });

  it('renders all fields', () => {
    render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('general-information-panel'));
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
});

// Alert Condition Section
describe('Alert Condition Section', () => {
  it('opens on click', async () => {
    render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('alert-condition-panel'));
    const alertConditionHeader = within(
      screen.getByRole('tab', { expanded: true }),
    ).queryByText(/alert condition/i);
    expect(alertConditionHeader).toBeInTheDocument();
  });
  it('renders all fields', async () => {
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
  it('disables threshold if not null condition is selected', async () => {
    render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('alert-condition-panel'));
    await waitFor(() => {
      expect(screen.getByText(/smaller than/i)).toBeInTheDocument();
    });
    const condition = screen.getByRole('combobox', { name: /condition/i });
    await comboboxSelect(
      condition,
      'not null',
      () => screen.getAllByText(/not null/i)[0],
    );
    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });
});

// Content Section
describe('contents section', () => {
  it('opens on click', async () => {
    render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('contents-panel'));
    const contentsHeader = within(
      screen.getByRole('tab', { expanded: true }),
    ).queryByText(/contents/i);
    expect(contentsHeader).toBeInTheDocument();
  });

  it('renders screenshot options when dashboard is selected', async () => {
    render(<AlertReportModal {...generateMockedProps(false, true, true)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('contents-panel'));
    await waitFor(() => {
      expect(screen.getByText(/test dashboard/i)).toBeInTheDocument();
    });
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

  it('changes to chart options when chart is selected', async () => {
    render(<AlertReportModal {...generateMockedProps(false, true, true)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('contents-panel'));
    await waitFor(() => {
      expect(screen.getByText(/test dashboard/i)).toBeInTheDocument();
    });
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

  it('removes ignore cache checkbox when chart is selected', async () => {
    render(<AlertReportModal {...generateMockedProps(false, true, true)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('contents-panel'));
    await waitFor(() => {
      expect(screen.getByText(/test dashboard/i)).toBeInTheDocument();
    });
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

  it('does not show screenshot width when csv is selected', async () => {
    render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('contents-panel'));
    await waitFor(() => {
      expect(screen.getByText(/test chart/i)).toBeInTheDocument();
    });
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
});

// Schedule Section
describe('schedule section', () => {
  it('opens on click', async () => {
    render(<AlertReportModal {...generateMockedProps(false, true, false)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('schedule-panel'));
    const scheduleHeader = within(
      screen.getByRole('tab', { expanded: true }),
    ).queryAllByText(/schedule/i)[0];
    expect(scheduleHeader).toBeInTheDocument();
  });
  it('renders default fields', async () => {
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
    const gracePeriod = screen.getByRole('textbox');
    expect(scheduleType).toBeInTheDocument();
    expect(timezone).toBeInTheDocument();
    expect(logRetention).toBeInTheDocument();
    expect(gracePeriod).toBeInTheDocument();
  });
  it('renders working timout as report', async () => {
    render(<AlertReportModal {...generateMockedProps(true, false, false)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('schedule-panel'));
    expect(screen.getByText(/working timeout/i)).toBeInTheDocument();
  });
  it('renders grace period as alert', async () => {
    render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('schedule-panel'));
    expect(screen.getByText(/grace period/i)).toBeInTheDocument();
  });
  it('shows CRON Expression when CRON is selected', async () => {
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
  it('defaults to hour when CRON is not selected', async () => {
    render(<AlertReportModal {...generateMockedProps(true, false, false)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('schedule-panel'));
    expect(screen.getByTitle(/hour/i)).toBeInTheDocument();
  });
});

// Notification Method Section
describe('notification method', () => {
  it('opens on click', async () => {
    render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('notification-method-panel'));
    const notificationMethodHeader = within(
      screen.getByRole('tab', { expanded: true }),
    ).queryAllByText(/notification method/i)[0];
    expect(notificationMethodHeader).toBeInTheDocument();
  });

  it('renders all fields', async () => {
    render(<AlertReportModal {...generateMockedProps(false, false, false)} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByTestId('notification-method-panel'));
    const notificationMethod = screen.getByRole('combobox', {
      name: /delivery method/i,
    });
    const recipients = screen.getByRole('textbox');
    const addNotificationMethod = screen.getByText(
      /add another notification method/i,
    );
    expect(notificationMethod).toBeInTheDocument();
    expect(recipients).toBeInTheDocument();
    expect(addNotificationMethod).toBeInTheDocument();
  });
  it('adds another notification method section after clicking add notification method', async () => {
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
      'Email',
      () => screen.getAllByRole('textbox')[1],
    );
    expect(screen.getAllByRole('textbox').length).toBe(2);
  });

  it('removes notification method on clicking trash can', async () => {
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
});
