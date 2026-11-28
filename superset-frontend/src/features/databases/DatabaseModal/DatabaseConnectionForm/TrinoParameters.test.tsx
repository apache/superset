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
import {
  render,
  screen,
  userEvent,
  within,
} from 'spec/helpers/testing-library';
import {
  ConfigurationMethod,
  DatabaseConnectionFormProps,
  DatabaseForm,
  DatabaseObject,
} from 'src/features/databases/types';
import DatabaseConnectionForm from './index';

const basicParametersModel = (engine: string, databaseDescription: string) =>
  ({
    engine,
    name: engine,
    preferred: false,
    sqlalchemy_uri_placeholder: '',
    available_drivers: [],
    default_driver: '',
    engine_information: {
      supports_file_upload: false,
      disable_ssh_tunneling: false,
    },
    parameters: {
      properties: {
        host: { type: 'string', description: 'Hostname or IP address' },
        port: { type: 'integer', description: 'Database port' },
        database: { type: 'string', description: databaseDescription },
        username: { type: 'string', description: 'Username' },
        password: { type: 'string', description: 'Password' },
        encryption: {
          type: 'boolean',
          description: 'Use an encrypted connection',
        },
      },
      required: ['host', 'port', 'database'],
    },
  }) as unknown as DatabaseForm;

const renderForm = (engine: string, databaseDescription: string) => {
  const db: Partial<DatabaseObject> = {
    engine,
    configuration_method: ConfigurationMethod.DynamicForm,
    parameters: {},
  };
  const noop = jest.fn();
  const props: DatabaseConnectionFormProps = {
    dbModel: basicParametersModel(engine, databaseDescription),
    db,
    sslForced: false,
    isValidating: false,
    onParametersChange: noop,
    onChange: noop,
    onQueryChange: noop,
    onExtraInputChange: noop,
    onEncryptedExtraInputChange: noop,
    onClearEncryptedExtraKey: noop,
    onAddTableCatalog: noop,
    onRemoveTableCatalog: noop,
    validationErrors: null,
    getValidation: noop,
    clearValidationErrors: noop,
  };
  return render(<DatabaseConnectionForm {...props} />);
};

test('labels the Trino database field as the catalog', () => {
  renderForm('trino', 'Catalog name');

  expect(screen.getByText('Catalog name')).toBeInTheDocument();
  expect(screen.queryByText('Database name')).not.toBeInTheDocument();
  expect(
    screen.getByText(/The Trino catalog to connect to/),
  ).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText('e.g. hive or hive/sales'),
  ).toBeInTheDocument();
});

test('uses Trino port placeholder and HTTPS SSL tooltip', async () => {
  renderForm('trino', 'Catalog name');

  expect(
    screen.getByPlaceholderText('e.g. 8080 (443 for HTTPS)'),
  ).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('e.g. 5432')).not.toBeInTheDocument();

  const sslToggle = screen.getByText('SSL').parentElement as HTMLElement;
  await userEvent.hover(
    within(sslToggle).getByRole('img', { name: 'info-circle' }),
  );
  expect(
    await screen.findByText(
      'HTTPS will be used to connect to the Trino coordinator.',
    ),
  ).toBeInTheDocument();
});

test('other engines keep the common field text', () => {
  renderForm('postgresql', 'Database name');

  expect(screen.getByText('Database name')).toBeInTheDocument();
  expect(screen.queryByText('Catalog name')).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText('e.g. 5432')).toBeInTheDocument();
});

test('shows the root certificate field only when SSL is on', async () => {
  const { unmount } = renderForm('trino', 'Catalog name');
  expect(screen.queryByText('Root certificate')).not.toBeInTheDocument();
  unmount();

  const onChange = jest.fn();
  const props = {
    dbModel: basicParametersModel('trino', 'Catalog name'),
    db: {
      engine: 'trino',
      configuration_method: ConfigurationMethod.DynamicForm,
      parameters: { encryption: true },
    },
    sslForced: false,
    isValidating: false,
    onParametersChange: jest.fn(),
    onChange,
    onQueryChange: jest.fn(),
    onExtraInputChange: jest.fn(),
    onEncryptedExtraInputChange: jest.fn(),
    onClearEncryptedExtraKey: jest.fn(),
    onAddTableCatalog: jest.fn(),
    onRemoveTableCatalog: jest.fn(),
    validationErrors: { encryption: 'Certificate could not be verified' },
    getValidation: jest.fn(),
    clearValidationErrors: jest.fn(),
  } as unknown as DatabaseConnectionFormProps;
  render(<DatabaseConnectionForm {...props} />);

  expect(screen.getByText('Root certificate')).toBeInTheDocument();
  expect(
    screen.getByText('Certificate could not be verified'),
  ).toBeInTheDocument();

  // A PEM bundle is multi-line, so the field must be a textarea.
  const certField = screen.getByPlaceholderText(
    'Optional: CA certificate (PEM)',
  );
  expect(certField.tagName).toBe('TEXTAREA');
  await userEvent.click(certField);
  await userEvent.paste('-----BEGIN CERTIFICATE-----\nabc');
  expect(onChange).toHaveBeenLastCalledWith({
    target: {
      name: 'server_cert',
      value: '-----BEGIN CERTIFICATE-----\nabc',
    },
  });
});

test('explains how to set a schema in the catalog field', () => {
  renderForm('trino', 'Catalog name');
  expect(screen.getByText(/catalog\/schema/)).toBeInTheDocument();
});
