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
  render,
  screen,
  userEvent,
  waitFor,
  createStore,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { FeatureFlag, VizType, isFeatureEnabled } from '@superset-ui/core';
import getBootstrapData from 'src/utils/getBootstrapData';
import { DEFAULT_COMMON_BOOTSTRAP_DATA } from 'src/constants';
import type { BootstrapData } from 'src/types/bootstrapTypes';
import ReportModal from '.';

const bootstrapData = (
  common: Partial<BootstrapData['common']> = {},
): BootstrapData => ({
  common: {
    ...DEFAULT_COMMON_BOOTSTRAP_DATA,
    ...common,
  },
});

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    common: {
      conf: {},
      feature_flags: {},
      user_subject_id: 99,
      user_subjects: [99],
    },
  })),
}));

const mockedGetBootstrapData = getBootstrapData as jest.MockedFunction<
  typeof getBootstrapData
>;

const REPORT_ENDPOINT = 'glob:*/api/v1/report*';
fetchMock.get(REPORT_ENDPOINT, {});

const NOOP = () => {};

const defaultProps = {
  addDangerToast: NOOP,
  addSuccessToast: NOOP,
  addReport: NOOP,
  onHide: NOOP,
  onReportAdd: NOOP,
  show: true,
  userEmail: 'test@test.com',
  dashboardId: 1,
  creationMethod: 'dashboards',
  chart: {
    sliceFormData: {
      viz_type: VizType.Table,
    },
  },
};

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

beforeEach(() => {
  mockedGetBootstrapData.mockReturnValue(
    bootstrapData({
      user_subject_id: 99,
      user_subjects: [99],
    }),
  );
  mockedIsFeatureEnabled.mockImplementation(
    featureFlag => featureFlag === FeatureFlag.AlertReports,
  );
});

test('inputs respond correctly', () => {
  render(<ReportModal {...defaultProps} />, { useRedux: true });
  // ----- Report name textbox
  const reportNameTextbox = screen.getByTestId('report-name-test');
  expect(reportNameTextbox).toHaveDisplayValue('Weekly Report');
  userEvent.clear(reportNameTextbox);
  userEvent.type(reportNameTextbox, 'Report name text test');
  expect(reportNameTextbox).toHaveDisplayValue('Report name text test');

  // ----- Report description textbox
  const reportDescriptionTextbox = screen.getByTestId(
    'report-description-test',
  );
  expect(reportDescriptionTextbox).toHaveDisplayValue('');
  userEvent.type(reportDescriptionTextbox, 'Report description text test');
  expect(reportDescriptionTextbox).toHaveDisplayValue(
    'Report description text test',
  );

  // ----- Crontab
  const crontabInputs = screen.getAllByRole('combobox');
  expect(crontabInputs).toHaveLength(5);
});

test('does not allow user to create a report without a name', () => {
  render(<ReportModal {...defaultProps} />, { useRedux: true });
  const reportNameTextbox = screen.getByTestId('report-name-test');
  const addButton = screen.getByRole('button', { name: /add/i });

  expect(reportNameTextbox).toHaveDisplayValue('Weekly Report');
  expect(addButton).toBeEnabled();

  userEvent.clear(reportNameTextbox);

  expect(reportNameTextbox).toHaveDisplayValue('');
  expect(addButton).toBeDisabled();
});

test('creates a new email report via modal Add button', async () => {
  // The modal calls POST /api/v1/report/subscribe; creation_method, editors, and
  // recipients are derived server-side — the client payload intentionally omits them.
  fetchMock.post(
    'glob:*/api/v1/report/subscribe',
    { id: 1, result: {} },
    { name: 'post-subscribe' },
  );

  render(<ReportModal {...defaultProps} />, { useRedux: true });

  const addButton = screen.getByRole('button', { name: /add/i });
  await waitFor(() => userEvent.click(addButton));

  // Verify exactly one POST to the subscribe endpoint
  await waitFor(() => {
    const postCalls = fetchMock.callHistory.calls('post-subscribe');
    expect(postCalls).toHaveLength(1);
  });

  const postCalls = fetchMock.callHistory.calls('post-subscribe');
  const body = JSON.parse(postCalls[0].options.body as string);
  expect(body.name).toBe('Weekly Report');
  expect(body.type).toBe('Report');
  expect(body.crontab).toBeDefined();
  // creation_method, editors, and recipients are set server-side; not in the client payload
  expect(body.creation_method).toBeUndefined();
  expect(body.recipients).toBeUndefined();

  fetchMock.removeRoute('post-subscribe');
});

test('text-based chart hides screenshot width and shows message content', () => {
  // Table is text-based: should show message content but hide custom width
  const textChartProps = {
    ...defaultProps,
    dashboardId: undefined,
    chart: { id: 1, sliceFormData: { viz_type: VizType.Table } },
    chartName: 'My Table Chart',
    creationMethod: 'charts' as const,
  };
  render(<ReportModal {...textChartProps} />, { useRedux: true });

  // Message content section should be visible
  expect(screen.getByText('Message content')).toBeInTheDocument();
  expect(screen.getByText(/Text embedded in email/i)).toBeInTheDocument();

  // Screenshot width should NOT be visible for text-based chart
  expect(screen.queryByText('Screenshot width')).not.toBeInTheDocument();
});

test('non-text chart shows screenshot width and message content', () => {
  const lineChartProps = {
    ...defaultProps,
    dashboardId: undefined,
    chart: { id: 1, sliceFormData: { viz_type: VizType.Line } },
    chartName: 'My Line Chart',
    creationMethod: 'charts' as const,
  };
  render(<ReportModal {...lineChartProps} />, { useRedux: true });

  // Both message content and screenshot width should be visible
  expect(screen.getByText('Message content')).toBeInTheDocument();
  expect(screen.getByText('Screenshot width')).toBeInTheDocument();
});

test('screenshot width input preserves a typed zero instead of dropping it', () => {
  const lineChartProps = {
    ...defaultProps,
    dashboardId: undefined,
    chart: { id: 1, sliceFormData: { viz_type: VizType.Line } },
    chartName: 'My Line Chart',
    creationMethod: 'charts' as const,
  };
  render(<ReportModal {...lineChartProps} />, { useRedux: true });

  const widthInput = screen.getByPlaceholderText(
    'Input custom width in pixels',
  );

  // The old `|| null` / `|| ''` logic silently coerced a typed 0 to null, so the
  // invalid width was swallowed instead of being submitted and surfaced by the
  // server's min-width validation. The field must preserve the literal value.
  userEvent.type(widthInput, '0');
  expect(widthInput).toHaveDisplayValue('0');

  // Clearing the field still yields an empty value (parsed NaN → null).
  userEvent.clear(widthInput);
  expect(widthInput).toHaveDisplayValue('');
});

test('dashboard report hides message content section', () => {
  const dashboardProps = {
    ...defaultProps,
    chart: undefined,
    dashboardName: 'My Dashboard',
  };
  render(<ReportModal {...dashboardProps} />, { useRedux: true });

  // Message content (radio group) should NOT be visible for dashboard
  expect(screen.queryByText('Message content')).not.toBeInTheDocument();
  // Screenshot width SHOULD be visible
  expect(screen.getByText('Screenshot width')).toBeInTheDocument();
});

test('renders edit mode when report exists in store', () => {
  const existingReport = {
    id: 42,
    name: 'Existing Dashboard Report',
    description: 'An existing report',
    crontab: '0 9 * * 1',
    creation_method: 'dashboards',
    report_format: 'PNG',
    timezone: 'America/New_York',
    active: true,
    type: 'Report',
    dashboard: 1,
    editors: [1],
    recipients: [
      {
        recipient_config_json: { target: 'test@test.com' },
        type: 'Email',
      },
    ],
  };
  const store = createStore(
    {
      reports: {
        dashboards: { 1: existingReport },
      },
    },
    reducerIndex,
  );

  render(<ReportModal {...defaultProps} />, { useRedux: true, store });

  // Edit mode title
  expect(screen.getByText('Edit email report')).toBeInTheDocument();
  // Report name populated from store
  expect(screen.getByTestId('report-name-test')).toHaveDisplayValue(
    'Existing Dashboard Report',
  );
  // Save button instead of Add
  expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
});

test('edit mode dispatches editReport via PUT on save', async () => {
  const existingReport = {
    id: 42,
    name: 'Existing Report',
    description: '',
    crontab: '0 12 * * 1',
    creation_method: 'dashboards',
    report_format: 'PNG',
    timezone: 'America/New_York',
    active: true,
    type: 'Report',
    dashboard: 1,
    editors: [1],
    recipients: [
      {
        recipient_config_json: { target: 'test@test.com' },
        type: 'Email',
      },
    ],
  };
  const store = createStore(
    {
      reports: {
        dashboards: { 1: existingReport },
      },
    },
    reducerIndex,
  );

  fetchMock.put(
    'glob:*/api/v1/report/42',
    { id: 42, result: {} },
    {
      name: 'put-report-42',
    },
  );

  render(<ReportModal {...defaultProps} />, { useRedux: true, store });

  expect(screen.getByText('Edit email report')).toBeInTheDocument();
  const saveButton = screen.getByRole('button', { name: /save/i });
  await waitFor(() => userEvent.click(saveButton));

  await waitFor(() => {
    const calls = fetchMock.callHistory.calls('put-report-42');
    expect(calls.length).toBeGreaterThan(0);
  });

  const calls = fetchMock.callHistory.calls('put-report-42');
  const body = JSON.parse(calls[calls.length - 1].options.body as string);

  // Pin critical payload fields to catch regressions
  expect(body.type).toBe('Report');
  expect(body.name).toBe('Existing Report');
  expect(body.crontab).toBe('0 12 * * 1');
  expect(body.report_format).toBe('PNG');
  expect(body.dashboard).toBe(1);
  expect(body.editors).toEqual([99]);
  expect(body.recipients).toBeDefined();
  expect(body.recipients[0].type).toBe('Email');

  fetchMock.removeRoute('put-report-42');
});

test('edit mode does not fall back to user id when subject id is unavailable', async () => {
  mockedGetBootstrapData.mockReturnValue(
    bootstrapData({
      user_subject_id: undefined,
      user_subjects: [],
    }),
  );

  const existingReport = {
    id: 43,
    name: 'Existing Report',
    description: '',
    crontab: '0 12 * * 1',
    creation_method: 'dashboards',
    report_format: 'PNG',
    timezone: 'America/New_York',
    active: true,
    type: 'Report',
    dashboard: 1,
    editors: [99],
    recipients: [
      {
        recipient_config_json: { target: 'test@test.com' },
        type: 'Email',
      },
    ],
  };
  const store = createStore(
    {
      reports: {
        dashboards: { 1: existingReport },
      },
    },
    reducerIndex,
  );

  fetchMock.put(
    'glob:*/api/v1/report/43',
    { id: 43, result: {} },
    {
      name: 'put-report-43',
    },
  );

  render(<ReportModal {...defaultProps} />, {
    useRedux: true,
    store,
  });

  const saveButton = screen.getByRole('button', { name: /save/i });
  await waitFor(() => userEvent.click(saveButton));

  await waitFor(() => {
    const calls = fetchMock.callHistory.calls('put-report-43');
    expect(calls.length).toBeGreaterThan(0);
  });

  const calls = fetchMock.callHistory.calls('put-report-43');
  const body = JSON.parse(calls[calls.length - 1].options.body as string);

  expect(body.editors).toBeUndefined();

  fetchMock.removeRoute('put-report-43');
});

test('submit failure dispatches danger toast and keeps modal open', async () => {
  fetchMock.post(REPORT_ENDPOINT, 500, { name: 'post-fail' });
  const onHide = jest.fn();

  const store = createStore({}, reducerIndex);
  render(<ReportModal {...defaultProps} onHide={onHide} />, {
    useRedux: true,
    store,
  });

  const addButton = screen.getByRole('button', { name: /add/i });
  await waitFor(() => userEvent.click(addButton));

  // The addReport action catches 500 errors, dispatches a danger toast, and re-throws
  await waitFor(() => {
    const toasts = (store.getState() as any).messageToasts;
    expect(toasts.length).toBeGreaterThan(0);
    expect(
      toasts.some((t: { text: string }) =>
        t.text.includes('Failed to create report'),
      ),
    ).toBe(true);
  });

  // Modal stays open — onHide should NOT have been called
  expect(onHide).not.toHaveBeenCalled();
  expect(screen.getByText('Schedule a new email report')).toBeInTheDocument();

  fetchMock.removeRoute('post-fail');
});
