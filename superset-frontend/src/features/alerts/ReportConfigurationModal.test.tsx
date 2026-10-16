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
  within,
} from 'spec/helpers/testing-library';
import ReportConfigurationModal, {
  normalizeDomain,
} from './ReportConfigurationModal';

const CONFIGURATION_ENDPOINT = 'glob:*/api/v1/report/configuration/';

const configuration = {
  alerts_attach_reports: true,
  date_format_in_email_subject: false,
  alert_minimum_interval: 600,
  report_minimum_interval: 0,
  limit_recipients_to_users: false,
  allowed_email_domains: ['example.com'],
};

const renderModal = (props: Partial<Record<string, unknown>> = {}) => {
  const onHide = jest.fn();
  const addSuccessToast = jest.fn();
  const addDangerToast = jest.fn();
  render(
    <ReportConfigurationModal
      show
      onHide={onHide}
      addSuccessToast={addSuccessToast}
      addDangerToast={addDangerToast}
      {...props}
    />,
  );
  return { onHide, addSuccessToast, addDangerToast };
};

beforeEach(() => {
  fetchMock.removeRoutes().clearHistory();
  fetchMock.get(CONFIGURATION_ENDPOINT, { result: configuration });
});

afterEach(() => {
  fetchMock.removeRoutes().clearHistory();
});

test('normalizes e-mail domains', () => {
  expect(normalizeDomain(' @Example.COM ')).toBe('example.com');
});

test('loads the configuration in effect into the form', async () => {
  renderModal();

  expect(
    await screen.findByText('Alerts & Reports configuration'),
  ).toBeInTheDocument();
  await waitFor(() => {
    expect(
      screen.getByRole('spinbutton', { name: 'Alert minimum interval' }),
    ).toHaveValue('10');
  });
  expect(
    screen.getByRole('spinbutton', { name: 'Report minimum interval' }),
  ).toHaveValue('0');
  expect(
    screen.getByRole('switch', { name: 'Enable attachments for alerts' }),
  ).toBeChecked();
  expect(
    screen.getByRole('switch', { name: 'Limit recipients to users' }),
  ).not.toBeChecked();
  expect(
    screen.getByRole('switch', { name: 'Format dates in email subjects' }),
  ).not.toBeChecked();
  expect(
    screen.getByRole('textbox', { name: 'Allowed e-mail domains' }),
  ).toHaveValue('example.com');
});

test('saves email subject date formatting without changing other settings', async () => {
  fetchMock.put(
    CONFIGURATION_ENDPOINT,
    { result: { ...configuration, date_format_in_email_subject: true } },
    { name: 'save-date-format' },
  );
  renderModal();

  const dateFormat = await screen.findByRole('switch', {
    name: 'Format dates in email subjects',
  });
  await userEvent.click(dateFormat);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() =>
    expect(fetchMock.callHistory.calls('save-date-format')).toHaveLength(1),
  );
  const [call] = fetchMock.callHistory.calls('save-date-format');
  expect(JSON.parse(call.options.body as string)).toEqual({
    date_format_in_email_subject: true,
  });
});

test('saves the configuration with intervals converted to seconds', async () => {
  fetchMock.put(
    CONFIGURATION_ENDPOINT,
    { result: { ...configuration, limit_recipients_to_users: true } },
    { name: 'put-configuration' },
  );
  const { onHide, addSuccessToast } = renderModal();

  await waitFor(() => {
    expect(
      screen.getByRole('spinbutton', { name: 'Alert minimum interval' }),
    ).toHaveValue('10');
  });

  await userEvent.click(
    screen.getByRole('switch', { name: 'Limit recipients to users' }),
  );
  const reportInterval = screen.getByRole('spinbutton', {
    name: 'Report minimum interval',
  });
  await userEvent.clear(reportInterval);
  await userEvent.type(reportInterval, '15');

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(fetchMock.callHistory.calls('put-configuration')).toHaveLength(1);
  });
  const [call] = fetchMock.callHistory.calls('put-configuration');
  expect(JSON.parse(call.options.body as string)).toEqual({
    report_minimum_interval: 900,
    limit_recipients_to_users: true,
  });
  await waitFor(() => expect(onHide).toHaveBeenCalled());
  expect(addSuccessToast).toHaveBeenCalledWith(
    'Alerts & Reports configuration updated',
  );
});

test('disables configuration fields while saving', async () => {
  let finishSave: (response: unknown) => void = () => {};
  fetchMock.put(
    CONFIGURATION_ENDPOINT,
    () =>
      new Promise(resolve => {
        finishSave = resolve;
      }),
    { name: 'pending-save' },
  );
  const { onHide } = renderModal();

  await waitFor(() =>
    expect(
      screen.getByRole('spinbutton', { name: 'Alert minimum interval' }),
    ).toHaveValue('10'),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('pending-save')).toHaveLength(1),
  );

  expect(
    screen.getByRole('switch', { name: 'Enable attachments for alerts' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('switch', { name: 'Limit recipients to users' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('switch', { name: 'Format dates in email subjects' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('spinbutton', { name: 'Alert minimum interval' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('spinbutton', { name: 'Report minimum interval' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('textbox', { name: 'Allowed e-mail domains' }),
  ).toBeDisabled();

  finishSave({ result: configuration });
  await waitFor(() => expect(onHide).toHaveBeenCalled());
});

test('lists the impacted schedules when the configuration conflicts', async () => {
  fetchMock.put(
    CONFIGURATION_ENDPOINT,
    {
      status: 422,
      body: {
        message:
          'Some existing alerts/reports conflict with the new configuration.',
        impacted_schedules: [
          {
            id: 7,
            name: 'External digest',
            type: 'Report',
            reason: 'recipient',
            detail: 'someone@other.org',
          },
          {
            id: 9,
            name: 'Every minute',
            type: 'Alert',
            reason: 'frequency',
            detail: '* * * * *',
          },
        ],
      },
    },
    { name: 'put-configuration-conflict' },
  );
  const { onHide, addDangerToast } = renderModal();

  await waitFor(() => {
    expect(
      screen.getByRole('spinbutton', { name: 'Alert minimum interval' }),
    ).toHaveValue('10');
  });
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  const impacted = await screen.findByTestId('impacted-schedules');
  const items = within(impacted).getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent('External digest');
  expect(items[0]).toHaveTextContent('someone@other.org');
  expect(items[1]).toHaveTextContent('Every minute');
  expect(onHide).not.toHaveBeenCalled();
  // Conflicts are shown inline, not as a toast.
  expect(addDangerToast).not.toHaveBeenCalled();
});

test('saving another setting preserves fractional intervals and inherited defaults', async () => {
  fetchMock.removeRoutes().clearHistory();
  fetchMock.get(CONFIGURATION_ENDPOINT, {
    result: { ...configuration, alert_minimum_interval: 150 },
  });
  fetchMock.put(
    CONFIGURATION_ENDPOINT,
    { result: configuration },
    { name: 'save-partial' },
  );
  renderModal();
  await waitFor(() =>
    expect(
      screen.getByRole('spinbutton', { name: 'Alert minimum interval' }),
    ).toHaveValue('3'),
  );
  await userEvent.click(
    screen.getByRole('switch', { name: 'Limit recipients to users' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('save-partial')).toHaveLength(1),
  );
  const [call] = fetchMock.callHistory.calls('save-partial');
  expect(JSON.parse(call.options.body as string)).toEqual({
    limit_recipients_to_users: true,
  });
});

test('clearing an interval sends explicit null', async () => {
  fetchMock.put(
    CONFIGURATION_ENDPOINT,
    { result: { ...configuration, alert_minimum_interval: null } },
    { name: 'clear-interval' },
  );
  renderModal();
  const interval = await screen.findByRole('spinbutton', {
    name: 'Alert minimum interval',
  });
  await waitFor(() => expect(interval).toHaveValue('10'));
  await userEvent.clear(interval);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('clear-interval')).toHaveLength(1),
  );
  const [call] = fetchMock.callHistory.calls('clear-interval');
  expect(JSON.parse(call.options.body as string)).toEqual({
    alert_minimum_interval: null,
  });
});

test('paginates configuration conflicts without losing later entries', async () => {
  fetchMock.put(CONFIGURATION_ENDPOINT, {
    status: 422,
    body: {
      impacted_schedules: Array.from({ length: 11 }, (_, index) => ({
        id: index,
        name: `Conflict ${index}`,
        type: 'Report',
        reason: 'recipient',
        detail: 'blocked@example.com',
      })),
    },
  });
  renderModal();
  await waitFor(() =>
    expect(
      screen.getByRole('spinbutton', { name: 'Alert minimum interval' }),
    ).toHaveValue('10'),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  const list = await screen.findByTestId('impacted-schedules');
  expect(within(list).getAllByRole('listitem')).toHaveLength(10);
  expect(screen.queryByText('Conflict 10')).not.toBeInTheDocument();
  await userEvent.click(screen.getByTitle('Next Page'));
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByText('Conflict 10')).toBeInTheDocument();
});

test('accepts comma-separated domains and saves normalized unique values', async () => {
  fetchMock.put(
    CONFIGURATION_ENDPOINT,
    { result: configuration },
    { name: 'save-domains' },
  );
  renderModal();
  const input = await screen.findByRole('textbox', {
    name: 'Allowed e-mail domains',
  });
  await waitFor(() => expect(input).toHaveValue('example.com'));
  await userEvent.clear(input);
  await userEvent.type(
    input,
    ' Example.COM, *.Partner.org, superset.*, example.com, ',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('save-domains')).toHaveLength(1),
  );
  const [call] = fetchMock.callHistory.calls('save-domains');
  expect(JSON.parse(call.options.body as string)).toEqual({
    allowed_email_domains: ['example.com', '*.partner.org', 'superset.*'],
  });
});

test('invalid comma-separated domains block saving and clearing removes the restriction', async () => {
  fetchMock.put(
    CONFIGURATION_ENDPOINT,
    { result: configuration },
    { name: 'clear-domains' },
  );
  renderModal();
  const input = await screen.findByRole('textbox', {
    name: 'Allowed e-mail domains',
  });
  await waitFor(() => expect(input).toHaveValue('example.com'));
  await userEvent.type(input, ', not a domain');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  await userEvent.clear(input);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('clear-domains')).toHaveLength(1),
  );
  const [call] = fetchMock.callHistory.calls('clear-domains');
  expect(JSON.parse(call.options.body as string)).toEqual({
    allowed_email_domains: [],
  });
});

test('interval edits save whole minutes and support keyboard steps', async () => {
  fetchMock.put(
    CONFIGURATION_ENDPOINT,
    { result: configuration },
    { name: 'save-integer' },
  );
  renderModal();
  const input = await screen.findByRole('spinbutton', {
    name: 'Alert minimum interval',
  });
  await waitFor(() => expect(input).toHaveValue('10'));
  await userEvent.clear(input);
  await userEvent.type(input, '2.5');
  await userEvent.tab();
  expect(input).toHaveValue('3');
  await userEvent.click(input);
  await userEvent.type(input, '{arrowup}');
  expect(input).toHaveValue('4');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls('save-integer')).toHaveLength(1),
  );
  const [call] = fetchMock.callHistory.calls('save-integer');
  expect(JSON.parse(call.options.body as string)).toEqual({
    alert_minimum_interval: 240,
  });
});
