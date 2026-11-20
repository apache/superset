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
import configureStore from 'redux-mock-store';
import { fireEvent, render, waitFor } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import {
  FileEncryptedExtraFields,
  ImportResourceName,
} from 'src/views/CRUD/types';
import type { ImportModelsModalProps } from './types';
import { ImportModal } from '.';

const mockStore = configureStore([thunk]);
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
