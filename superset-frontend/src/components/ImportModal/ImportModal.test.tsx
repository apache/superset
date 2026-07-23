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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import { fireEvent, render, waitFor } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { ImportResourceName } from 'src/views/CRUD/types';
import type { ImportModelsModalProps } from './types';
import { ImportModal } from '.';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const DATABASE_IMPORT_URL = 'glob:*/api/v1/database/import/';
fetchMock.post(DATABASE_IMPORT_URL, { result: 'OK' });

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
  fetchMock.clearHistory();
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
