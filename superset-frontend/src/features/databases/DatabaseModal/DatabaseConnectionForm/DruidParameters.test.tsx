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

const basicParametersModel = (engine: string) =>
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
        username: { type: 'string', description: 'Username' },
        password: { type: 'string', description: 'Password' },
        encryption: {
          type: 'boolean',
          description: 'Use an encrypted connection',
        },
      },
      required: ['host', 'port'],
    },
  }) as unknown as DatabaseForm;

const renderForm = (
  engine: string,
  onParametersChange: jest.Mock = jest.fn(),
) => {
  const db: Partial<DatabaseObject> = {
    engine,
    configuration_method: ConfigurationMethod.DynamicForm,
    parameters: {},
  };
  const noop = jest.fn();
  const props: DatabaseConnectionFormProps = {
    dbModel: basicParametersModel(engine),
    db,
    sslForced: false,
    isValidating: false,
    onParametersChange,
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

test('uses the Druid broker port placeholder', () => {
  renderForm('druid');

  expect(
    screen.getByPlaceholderText('e.g. 8082 (8888 for the router)'),
  ).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('e.g. 5432')).not.toBeInTheDocument();
});

test('explains that the Druid SSL toggle switches to HTTPS', async () => {
  renderForm('druid');

  const sslToggle = screen.getByText('SSL').parentElement as HTMLElement;
  await userEvent.hover(
    within(sslToggle).getByRole('img', { name: 'info-circle' }),
  );
  expect(
    await screen.findByText(
      'HTTPS will be used to connect to the Druid SQL endpoint.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByText('SSL Mode "require" will be used.'),
  ).not.toBeInTheDocument();
});

test('the Druid SSL toggle still sends the encryption parameter', async () => {
  const onParametersChange = jest.fn();
  renderForm('druid', onParametersChange);

  await userEvent.click(screen.getByRole('switch'));

  expect(onParametersChange).toHaveBeenCalledWith({
    target: {
      type: 'toggle',
      name: 'encryption',
      checked: true,
      value: true,
    },
  });
});

test('other engines keep the common field text', () => {
  renderForm('postgresql');

  expect(screen.getByPlaceholderText('e.g. 5432')).toBeInTheDocument();
  expect(
    screen.queryByPlaceholderText('e.g. 8082 (8888 for the router)'),
  ).not.toBeInTheDocument();
});
