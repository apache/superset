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
import { render, screen } from 'spec/helpers/testing-library';
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
        database: { type: 'string', description: 'Database name' },
        username: { type: 'string', description: 'Username' },
        password: { type: 'string', description: 'Password' },
      },
      required: ['host', 'port', 'database'],
    },
  }) as unknown as DatabaseForm;

const renderForm = (engine: string) => {
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

test('uses the SQL Server default port as the MSSQL port placeholder', () => {
  renderForm('mssql');

  expect(screen.getByPlaceholderText('e.g. 1433')).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('e.g. 5432')).not.toBeInTheDocument();
  expect(screen.getByText('Database name')).toBeInTheDocument();
});

test('MSSQL form shows no SSL toggle when the schema omits encryption', () => {
  renderForm('mssql');

  expect(screen.queryByText('SSL')).not.toBeInTheDocument();
});

test('other engines keep the common port placeholder', () => {
  renderForm('postgresql');

  expect(screen.getByPlaceholderText('e.g. 5432')).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('e.g. 1433')).not.toBeInTheDocument();
});
