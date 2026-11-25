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
import { useState } from 'react';
import thunk from 'redux-thunk';
import createMockStore from 'redux-mock-store';
import { fireEvent, render, waitFor } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import {
  FileEncryptedExtraFields,
  ImportResourceName,
} from 'src/views/CRUD/types';
import type { ImportModelsModalProps } from './types';
import { ImportModal } from '.';

const mockStore = createMockStore([thunk]);
const store = mockStore({});

const DATABASE_IMPORT_URL = 'glob:*/api/v1/database/import/';
fetchMock.post(
  DATABASE_IMPORT_URL,
  { result: 'OK' },
  { name: 'database-import-default' },
);

const requiredProps = {
  resourceName: 'database' as ImportResourceName,
  resourceLabel: 'database',
  passwordsNeededMessage: 'Passwords are needed',
  confirmOverwriteMessage: 'Database exists',
  addDangerToast: () => {},
  addSuccessToast: () => {},
  onModelImport: () => {},
  show: true,
  onHide: () => {},
};

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.post(
    DATABASE_IMPORT_URL,
    { result: 'OK' },
    { name: 'database-import-default' },
  );
  jest.clearAllMocks();
});

const setup = (overrides: Partial<ImportModelsModalProps> = {}) =>
  render(<ImportModal {...requiredProps} {...overrides} />, { store });

test('renders', () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();
});

test('renders a Modal', () => {
  const { getByTestId } = setup();
  expect(getByTestId('model-modal')).toBeInTheDocument();
});

test('renders "Import database" header', () => {
  const { getByText } = setup();
  expect(getByText('Import database')).toBeInTheDocument();
});

test('renders a file input field', () => {
  setup();
  expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
});

test('should render the close, file, import and cancel buttons', () => {
  setup();
  expect(document.querySelectorAll('button')).toHaveLength(4);
});

test('should render the import button initially disabled', () => {
  const { getByRole } = setup();
  expect(getByRole('button', { name: 'Import' })).toBeDisabled();
});

test('should render the import button enabled when a file is selected', async () => {
  const file = new File([new ArrayBuffer(1)], 'model_export.zip');
  const { getByTestId, getByRole } = setup();
  await waitFor(() =>
    fireEvent.change(getByTestId('model-file-input'), {
      target: {
        files: [file],
      },
    }),
  );
  expect(getByRole('button', { name: 'Import' })).toBeEnabled();
});

test('should POST with request header `Accept: application/json`', async () => {
  const file = new File([new ArrayBuffer(1)], 'model_export.zip');
  const { getByTestId, getByRole } = setup();
  await waitFor(() =>
    fireEvent.change(getByTestId('model-file-input'), {
      target: {
        files: [file],
      },
    }),
  );
  fireEvent.click(getByRole('button', { name: 'Import' }));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(DATABASE_IMPORT_URL)).toHaveLength(1),
  );
  expect(
    fetchMock.callHistory.calls(DATABASE_IMPORT_URL)[0].options?.headers,
  ).toStrictEqual({
    accept: 'application/json',
    'x-csrftoken': '1234',
  });
});

test('should render password fields when needed for import', () => {
  setup({ passwordFields: ['databases/examples.yaml'] });
  expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
});

test('should render ssh_tunnel password fields when needed for import', () => {
  const { getByTestId } = setup({
    sshTunnelPasswordFields: ['databases/examples.yaml'],
  });
  expect(getByTestId('ssh_tunnel_password')).toBeInTheDocument();
});

test('should render ssh_tunnel private_key fields when needed for import', () => {
  const { getByTestId } = setup({
    sshTunnelPrivateKeyFields: ['databases/examples.yaml'],
  });
  expect(getByTestId('ssh_tunnel_private_key')).toBeInTheDocument();
});

test('should render ssh_tunnel private_key_password fields when needed for import', () => {
  const { getByTestId } = setup({
    sshTunnelPrivateKeyPasswordFields: ['databases/examples.yaml'],
  });
  expect(getByTestId('ssh_tunnel_private_key_password')).toBeInTheDocument();
});

test('should render encrypted extra secret fields when needed for import', () => {
  const { getByTestId } = setup({
    encryptedExtraFields: [
      {
        fileName: 'databases/examples.yaml',
        fields: [
          {
            path: '$.credentials_info.private_key',
            label: 'Service Account Private Key',
          },
        ],
      },
    ],
  });
  expect(getByTestId('encrypted_extra_secret')).toBeInTheDocument();
});

test('should keep the newlines of a private key but hide other secrets', () => {
  const { getAllByTestId } = setup({
    encryptedExtraFields: [
      {
        fileName: 'databases/examples.yaml',
        fields: [
          {
            path: '$.embedded_credentials.privatekey_body',
            label: 'Embedded Fallback Private Key',
          },
          {
            path: '$.embedded_credentials.privatekey_pass',
            label: 'Embedded Fallback Private Key Password',
          },
        ],
      },
    ],
  });
  const [key, passphrase] = getAllByTestId('encrypted_extra_secret');
  expect(key.tagName).toBe('TEXTAREA');
  expect(passphrase).toHaveAttribute('type', 'password');
});

test('should render multiple encrypted extra secret fields for multiple files', () => {
  const { getAllByTestId } = setup({
    encryptedExtraFields: [
      {
        fileName: 'databases/bigquery.yaml',
        fields: [
          {
            path: '$.credentials_info.private_key',
            label: 'Service Account Private Key',
          },
        ],
      },
      {
        fileName: 'databases/snowflake.yaml',
        fields: [
          { path: '$.auth_params.privatekey_body', label: 'Private Key Body' },
          {
            path: '$.auth_params.privatekey_pass',
            label: 'Private Key Password',
          },
        ],
      },
    ],
  });
  expect(getAllByTestId('encrypted_extra_secret')).toHaveLength(3);
});

test('shows recovery instructions and permits retry after an import failure', async () => {
  const endpoint = 'glob:*/api/v1/dashboard/import/';
  const recovery =
    'Could not import databases/example.yaml. Check the database credentials, then retry. Reference: test-reference';
  fetchMock.postOnce(endpoint, {
    status: 400,
    body: {
      errors: [
        {
          message: recovery,
          error_type: 'GENERIC_COMMAND_ERROR',
          level: 'error',
          extra: {},
        },
      ],
    },
  });
  const onModelImport = jest.fn();
  const { getByTestId, getByRole, findByText, queryByText } = setup({
    resourceName: 'dashboard',
    resourceLabel: 'dashboard',
    onModelImport,
  });
  fireEvent.change(getByTestId('model-file-input'), {
    target: { files: [new File(['test'], 'dashboard.zip')] },
  });
  await waitFor(() =>
    expect(getByRole('button', { name: 'Import' })).toBeEnabled(),
  );
  fireEvent.click(getByRole('button', { name: 'Import' }));
  expect(
    await findByText(
      `An error occurred while importing dashboard: ${recovery}`,
    ),
  ).toBeInTheDocument();
  expect(queryByText(/Please re-export/)).not.toBeInTheDocument();
  await waitFor(() =>
    expect(getByRole('button', { name: 'Import' })).toBeEnabled(),
  );
  expect(getByTestId('model-file-input')).not.toBeDisabled();
  expect(onModelImport).not.toHaveBeenCalled();

  fetchMock.postOnce(endpoint, { result: 'OK' });
  fireEvent.click(getByRole('button', { name: 'Import' }));
  await waitFor(() => expect(onModelImport).toHaveBeenCalledTimes(1));
  expect(queryByText(/test-reference/)).not.toBeInTheDocument();
});

const adjustmentsPrompt = (weeks = 12, fingerprint = 'fingerprint-12') => {
  const identity = {
    dashboard: 'Sales',
    dashboard_key: 'sales-uuid',
    file: 'dashboards/sales.yaml',
  };
  return {
    errors: [
      {
        message: "The dashboard time ranges don't fit the time range limits.",
        error_type: 'GENERIC_COMMAND_ERROR',
        extra: {
          'dashboards/sales.yaml': {
            time_range_adjustments: [
              {
                ...identity,
                kind: 'time_range_limit',
                name: 'Sales',
                filter_id: null,
                field: 'max_span',
                old: { quantity: 20, time_grain: 'P1W' },
                new: { quantity: weeks, time_grain: 'P1W' },
                old_label: '20 weeks',
                new_label: `${weeks} weeks`,
              },
              {
                ...identity,
                kind: 'filter_default',
                name: 'Date',
                filter_id: 'NATIVE_FILTER-date',
                field: 'default',
                old: null,
                new: 'DATEADD(DATETIME("today"), -14, day) : today',
                old_label: 'No filter',
                new_label: 'Last 14 days',
              },
            ],
          },
          time_range_adjustments_fingerprint: fingerprint,
        },
      },
    ],
  };
};
const ADJUSTMENTS_PROMPT = adjustmentsPrompt();

const selectDashboardFile = async (
  getByTestId: (id: string) => HTMLElement,
  getByRole: (role: string, options: { name: string }) => HTMLElement,
) => {
  fireEvent.change(getByTestId('model-file-input'), {
    target: { files: [new File(['bundle'], 'dashboard.zip')] },
  });
  await waitFor(() =>
    expect(getByRole('button', { name: 'Import' })).toBeEnabled(),
  );
};

test('asks before adjusting time ranges and imports with the adjustments on confirm', async () => {
  const endpoint = 'glob:*/api/v1/dashboard/import/';
  fetchMock.postOnce(endpoint, { status: 422, body: ADJUSTMENTS_PROMPT });
  const onModelImport = jest.fn();
  const { getByTestId, getByRole, findByRole, getByText, queryByText } = setup({
    resourceName: 'dashboard',
    resourceLabel: 'dashboard',
    onModelImport,
  });
  await selectDashboardFile(getByTestId, getByRole);

  fireEvent.click(getByRole('button', { name: 'Import' }));

  const confirm = await findByRole('button', { name: 'Adjust and import' });
  expect(
    getByText('Dashboard "Sales" (dashboards/sales.yaml)'),
  ).toBeInTheDocument();
  expect(
    getByText('Time range limit "Maximum span": "20 weeks" → "12 weeks"'),
  ).toBeInTheDocument();
  expect(
    getByText('Time range filter "Date": default "No filter" → "Last 14 days"'),
  ).toBeInTheDocument();
  expect(queryByText(/An error occurred/)).not.toBeInTheDocument();
  expect(queryByText(/changed since you reviewed/)).not.toBeInTheDocument();
  expect(onModelImport).not.toHaveBeenCalled();
  const first = fetchMock.callHistory.lastCall(endpoint)?.options
    .body as FormData;
  expect(first.get('adjust_time_ranges')).toBeNull();

  fetchMock.postOnce(endpoint, { result: 'OK' });
  fireEvent.click(confirm);

  await waitFor(() => expect(onModelImport).toHaveBeenCalledTimes(1));
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(2);
  const second = fetchMock.callHistory.lastCall(endpoint)?.options
    .body as FormData;
  expect(second.get('adjust_time_ranges')).toBe('true');
  expect(second.get('time_range_adjustments_fingerprint')).toBe(
    'fingerprint-12',
  );
});

test('shows the new list when the changes differ from the reviewed ones', async () => {
  const endpoint = 'glob:*/api/v1/dashboard/import/';
  fetchMock.postOnce(endpoint, { status: 422, body: ADJUSTMENTS_PROMPT });
  const onModelImport = jest.fn();
  const { getByTestId, getByRole, findByRole, findByText, queryByText } = setup(
    {
      resourceName: 'dashboard',
      resourceLabel: 'dashboard',
      onModelImport,
    },
  );
  await selectDashboardFile(getByTestId, getByRole);
  fireEvent.click(getByRole('button', { name: 'Import' }));
  fetchMock.postOnce(endpoint, {
    status: 422,
    body: adjustmentsPrompt(10, 'fingerprint-10'),
  });

  fireEvent.click(await findByRole('button', { name: 'Adjust and import' }));

  expect(
    await findByText(
      'Time range limit "Maximum span": "20 weeks" → "10 weeks"',
    ),
  ).toBeInTheDocument();
  expect(
    queryByText('Time range limit "Maximum span": "20 weeks" → "12 weeks"'),
  ).not.toBeInTheDocument();
  expect(
    queryByText(
      'The changes needed changed since you reviewed them. Review the new list.',
    ),
  ).toBeInTheDocument();
  expect(onModelImport).not.toHaveBeenCalled();
  fetchMock.postOnce(endpoint, { result: 'OK' });

  fireEvent.click(getByRole('button', { name: 'Adjust and import' }));

  await waitFor(() => expect(onModelImport).toHaveBeenCalledTimes(1));
  const fingerprints = fetchMock.callHistory
    .calls(endpoint)
    .map(call =>
      (call.options.body as FormData).get('time_range_adjustments_fingerprint'),
    );
  expect(fingerprints).toEqual([null, 'fingerprint-12', 'fingerprint-10']);
});

test('imports nothing when the time range adjustments are cancelled', async () => {
  const endpoint = 'glob:*/api/v1/dashboard/import/';
  fetchMock.postOnce(endpoint, { status: 422, body: ADJUSTMENTS_PROMPT });
  const onModelImport = jest.fn();
  const onHide = jest.fn();
  const { getByTestId, getByRole, findByRole } = setup({
    resourceName: 'dashboard',
    resourceLabel: 'dashboard',
    onModelImport,
    onHide,
  });
  await selectDashboardFile(getByTestId, getByRole);
  fireEvent.click(getByRole('button', { name: 'Import' }));
  await findByRole('button', { name: 'Adjust and import' });

  fireEvent.click(getByRole('button', { name: 'Cancel' }));

  expect(onHide).toHaveBeenCalledTimes(1);
  expect(onModelImport).not.toHaveBeenCalled();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('asks for the overwrite first and keeps it when asking for the adjustments', async () => {
  const endpoint = 'glob:*/api/v1/dashboard/import/';
  fetchMock.postOnce(endpoint, {
    status: 422,
    body: {
      errors: [
        {
          message: 'Error importing dashboard',
          error_type: 'GENERIC_COMMAND_ERROR',
          extra: {
            'dashboards/sales.yaml':
              'Dashboard already exists and `overwrite=true` was not passed',
          },
        },
      ],
    },
  });
  const onModelImport = jest.fn();
  const { getByTestId, getByRole, findByRole, findByTestId } = setup({
    resourceName: 'dashboard',
    resourceLabel: 'dashboard',
    onModelImport,
  });
  await selectDashboardFile(getByTestId, getByRole);
  fireEvent.click(getByRole('button', { name: 'Import' }));
  fireEvent.change(await findByTestId('overwrite-modal-input'), {
    target: { value: 'OVERWRITE' },
  });
  fetchMock.postOnce(endpoint, { status: 422, body: ADJUSTMENTS_PROMPT });
  fireEvent.click(getByRole('button', { name: 'Overwrite' }));
  const confirm = await findByRole('button', { name: 'Adjust and import' });
  fetchMock.postOnce(endpoint, { result: 'OK' });

  fireEvent.click(confirm);

  await waitFor(() => expect(onModelImport).toHaveBeenCalledTimes(1));
  const bodies = fetchMock.callHistory
    .calls(endpoint)
    .map(call => call.options.body as FormData);
  expect(bodies.map(body => body.get('overwrite'))).toEqual([
    null,
    'true',
    'true',
  ]);
  expect(bodies.map(body => body.get('adjust_time_ranges'))).toEqual([
    null,
    null,
    'true',
  ]);
});

test('lets the import continue when the reviewed changes are no longer needed', async () => {
  const endpoint = 'glob:*/api/v1/dashboard/import/';
  fetchMock.postOnce(endpoint, { status: 422, body: ADJUSTMENTS_PROMPT });
  const onModelImport = jest.fn();
  const { getByTestId, getByRole, findByRole, findByText, queryByText } = setup(
    {
      resourceName: 'dashboard',
      resourceLabel: 'dashboard',
      onModelImport,
    },
  );
  await selectDashboardFile(getByTestId, getByRole);
  fireEvent.click(getByRole('button', { name: 'Import' }));
  fetchMock.postOnce(endpoint, {
    status: 422,
    body: {
      errors: [
        {
          message: 'The time range changes you agreed to are no longer needed.',
          error_type: 'GENERIC_COMMAND_ERROR',
          extra: { time_range_adjustments_fingerprint: 'fingerprint-empty' },
        },
      ],
    },
  });

  fireEvent.click(await findByRole('button', { name: 'Adjust and import' }));

  expect(
    await findByText(
      'The changes needed changed since you reviewed them. No changes are needed any more.',
    ),
  ).toBeInTheDocument();
  expect(queryByText(/An error occurred/)).not.toBeInTheDocument();
  expect(queryByText(/Time range limit/)).not.toBeInTheDocument();
  fetchMock.postOnce(endpoint, { result: 'OK' });

  fireEvent.click(getByRole('button', { name: 'Import' }));

  await waitFor(() => expect(onModelImport).toHaveBeenCalledTimes(1));
  const last = fetchMock.callHistory.lastCall(endpoint)?.options
    .body as FormData;
  expect(last.get('adjust_time_ranges')).toBe('true');
  expect(last.get('time_range_adjustments_fingerprint')).toBe(
    'fingerprint-empty',
  );
});

function StatefulImportModal() {
  const [passwordFields, setPasswordFields] = useState<string[]>([]);
  const [sshTunnelPasswordFields, setSSHTunnelPasswordFields] = useState<
    string[]
  >([]);
  const [sshTunnelPrivateKeyFields, setSSHTunnelPrivateKeyFields] = useState<
    string[]
  >([]);
  const [
    sshTunnelPrivateKeyPasswordFields,
    setSSHTunnelPrivateKeyPasswordFields,
  ] = useState<string[]>([]);
  const [encryptedExtraFields, setEncryptedExtraFields] = useState<
    FileEncryptedExtraFields[]
  >([]);
  return (
    <ImportModal
      {...requiredProps}
      resourceName="dashboard"
      resourceLabel="dashboard"
      {...{
        passwordFields,
        setPasswordFields,
        sshTunnelPasswordFields,
        setSSHTunnelPasswordFields,
        sshTunnelPrivateKeyFields,
        setSSHTunnelPrivateKeyFields,
        sshTunnelPrivateKeyPasswordFields,
        setSSHTunnelPrivateKeyPasswordFields,
        encryptedExtraFields,
        setEncryptedExtraFields,
      }}
    />
  );
}

test.each(['replace', 'remove'])(
  'clears credentials and overwrite state when the file changes: %s',
  async action => {
    const endpoint = 'glob:*/api/v1/dashboard/import/';
    const prompt = {
      errors: [
        {
          message: 'Validation failed',
          error_type: 'GENERIC_COMMAND_ERROR',
          extra: {
            'databases/examples.yaml': {
              _schema: [
                'Must provide a password for the database',
                'Must provide a password for the ssh tunnel',
                'Must provide a private key for the ssh tunnel',
                'Must provide a private key password for the ssh tunnel',
                'Must provide value for masked_encrypted_extra field: $.token (Token)',
              ],
            },
            'dashboards/example.yaml':
              'Dashboard already exists and `overwrite=true` was not passed',
          },
        },
      ],
    };
    fetchMock.postOnce(endpoint, { status: 400, body: prompt });
    const { getByTestId, getByRole, findByTestId, findByText, queryByText } =
      render(<StatefulImportModal />, { store });
    const selectFile = (name: string) =>
      fireEvent.change(getByTestId('model-file-input'), {
        target: { files: [new File(['bundle'], name)] },
      });
    selectFile('first.zip');
    await waitFor(() =>
      expect(getByRole('button', { name: 'Import' })).toBeEnabled(),
    );
    fireEvent.click(getByRole('button', { name: 'Import' }));
    await findByTestId('ssh_tunnel_password');
    const password = document.querySelector(
      'input[name="password-databases/examples.yaml"]',
    )!;
    fireEvent.change(password, { target: { value: 'old-password' } });
    for (const id of [
      'ssh_tunnel_password',
      'ssh_tunnel_private_key',
      'ssh_tunnel_private_key_password',
      'encrypted_extra_secret',
    ]) {
      fireEvent.change(getByTestId(id), { target: { value: 'old-secret' } });
    }
    fireEvent.change(getByTestId('overwrite-modal-input'), {
      target: { value: 'OVERWRITE' },
    });
    fetchMock.postOnce(endpoint, {
      status: 400,
      body: {
        errors: [
          { message: 'Connection failed. Check credentials.', extra: {} },
        ],
      },
    });
    fireEvent.click(getByRole('button', { name: 'Overwrite' }));
    await findByText(/Connection failed. Check credentials./);
    expect(
      queryByText(/Database driver for importing/),
    ).not.toBeInTheDocument();
    if (action === 'remove') {
      fireEvent.click(getByRole('button', { name: /remove file/i }));
      await waitFor(() =>
        expect(getByRole('button', { name: 'Import' })).toBeDisabled(),
      );
    }
    selectFile('second.zip');
    await waitFor(() =>
      expect(getByRole('button', { name: 'Import' })).toBeEnabled(),
    );
    expect(queryByText(/Connection failed/)).not.toBeInTheDocument();
    expect(
      document.querySelector('input[name="password-databases/examples.yaml"]'),
    ).not.toBeInTheDocument();
    fetchMock.postOnce(endpoint, { result: 'OK' });
    fireEvent.click(getByRole('button', { name: 'Import' }));
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(3),
    );
    const body = fetchMock.callHistory.lastCall(endpoint)?.options
      .body as FormData;
    for (const key of [
      'passwords',
      'ssh_tunnel_passwords',
      'ssh_tunnel_private_keys',
      'ssh_tunnel_private_key_passwords',
      'encrypted_extra_secrets',
    ]) {
      expect(JSON.parse((body.get(key) as string) || '{}')).toEqual({});
    }
    expect(body.get('overwrite')).not.toBe('true');
    expect(body.get('overwrite_all')).not.toBe('true');
  },
);

test.each(['database', 'dataset', 'saved_query'] as ImportResourceName[])(
  'keeps recovery guidance for %s imports',
  async resourceName => {
    const endpoint = `glob:*/api/v1/${resourceName}/import/`;
    fetchMock.removeRoute('database-import-default');
    fetchMock.postOnce(endpoint, {
      status: 500,
      body: {
        errors: [{ message: 'Import failed for an unknown reason', extra: {} }],
      },
    });
    const { getByTestId, getByRole, findByText } = setup({ resourceName });
    fireEvent.change(getByTestId('model-file-input'), {
      target: { files: [new File(['bundle'], 'bundle.zip')] },
    });
    await waitFor(() =>
      expect(getByRole('button', { name: 'Import' })).toBeEnabled(),
    );
    fireEvent.click(getByRole('button', { name: 'Import' }));
    await findByText(
      /Check the import file and destination connection settings/,
    );
  },
);
