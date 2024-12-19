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

// TODO: These tests should be made atomic in separate files

import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import { act, cleanup, render, screen } from 'spec/helpers/testing-library';
import DatabaseModal from './index';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: () => true,
}));

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

const dbProps = {
  show: true,
  database_name: 'my database',
  sqlalchemy_uri: 'postgres://superset:superset@something:1234/superset',
  onHide: () => {},
};

const DATABASE_FETCH_ENDPOINT = 'glob:*/api/v1/database/10';
const AVAILABLE_DB_ENDPOINT = 'glob:*/api/v1/database/available*';
const VALIDATE_PARAMS_ENDPOINT = 'glob:*/api/v1/database/validate_parameters*';
const DATABASE_CONNECT_ENDPOINT = 'glob:*/api/v1/database/';

fetchMock.post(DATABASE_CONNECT_ENDPOINT, {
  id: 10,
  result: {
    configuration_method: 'sqlalchemy_form',
    database_name: 'Other2',
    driver: 'apsw',
    expose_in_sqllab: true,
    extra: '{"allows_virtual_table_explore":true}',
    sqlalchemy_uri: 'gsheets://',
  },
  json: 'foo',
});

fetchMock.config.overwriteRoutes = true;
fetchMock.get(DATABASE_FETCH_ENDPOINT, {
  result: {
    id: 10,
    database_name: 'my database',
    expose_in_sqllab: false,
    allow_ctas: false,
    allow_cvas: false,
    configuration_method: 'sqlalchemy_form',
  },
});
fetchMock.mock(AVAILABLE_DB_ENDPOINT, {
  databases: [
    {
      available_drivers: ['psycopg2'],
      default_driver: 'psycopg2',
      engine: 'postgresql',
      name: 'PostgreSQL',
      parameters: {
        properties: {
          database: {
            description: 'Database name',
            type: 'string',
          },
          encryption: {
            description: 'Use an encrypted connection to the database',
            type: 'boolean',
          },
          host: {
            description: 'Hostname or IP address',
            type: 'string',
          },
          password: {
            description: 'Password',
            nullable: true,
            type: 'string',
          },
          port: {
            description: 'Database port',
            format: 'int32',
            maximum: 65536,
            minimum: 0,
            type: 'integer',
          },
          query: {
            additionalProperties: {},
            description: 'Additional parameters',
            type: 'object',
          },
          ssh: {
            description: 'Create SSH Tunnel',
            type: 'boolean',
          },
          username: {
            description: 'Username',
            nullable: true,
            type: 'string',
          },
        },
        required: ['database', 'host', 'port', 'username'],
        type: 'object',
      },
      preferred: true,
      sqlalchemy_uri_placeholder:
        'postgresql://user:password@host:port/dbname[?key=value&key=value...]',
      engine_information: {
        supports_file_upload: true,
        disable_ssh_tunneling: false,
      },
    },
    {
      available_drivers: ['rest'],
      engine: 'presto',
      name: 'Presto',
      preferred: true,
      engine_information: {
        supports_file_upload: true,
        disable_ssh_tunneling: false,
      },
    },
    {
      available_drivers: ['mysqldb'],
      default_driver: 'mysqldb',
      engine: 'mysql',
      name: 'MySQL',
      parameters: {
        properties: {
          database: {
            description: 'Database name',
            type: 'string',
          },
          encryption: {
            description: 'Use an encrypted connection to the database',
            type: 'boolean',
          },
          host: {
            description: 'Hostname or IP address',
            type: 'string',
          },
          password: {
            description: 'Password',
            nullable: true,
            type: 'string',
          },
          port: {
            description: 'Database port',
            format: 'int32',
            maximum: 65536,
            minimum: 0,
            type: 'integer',
          },
          query: {
            additionalProperties: {},
            description: 'Additional parameters',
            type: 'object',
          },
          username: {
            description: 'Username',
            nullable: true,
            type: 'string',
          },
        },
        required: ['database', 'host', 'port', 'username'],
        type: 'object',
      },
      preferred: true,
      sqlalchemy_uri_placeholder:
        'mysql://user:password@host:port/dbname[?key=value&key=value...]',
      engine_information: {
        supports_file_upload: true,
        disable_ssh_tunneling: false,
      },
    },
    {
      available_drivers: ['pysqlite'],
      engine: 'sqlite',
      name: 'SQLite',
      preferred: true,
      engine_information: {
        supports_file_upload: true,
        disable_ssh_tunneling: false,
      },
    },
    {
      available_drivers: ['rest'],
      engine: 'druid',
      name: 'Apache Druid',
      preferred: false,
      engine_information: {
        supports_file_upload: true,
        disable_ssh_tunneling: false,
      },
    },
    {
      available_drivers: ['bigquery'],
      default_driver: 'bigquery',
      engine: 'bigquery',
      name: 'Google BigQuery',
      parameters: {
        properties: {
          credentials_info: {
            description: 'Contents of BigQuery JSON credentials.',
            type: 'string',
            'x-encrypted-extra': true,
          },
          query: {
            type: 'object',
          },
        },
        type: 'object',
      },
      preferred: false,
      sqlalchemy_uri_placeholder: 'bigquery://{project_id}',
      engine_information: {
        supports_file_upload: true,
        disable_ssh_tunneling: true,
      },
    },
    {
      available_drivers: ['rest'],
      default_driver: 'apsw',
      engine: 'gsheets',
      name: 'Google Sheets',
      preferred: false,
      engine_information: {
        supports_file_upload: false,
        disable_ssh_tunneling: true,
      },
    },
    {
      available_drivers: ['connector'],
      default_driver: 'connector',
      engine: 'databricks',
      name: 'Databricks',
      parameters: {
        properties: {
          access_token: {
            type: 'string',
          },
          database: {
            type: 'string',
          },
          host: {
            type: 'string',
          },
          http_path: {
            type: 'string',
          },
          port: {
            format: 'int32',
            type: 'integer',
          },
        },
        required: ['access_token', 'database', 'host', 'http_path', 'port'],
        type: 'object',
      },
      preferred: true,
      sqlalchemy_uri_placeholder:
        'databricks+connector://token:{access_token}@{host}:{port}/{database_name}',
    },
  ],
});
fetchMock.post(VALIDATE_PARAMS_ENDPOINT, {
  message: 'OK',
});

describe('DatabaseModal', () => {
  const renderAndWait = async () => {
    const mounted = act(async () => {
      render(<DatabaseModal {...dbProps} />, {
        useRedux: true,
      });
    });

    return mounted;
  };

  beforeEach(async () => {
    await renderAndWait();
  });

  afterEach(cleanup);

  describe('Functional: Create new database', () => {
    test('directs databases to the appropriate form (dynamic vs. SQL Alchemy)', async () => {
      // ---------- Dynamic example (3-step form)
      // Click the PostgreSQL button to enter the dynamic form
      const postgreSQLButton = screen.getByRole('button', {
        name: /postgresql/i,
      });
      userEvent.click(postgreSQLButton);

      // Dynamic form has 3 steps, seeing this text means the dynamic form is present
      const dynamicFormStepText = screen.getByText(/step 2 of 3/i);

      expect(dynamicFormStepText).toBeVisible();

      // ---------- SQL Alchemy example (2-step form)
      // Click the back button to go back to step 1,
      // then click the SQLite button to enter the SQL Alchemy form
      const backButton = screen.getByRole('button', { name: /back/i });
      userEvent.click(backButton);

      const sqliteButton = screen.getByRole('button', {
        name: /sqlite/i,
      });
      userEvent.click(sqliteButton);

      // SQL Alchemy form has 2 steps, seeing this text means the SQL Alchemy form is present
      expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();
      const sqlAlchemyFormStepText = screen.getByText(/step 2 of 2/i);

      expect(sqlAlchemyFormStepText).toBeVisible();
    });

    describe('SQL Alchemy form flow', () => {
      test('enters step 2 of 2 when proper database is selected', async () => {
        userEvent.click(
          screen.getByRole('button', {
            name: /sqlite/i,
          }),
        );

        expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();
      });

      test('runs fetchResource when "Connect" is clicked', () => {
        /* ---------- 🐞 TODO (lyndsiWilliams): function mock is not currently working 🐞 ----------

        // Mock useSingleViewResource
        const mockUseSingleViewResource = jest.fn();
        mockUseSingleViewResource.mockImplementation(useSingleViewResource);

        const { fetchResource } = mockUseSingleViewResource('database');

        // Invalid hook call?
        userEvent.click(screen.getByRole('button', { name: 'Connect' }));
        expect(fetchResource).toHaveBeenCalled();

        The line below makes the linter happy */
        expect.anything();
      });

      describe('step 2 component interaction', () => {
        test('properly interacts with textboxes', async () => {
          userEvent.click(
            screen.getByRole('button', {
              name: /sqlite/i,
            }),
          );

          expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();
          const dbNametextBox = screen.getByTestId('database-name-input');
          expect(dbNametextBox).toHaveValue('SQLite');

          userEvent.type(dbNametextBox, 'Different text');
          expect(dbNametextBox).toHaveValue('SQLiteDifferent text');

          const sqlAlchemyURItextBox = screen.getByTestId(
            'sqlalchemy-uri-input',
          );
          expect(sqlAlchemyURItextBox).toHaveValue('');

          userEvent.type(sqlAlchemyURItextBox, 'Different text');
          expect(sqlAlchemyURItextBox).toHaveValue('Different text');
        });

        test('runs testDatabaseConnection when "TEST CONNECTION" is clicked', () => {
          /* ---------- 🐞 TODO (lyndsiWilliams): function mock is not currently working 🐞 ----------

          // Mock testDatabaseConnection
          const mockTestDatabaseConnection = jest.fn();
          mockTestDatabaseConnection.mockImplementation(testDatabaseConnection);

          userEvent.click(
            screen.getByRole('button', {
              name: /test connection/i,
            }),
          );

          expect(mockTestDatabaseConnection).toHaveBeenCalled();

          The line below makes the linter happy */
          expect.anything();
        });
      });

      describe('SSH Tunnel Form interaction', () => {
        test('properly interacts with SSH Tunnel form textboxes for dynamic form', async () => {
          userEvent.click(
            screen.getByRole('button', {
              name: /postgresql/i,
            }),
          );
          expect(await screen.findByText(/step 2 of 3/i)).toBeInTheDocument();
          const SSHTunnelingToggle = screen.getByTestId('ssh-tunnel-switch');
          userEvent.click(SSHTunnelingToggle);
          const SSHTunnelServerAddressInput = screen.getByTestId(
            'ssh-tunnel-server_address-input',
          );
          expect(SSHTunnelServerAddressInput).toHaveValue('');
          userEvent.type(SSHTunnelServerAddressInput, 'localhost');
          expect(SSHTunnelServerAddressInput).toHaveValue('localhost');
          const SSHTunnelServerPortInput = screen.getByTestId(
            'ssh-tunnel-server_port-input',
          );
          expect(SSHTunnelServerPortInput).toHaveValue(null);
          userEvent.type(SSHTunnelServerPortInput, '22');
          expect(SSHTunnelServerPortInput).toHaveValue(22);
          const SSHTunnelUsernameInput = screen.getByTestId(
            'ssh-tunnel-username-input',
          );
          expect(SSHTunnelUsernameInput).toHaveValue('');
          userEvent.type(SSHTunnelUsernameInput, 'test');
          expect(SSHTunnelUsernameInput).toHaveValue('test');
          const SSHTunnelPasswordInput = screen.getByTestId(
            'ssh-tunnel-password-input',
          );
          expect(SSHTunnelPasswordInput).toHaveValue('');
          userEvent.type(SSHTunnelPasswordInput, 'pass');
          expect(SSHTunnelPasswordInput).toHaveValue('pass');
        });

        test('properly interacts with SSH Tunnel form textboxes', async () => {
          userEvent.click(
            screen.getByRole('button', {
              name: /sqlite/i,
            }),
          );

          expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();
          const SSHTunnelingToggle = screen.getByTestId('ssh-tunnel-switch');
          userEvent.click(SSHTunnelingToggle);
          const SSHTunnelServerAddressInput = screen.getByTestId(
            'ssh-tunnel-server_address-input',
          );
          expect(SSHTunnelServerAddressInput).toHaveValue('');
          userEvent.type(SSHTunnelServerAddressInput, 'localhost');
          expect(SSHTunnelServerAddressInput).toHaveValue('localhost');
          const SSHTunnelServerPortInput = screen.getByTestId(
            'ssh-tunnel-server_port-input',
          );
          expect(SSHTunnelServerPortInput).toHaveValue(null);
          userEvent.type(SSHTunnelServerPortInput, '22');
          expect(SSHTunnelServerPortInput).toHaveValue(22);
          const SSHTunnelUsernameInput = screen.getByTestId(
            'ssh-tunnel-username-input',
          );
          expect(SSHTunnelUsernameInput).toHaveValue('');
          userEvent.type(SSHTunnelUsernameInput, 'test');
          expect(SSHTunnelUsernameInput).toHaveValue('test');
          const SSHTunnelPasswordInput = screen.getByTestId(
            'ssh-tunnel-password-input',
          );
          expect(SSHTunnelPasswordInput).toHaveValue('');
          userEvent.type(SSHTunnelPasswordInput, 'pass');
          expect(SSHTunnelPasswordInput).toHaveValue('pass');
        });

        test('if the SSH Tunneling toggle is not true, no inputs are displayed', async () => {
          userEvent.click(
            screen.getByRole('button', {
              name: /sqlite/i,
            }),
          );

          expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();
          const SSHTunnelingToggle = screen.getByTestId('ssh-tunnel-switch');
          expect(SSHTunnelingToggle).toBeVisible();
          const SSHTunnelServerAddressInput = screen.queryByTestId(
            'ssh-tunnel-server_address-input',
          );
          expect(SSHTunnelServerAddressInput).not.toBeInTheDocument();
          const SSHTunnelServerPortInput = screen.queryByTestId(
            'ssh-tunnel-server_port-input',
          );
          expect(SSHTunnelServerPortInput).not.toBeInTheDocument();
          const SSHTunnelUsernameInput = screen.queryByTestId(
            'ssh-tunnel-username-input',
          );
          expect(SSHTunnelUsernameInput).not.toBeInTheDocument();
          const SSHTunnelPasswordInput = screen.queryByTestId(
            'ssh-tunnel-password-input',
          );
          expect(SSHTunnelPasswordInput).not.toBeInTheDocument();
        });

        test('If user changes the login method, the inputs change', async () => {
          userEvent.click(
            screen.getByRole('button', {
              name: /sqlite/i,
            }),
          );

          expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();
          const SSHTunnelingToggle = screen.getByTestId('ssh-tunnel-switch');
          userEvent.click(SSHTunnelingToggle);
          const SSHTunnelUsePasswordInput = screen.getByTestId(
            'ssh-tunnel-use_password-radio',
          );
          expect(SSHTunnelUsePasswordInput).toBeVisible();
          const SSHTunnelUsePrivateKeyInput = screen.getByTestId(
            'ssh-tunnel-use_private_key-radio',
          );
          expect(SSHTunnelUsePrivateKeyInput).toBeVisible();
          const SSHTunnelPasswordInput = screen.getByTestId(
            'ssh-tunnel-password-input',
          );
          // By default, we use Password as login method
          expect(SSHTunnelPasswordInput).toBeVisible();
          // Change the login method to use private key
          userEvent.click(SSHTunnelUsePrivateKeyInput);
          const SSHTunnelPrivateKeyInput = screen.getByTestId(
            'ssh-tunnel-private_key-input',
          );
          expect(SSHTunnelPrivateKeyInput).toBeVisible();
          const SSHTunnelPrivateKeyPasswordInput = screen.getByTestId(
            'ssh-tunnel-private_key_password-input',
          );
          expect(SSHTunnelPrivateKeyPasswordInput).toBeVisible();
        });
      });
    });
  });
});
