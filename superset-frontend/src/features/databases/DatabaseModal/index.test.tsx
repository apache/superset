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
import React from 'react';
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import {
  render,
  screen,
  within,
  cleanup,
  act,
  waitFor,
} from 'spec/helpers/testing-library';
import { getExtensionsRegistry } from '@superset-ui/core';
import setupExtensions from 'src/setup/setupExtensions';
import * as hooks from 'src/views/CRUD/hooks';
import { DatabaseObject, CONFIGURATION_METHOD } from '../types';
import DatabaseModal, {
  dbReducer,
  DBReducerActionType,
  ActionType,
} from './index';

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

const databaseFixture: DatabaseObject = {
  backend: 'postgres',
  configuration_method: CONFIGURATION_METHOD.DYNAMIC_FORM,
  database_name: 'Postgres',
  name: 'PostgresDB',
  is_managed_externally: false,
  driver: 'psycopg2',
};

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

  describe('Visual: New database connection', () => {
    test('renders the initial load of Step 1 correctly', () => {
      // ---------- Components ----------
      // <TabHeader> - AntD header
      const closeButton = screen.getByLabelText('Close');
      const step1Header = screen.getByRole('heading', {
        name: /connect a database/i,
      });
      // <ModalHeader> - Connection header
      const step1Helper = screen.getByText(/step 1 of 3/i);
      const selectDbHeader = screen.getByRole('heading', {
        name: /select a database to connect/i,
      });
      // <IconButton> - Preferred database buttons
      const preferredDbButtonPostgreSQL = screen.getByRole('button', {
        name: /postgresql/i,
      });
      const preferredDbTextPostgreSQL = within(
        preferredDbButtonPostgreSQL,
      ).getByText(/postgresql/i);
      const preferredDbButtonPresto = screen.getByRole('button', {
        name: /presto/i,
      });
      const preferredDbTextPresto = within(preferredDbButtonPresto).getByText(
        /presto/i,
      );
      const preferredDbButtonMySQL = screen.getByRole('button', {
        name: /mysql/i,
      });
      const preferredDbTextMySQL = within(preferredDbButtonMySQL).getByText(
        /mysql/i,
      );
      const preferredDbButtonSQLite = screen.getByRole('button', {
        name: /sqlite/i,
      });
      const preferredDbTextSQLite = within(preferredDbButtonSQLite).getByText(
        /sqlite/i,
      );
      // renderAvailableSelector() => <Select> - Supported databases selector
      const supportedDbsHeader = screen.getByRole('heading', {
        name: /or choose from a list of other databases we support:/i,
      });
      const selectorLabel = screen.getByText(/supported databases/i);
      const selectorPlaceholder = screen.getByText(/choose a database\.\.\./i);
      const selectorArrow = screen.getByRole('img', {
        name: /down/i,
        hidden: true,
      });

      const footer = document.getElementsByClassName('ant-modal-footer');
      // ---------- TODO (lyndsiWilliams): Selector options, can't seem to get these to render properly.

      // renderAvailableSelector() => <Alert> - Supported databases alert
      const alertIcon = screen.getByRole('img', { name: /info icon/i });
      const alertMessage = screen.getByText(/want to add a new database\?/i);
      const alertDescription = screen.getByText(
        /any databases that allow connections via sql alchemy uris can be added\. learn about how to connect a database driver \./i,
      );
      const alertLink = screen.getByRole('link', { name: /here/i });

      // ---------- Assertions ----------
      const visibleComponents = [
        closeButton,
        step1Header,
        step1Helper,
        selectDbHeader,
        supportedDbsHeader,
        selectorLabel,
        selectorPlaceholder,
        selectorArrow,
        alertIcon,
        alertMessage,
        alertDescription,
        alertLink,
        preferredDbButtonPostgreSQL,
        preferredDbButtonPresto,
        preferredDbButtonMySQL,
        preferredDbButtonSQLite,
        preferredDbTextPostgreSQL,
        preferredDbTextPresto,
        preferredDbTextMySQL,
        preferredDbTextSQLite,
      ];

      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
      // there should be a footer but it should not have any buttons in it
      expect(footer[0]).toBeEmptyDOMElement();
    });

    test('renders the "Basic" tab of SQL Alchemy form (step 2 of 2) correctly', async () => {
      // On step 1, click dbButton to access SQL Alchemy form
      userEvent.click(
        screen.getByRole('button', {
          name: /sqlite/i,
        }),
      );
      expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();

      // ---------- Components ----------
      // <TabHeader> - AntD header
      const closeButton = screen.getByRole('button', { name: /close/i });
      const basicHeader = screen.getByRole('heading', {
        name: /connect a database/i,
      });
      // <ModalHeader> - Connection header
      const basicHelper = screen.getByText(/step 2 of 2/i);
      const basicHeaderTitle = screen.getByText(/enter primary credentials/i);
      const basicHeaderSubtitle = screen.getByText(
        /need help\? learn how to connect your database \./i,
      );
      const basicHeaderLink = within(basicHeaderSubtitle).getByRole('link', {
        name: /here/i,
      });
      // <Tabs> - Basic/Advanced tabs
      const basicTab = screen.getByRole('tab', { name: /basic/i });
      const advancedTab = screen.getByRole('tab', { name: /advanced/i });
      // <StyledBasicTab> - Basic tab's content
      const displayNameLabel = screen.getByText(/display name*/i);
      const displayNameInput = screen.getByTestId('database-name-input');
      const displayNameHelper = screen.getByText(
        /pick a name to help you identify this database\./i,
      );
      const SQLURILabel = screen.getByText(/sqlalchemy uri*/i);
      const SQLURIInput = screen.getByTestId('sqlalchemy-uri-input');
      const SQLURIHelper = screen.getByText(
        /refer to the for more information on how to structure your uri\./i,
      );
      // <SSHTunnelForm> - Basic tab's SSH Tunnel Form
      const SSHTunnelingToggle = screen.getByTestId('ssh-tunnel-switch');
      userEvent.click(SSHTunnelingToggle);
      const SSHTunnelServerAddressInput = screen.getByTestId(
        'ssh-tunnel-server_address-input',
      );
      const SSHTunnelServerPortInput = screen.getByTestId(
        'ssh-tunnel-server_port-input',
      );
      const SSHTunnelUsernameInput = screen.getByTestId(
        'ssh-tunnel-username-input',
      );
      const SSHTunnelPasswordInput = screen.getByTestId(
        'ssh-tunnel-password-input',
      );
      const testConnectionButton = screen.getByRole('button', {
        name: /test connection/i,
      });
      // <Alert> - Basic tab's alert
      const alertIcon = screen.getByRole('img', { name: /info icon/i });
      const alertMessage = screen.getByText(
        /additional fields may be required/i,
      );
      const alertDescription = screen.getByText(
        /select databases require additional fields to be completed in the advanced tab to successfully connect the database\. learn what requirements your databases has \./i,
      );
      const alertLink = within(alertDescription).getByRole('link', {
        name: /here/i,
      });
      // renderModalFooter() - Basic tab's footer
      const backButton = screen.getByRole('button', { name: /back/i });
      const connectButton = screen.getByRole('button', { name: 'Connect' });

      // ---------- Assertions ----------
      const visibleComponents = [
        closeButton,
        basicHeader,
        basicHelper,
        basicHeaderTitle,
        basicHeaderSubtitle,
        basicHeaderLink,
        basicTab,
        advancedTab,
        displayNameLabel,
        displayNameInput,
        displayNameHelper,
        SQLURILabel,
        SQLURIInput,
        SQLURIHelper,
        SSHTunnelingToggle,
        SSHTunnelServerAddressInput,
        SSHTunnelServerPortInput,
        SSHTunnelUsernameInput,
        SSHTunnelPasswordInput,
        testConnectionButton,
        alertIcon,
        alertMessage,
        alertDescription,
        alertLink,
        backButton,
        connectButton,
      ];

      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
    });

    test('renders the unexpanded "Advanced" tab correctly', async () => {
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /sqlite/i,
        }),
      );
      expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();
      // Click the "Advanced" tab
      userEvent.click(screen.getByRole('tab', { name: /advanced/i }));

      // ---------- Components ----------
      // <TabHeader> - AntD header
      const closeButton = screen.getByRole('button', { name: /close/i });
      const advancedHeader = screen.getByRole('heading', {
        name: /connect a database/i,
      });
      // <ModalHeader> - Connection header
      const basicHelper = screen.getByText(/step 2 of 2/i);
      const basicHeaderTitle = screen.getByText(/enter primary credentials/i);
      const basicHeaderSubtitle = screen.getByText(
        /need help\? learn how to connect your database \./i,
      );
      const basicHeaderLink = within(basicHeaderSubtitle).getByRole('link', {
        name: /here/i,
      });
      // <Tabs> - Basic/Advanced tabs
      const basicTab = screen.getByRole('tab', { name: /basic/i });
      const advancedTab = screen.getByRole('tab', { name: /advanced/i });
      // <ExtraOptions> - Advanced tabs
      const sqlLabTab = screen.getByRole('tab', {
        name: /right sql lab adjust how this database will interact with sql lab\./i,
      });
      const sqlLabTabArrow = within(sqlLabTab).getByRole('img', {
        name: /right/i,
      });
      const sqlLabTabHeading = screen.getByRole('heading', {
        name: /sql lab/i,
      });
      const performanceTab = screen.getByRole('tab', {
        name: /right performance adjust performance settings of this database\./i,
      });
      const performanceTabArrow = within(performanceTab).getByRole('img', {
        name: /right/i,
      });
      const performanceTabHeading = screen.getByRole('heading', {
        name: /performance/i,
      });
      const securityTab = screen.getByRole('tab', {
        name: /right security add extra connection information\./i,
      });
      const securityTabArrow = within(securityTab).getByRole('img', {
        name: /right/i,
      });
      const securityTabHeading = screen.getByRole('heading', {
        name: /security/i,
      });
      const otherTab = screen.getByRole('tab', {
        name: /right other additional settings\./i,
      });
      const otherTabArrow = within(otherTab).getByRole('img', {
        name: /right/i,
      });
      const otherTabHeading = screen.getByRole('heading', { name: /other/i });
      // renderModalFooter() - Advanced tab's footer
      const backButton = screen.getByRole('button', { name: /back/i });
      const connectButton = screen.getByRole('button', { name: 'Connect' });

      // ---------- Assertions ----------
      const visibleComponents = [
        closeButton,
        advancedHeader,
        basicHelper,
        basicHeaderTitle,
        basicHeaderSubtitle,
        basicHeaderLink,
        basicTab,
        advancedTab,
        sqlLabTab,
        sqlLabTabArrow,
        sqlLabTabHeading,
        performanceTab,
        performanceTabArrow,
        performanceTabHeading,
        securityTab,
        securityTabArrow,
        securityTabHeading,
        otherTab,
        otherTabArrow,
        otherTabHeading,
        backButton,
        connectButton,
      ];

      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
    });

    test('renders the "Advanced" - SQL LAB tab correctly (unexpanded)', async () => {
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /sqlite/i,
        }),
      );
      // Click the "Advanced" tab
      userEvent.click(screen.getByRole('tab', { name: /advanced/i }));
      // Click the "SQL Lab" tab
      userEvent.click(
        screen.getByRole('tab', {
          name: /right sql lab adjust how this database will interact with sql lab\./i,
        }),
      );
      expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();

      // ----- BEGIN STEP 2 (ADVANCED - SQL LAB)
      // <TabHeader> - AntD header
      const closeButton = screen.getByRole('button', { name: /close/i });
      const advancedHeader = screen.getByRole('heading', {
        name: /connect a database/i,
      });
      // <ModalHeader> - Connection header
      const basicHelper = screen.getByText(/step 2 of 2/i);
      const basicHeaderTitle = screen.getByText(/enter primary credentials/i);
      const basicHeaderSubtitle = screen.getByText(
        /need help\? learn how to connect your database \./i,
      );
      const basicHeaderLink = within(basicHeaderSubtitle).getByRole('link', {
        name: /here/i,
      });
      // <Tabs> - Basic/Advanced tabs
      const basicTab = screen.getByRole('tab', { name: /basic/i });
      const advancedTab = screen.getByRole('tab', { name: /advanced/i });
      // <ExtraOptions> - Advanced tabs
      const sqlLabTab = screen.getByRole('tab', {
        name: /right sql lab adjust how this database will interact with sql lab\./i,
      });
      // These are the checkbox SVGs that cover the actual checkboxes
      const checkboxOffSVGs = screen.getAllByRole('img', {
        name: /checkbox-off/i,
      });
      const tooltipIcons = screen.getAllByRole('img', {
        name: /info-solid_small/i,
      });
      const exposeInSQLLabCheckbox = screen.getByRole('checkbox', {
        name: /expose database in sql lab/i,
      });
      // This is both the checkbox and it's respective SVG
      // const exposeInSQLLabCheckboxSVG = checkboxOffSVGs[0].parentElement;
      const exposeInSQLLabText = screen.getByText(
        /expose database in sql lab/i,
      );
      const allowCTASCheckbox = screen.getByRole('checkbox', {
        name: /allow create table as/i,
      });
      const allowCTASText = screen.getByText(/allow create table as/i);
      const allowCVASCheckbox = screen.getByRole('checkbox', {
        name: /allow create table as/i,
      });
      const allowCVASText = screen.getByText(/allow create table as/i);
      const CTASCVASLabelText = screen.getByText(/ctas & cvas schema/i);
      // This grabs the whole input by placeholder text
      const CTASCVASInput = screen.getByPlaceholderText(
        /create or select schema\.\.\./i,
      );
      const CTASCVASHelperText = screen.getByText(
        /force all tables and views to be created in this schema when clicking ctas or cvas in sql lab\./i,
      );
      const allowDMLCheckbox = screen.getByRole('checkbox', {
        name: /allow dml/i,
      });
      const allowDMLText = screen.getByText(/allow dml/i);
      const enableQueryCostEstimationCheckbox = screen.getByRole('checkbox', {
        name: /enable query cost estimation/i,
      });
      const enableQueryCostEstimationText = screen.getByText(
        /enable query cost estimation/i,
      );
      const allowDbExplorationCheckbox = screen.getByRole('checkbox', {
        name: /allow this database to be explored/i,
      });
      const allowDbExplorationText = screen.getByText(
        /allow this database to be explored/i,
      );
      const disableSQLLabDataPreviewQueriesCheckbox = screen.getByRole(
        'checkbox',
        {
          name: /Disable SQL Lab data preview queries/i,
        },
      );
      const disableSQLLabDataPreviewQueriesText = screen.getByText(
        /Disable SQL Lab data preview queries/i,
      );

      // ---------- Assertions ----------
      const visibleComponents = [
        closeButton,
        advancedHeader,
        basicHelper,
        basicHeaderTitle,
        basicHeaderSubtitle,
        basicHeaderLink,
        basicTab,
        advancedTab,
        sqlLabTab,
        checkboxOffSVGs[0],
        checkboxOffSVGs[1],
        checkboxOffSVGs[2],
        checkboxOffSVGs[3],
        checkboxOffSVGs[4],
        tooltipIcons[0],
        tooltipIcons[1],
        tooltipIcons[2],
        tooltipIcons[3],
        tooltipIcons[4],
        tooltipIcons[5],
        tooltipIcons[6],
        exposeInSQLLabText,
        allowCTASText,
        allowCVASText,
        CTASCVASLabelText,
        CTASCVASInput,
        CTASCVASHelperText,
        allowDMLText,
        enableQueryCostEstimationText,
        allowDbExplorationText,
        disableSQLLabDataPreviewQueriesText,
      ];
      // These components exist in the DOM but are not visible
      const invisibleComponents = [
        exposeInSQLLabCheckbox,
        allowCTASCheckbox,
        allowCVASCheckbox,
        allowDMLCheckbox,
        enableQueryCostEstimationCheckbox,
        allowDbExplorationCheckbox,
        disableSQLLabDataPreviewQueriesCheckbox,
      ];
      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
      invisibleComponents.forEach(component => {
        expect(component).not.toBeVisible();
      });
      expect(checkboxOffSVGs).toHaveLength(5);
      expect(tooltipIcons).toHaveLength(7);
    });

    test('renders the "Advanced" - PERFORMANCE tab correctly', async () => {
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /sqlite/i,
        }),
      );
      // Click the "Advanced" tab
      userEvent.click(screen.getByRole('tab', { name: /advanced/i }));
      // Click the "Performance" tab
      userEvent.click(
        screen.getByRole('tab', {
          name: /right performance adjust performance settings of this database\./i,
        }),
      );
      expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();

      // ----- BEGIN STEP 2 (ADVANCED - PERFORMANCE)
      // <TabHeader> - AntD header
      const closeButton = screen.getByRole('button', { name: /close/i });
      const advancedHeader = screen.getByRole('heading', {
        name: /connect a database/i,
      });
      // <ModalHeader> - Connection header
      const basicHelper = screen.getByText(/step 2 of 2/i);
      const basicHeaderTitle = screen.getByText(/enter primary credentials/i);
      const basicHeaderSubtitle = screen.getByText(
        /need help\? learn how to connect your database \./i,
      );
      const basicHeaderLink = within(basicHeaderSubtitle).getByRole('link', {
        name: /here/i,
      });
      // <Tabs> - Basic/Advanced tabs
      const basicTab = screen.getByRole('tab', { name: /basic/i });
      const advancedTab = screen.getByRole('tab', { name: /advanced/i });
      // <ExtraOptions> - Advanced tabs
      const sqlLabTab = screen.getByRole('tab', {
        name: /right sql lab adjust how this database will interact with sql lab\./i,
      });
      const performanceTab = screen.getByRole('tab', {
        name: /right performance adjust performance settings of this database\./i,
      });

      // ---------- Assertions ----------
      const visibleComponents = [
        closeButton,
        advancedHeader,
        basicHelper,
        basicHeaderTitle,
        basicHeaderSubtitle,
        basicHeaderLink,
        basicTab,
        advancedTab,
        sqlLabTab,
        performanceTab,
      ];

      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
    });

    test('renders the "Advanced" - SECURITY tab correctly', async () => {
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /sqlite/i,
        }),
      );
      // Click the "Advanced" tab
      userEvent.click(screen.getByRole('tab', { name: /advanced/i }));
      // Click the "Security" tab
      userEvent.click(
        screen.getByRole('tab', {
          name: /right security add extra connection information\./i,
        }),
      );
      expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();

      // ----- BEGIN STEP 2 (ADVANCED - SECURITY)
      // <TabHeader> - AntD header
      const closeButton = screen.getByRole('button', { name: /close/i });
      const advancedHeader = screen.getByRole('heading', {
        name: /connect a database/i,
      });
      // <ModalHeader> - Connection header
      const basicHelper = screen.getByText(/step 2 of 2/i);
      const basicHeaderTitle = screen.getByText(/enter primary credentials/i);
      const basicHeaderSubtitle = screen.getByText(
        /need help\? learn how to connect your database \./i,
      );
      const basicHeaderLink = within(basicHeaderSubtitle).getByRole('link', {
        name: /here/i,
      });
      // <Tabs> - Basic/Advanced tabs
      const basicTab = screen.getByRole('tab', { name: /basic/i });
      const advancedTab = screen.getByRole('tab', { name: /advanced/i });
      // <ExtraOptions> - Advanced tabs
      const sqlLabTab = screen.getByRole('tab', {
        name: /right sql lab adjust how this database will interact with sql lab\./i,
      });
      const performanceTab = screen.getByRole('tab', {
        name: /right performance adjust performance settings of this database\./i,
      });
      const securityTab = screen.getByRole('tab', {
        name: /right security add extra connection information\./i,
      });
      const allowFileUploadCheckbox = screen.getByRole('checkbox', {
        name: /Allow file uploads to database/i,
      });
      const allowFileUploadText = screen.getByText(
        /Allow file uploads to database/i,
      );

      const schemasForFileUploadText = screen.queryByText(
        /Schemas allowed for File upload/i,
      );

      const visibleComponents = [
        closeButton,
        advancedHeader,
        basicHelper,
        basicHeaderTitle,
        basicHeaderSubtitle,
        basicHeaderLink,
        basicTab,
        advancedTab,
        sqlLabTab,
        performanceTab,
        securityTab,
        allowFileUploadText,
      ];
      // These components exist in the DOM but are not visible
      const invisibleComponents = [allowFileUploadCheckbox];

      // ---------- Assertions ----------
      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
      invisibleComponents.forEach(component => {
        expect(component).not.toBeVisible();
      });
      expect(schemasForFileUploadText).not.toBeInTheDocument();
    });

    it('renders the "Advanced" - SECURITY tab correctly after selecting Allow file uploads', async () => {
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /sqlite/i,
        }),
      );
      // Click the "Advanced" tab
      userEvent.click(screen.getByRole('tab', { name: /advanced/i }));
      // Click the "Security" tab
      userEvent.click(
        screen.getByRole('tab', {
          name: /right security add extra connection information\./i,
        }),
      );
      // Click the "Allow file uploads" tab

      const allowFileUploadCheckbox = screen.getByRole('checkbox', {
        name: /Allow file uploads to database/i,
      });
      userEvent.click(allowFileUploadCheckbox);

      // ----- BEGIN STEP 2 (ADVANCED - SECURITY)
      // <TabHeader> - AntD header
      const closeButton = screen.getByRole('button', { name: /close/i });
      const advancedHeader = screen.getByRole('heading', {
        name: /connect a database/i,
      });
      // <ModalHeader> - Connection header
      const basicHelper = screen.getByText(/step 2 of 2/i);
      const basicHeaderTitle = screen.getByText(/enter primary credentials/i);
      const basicHeaderSubtitle = screen.getByText(
        /need help\? learn how to connect your database \./i,
      );
      const basicHeaderLink = within(basicHeaderSubtitle).getByRole('link', {
        name: /here/i,
      });
      // <Tabs> - Basic/Advanced tabs
      const basicTab = screen.getByRole('tab', { name: /basic/i });
      const advancedTab = screen.getByRole('tab', { name: /advanced/i });
      // <ExtraOptions> - Advanced tabs
      const sqlLabTab = screen.getByRole('tab', {
        name: /right sql lab adjust how this database will interact with sql lab\./i,
      });
      const performanceTab = screen.getByRole('tab', {
        name: /right performance adjust performance settings of this database\./i,
      });
      const securityTab = screen.getByRole('tab', {
        name: /right security add extra connection information\./i,
      });
      const allowFileUploadText = screen.getByText(
        /Allow file uploads to database/i,
      );

      const schemasForFileUploadText = screen.queryByText(
        /Schemas allowed for File upload/i,
      );

      const visibleComponents = [
        closeButton,
        advancedHeader,
        basicHelper,
        basicHeaderTitle,
        basicHeaderSubtitle,
        basicHeaderLink,
        basicTab,
        advancedTab,
        sqlLabTab,
        performanceTab,
        securityTab,
        allowFileUploadText,
      ];
      // These components exist in the DOM but are not visible
      const invisibleComponents = [allowFileUploadCheckbox];

      // ---------- Assertions ----------
      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
      invisibleComponents.forEach(component => {
        expect(component).not.toBeVisible();
      });
      expect(schemasForFileUploadText).toBeInTheDocument();
    });

    test('renders the "Advanced" - OTHER tab correctly', async () => {
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /sqlite/i,
        }),
      );
      // Click the "Advanced" tab
      userEvent.click(screen.getByRole('tab', { name: /advanced/i }));
      // Click the "Other" tab
      userEvent.click(
        screen.getByRole('tab', {
          name: /right other additional settings\./i,
        }),
      );
      expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();

      // ----- BEGIN STEP 2 (ADVANCED - OTHER)
      // <TabHeader> - AntD header
      const closeButton = screen.getByRole('button', { name: /close/i });
      const advancedHeader = screen.getByRole('heading', {
        name: /connect a database/i,
      });
      // <ModalHeader> - Connection header
      const basicHelper = screen.getByText(/step 2 of 2/i);
      const basicHeaderTitle = screen.getByText(/enter primary credentials/i);
      const basicHeaderSubtitle = screen.getByText(
        /need help\? learn how to connect your database \./i,
      );
      const basicHeaderLink = within(basicHeaderSubtitle).getByRole('link', {
        name: /here/i,
      });
      // <Tabs> - Basic/Advanced tabs
      const basicTab = screen.getByRole('tab', { name: /basic/i });
      const advancedTab = screen.getByRole('tab', { name: /advanced/i });
      // <ExtraOptions> - Advanced tabs
      const sqlLabTab = screen.getByRole('tab', {
        name: /right sql lab adjust how this database will interact with sql lab\./i,
      });
      const performanceTab = screen.getByRole('tab', {
        name: /right performance adjust performance settings of this database\./i,
      });
      const securityTab = screen.getByRole('tab', {
        name: /right security add extra connection information\./i,
      });
      const otherTab = screen.getByRole('tab', {
        name: /right other additional settings\./i,
      });

      // ---------- Assertions ----------
      const visibleComponents = [
        closeButton,
        advancedHeader,
        basicHelper,
        basicHeaderTitle,
        basicHeaderSubtitle,
        basicHeaderLink,
        basicTab,
        advancedTab,
        sqlLabTab,
        performanceTab,
        securityTab,
        otherTab,
      ];

      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
    });

    test('Dynamic form', async () => {
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /postgresql/i,
        }),
      );
      expect(await screen.findByText(/step 2 of 3/i)).toBeInTheDocument();

      expect.anything();
    });
  });

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
          expect(SSHTunnelServerPortInput).toHaveValue('');
          userEvent.type(SSHTunnelServerPortInput, '22');
          expect(SSHTunnelServerPortInput).toHaveValue('22');
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
          expect(SSHTunnelServerPortInput).toHaveValue('');
          userEvent.type(SSHTunnelServerPortInput, '22');
          expect(SSHTunnelServerPortInput).toHaveValue('22');
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

    describe('Dynamic form flow', () => {
      test('enters step 2 of 3 when proper database is selected', async () => {
        expect(await screen.findByText(/step 1 of 3/i)).toBeInTheDocument();
        userEvent.click(
          screen.getByRole('button', {
            name: /postgresql/i,
          }),
        );
        expect(await screen.findByText(/step 2 of 3/i)).toBeInTheDocument();

        const step2of3text = screen.getByText(/step 2 of 3/i);
        expect(step2of3text).toBeVisible();
      });

      test('enters form credentials and runs fetchResource when "Connect" is clicked', async () => {
        userEvent.click(
          screen.getByRole('button', {
            name: /postgresql/i,
          }),
        );

        const textboxes = screen.getAllByRole('textbox');
        const hostField = textboxes[0];
        const portField = screen.getByRole('spinbutton');
        const databaseNameField = textboxes[1];
        const usernameField = textboxes[2];
        const passwordField = textboxes[3];
        const connectButton = screen.getByRole('button', { name: 'Connect' });

        expect(hostField).toHaveValue('');
        expect(portField).toHaveValue(null);
        expect(databaseNameField).toHaveValue('');
        expect(usernameField).toHaveValue('');
        expect(passwordField).toHaveValue('');

        userEvent.type(hostField, 'localhost');
        userEvent.type(portField, '5432');
        userEvent.type(databaseNameField, 'postgres');
        userEvent.type(usernameField, 'testdb');
        userEvent.type(passwordField, 'demoPassword');

        expect(await screen.findByDisplayValue(/5432/i)).toBeInTheDocument();
        expect(hostField).toHaveValue('localhost');
        expect(portField).toHaveValue(5432);
        expect(databaseNameField).toHaveValue('postgres');
        expect(usernameField).toHaveValue('testdb');
        expect(passwordField).toHaveValue('demoPassword');

        userEvent.click(connectButton);
        await waitFor(() => {
          expect(fetchMock.calls(VALIDATE_PARAMS_ENDPOINT).length).toEqual(6);
        });
      });
    });

    describe('Import database flow', () => {
      test('imports a file', async () => {
        const importDbButton = screen.getByTestId(
          'import-database-btn',
        ) as HTMLInputElement;
        expect(importDbButton).toBeVisible();

        const testFile = new File([new ArrayBuffer(1)], 'model_export.zip');

        userEvent.click(importDbButton);
        userEvent.upload(importDbButton, testFile);

        expect(importDbButton.files?.[0]).toStrictEqual(testFile);
        expect(importDbButton.files?.item(0)).toStrictEqual(testFile);
        expect(importDbButton.files).toHaveLength(1);
      });
    });
  });

  describe('DatabaseModal w/ Deeplinking Engine', () => {
    const renderAndWait = async () => {
      const mounted = act(async () => {
        render(<DatabaseModal {...dbProps} dbEngine="PostgreSQL" />, {
          useRedux: true,
        });
      });

      return mounted;
    };

    beforeEach(async () => {
      await renderAndWait();
    });

    test('enters step 2 of 3 when proper database is selected', () => {
      const step2of3text = screen.getByText(/step 2 of 3/i);
      expect(step2of3text).toBeVisible();
    });
  });

  describe('DatabaseModal w/ GSheet Engine', () => {
    const renderAndWait = async () => {
      const dbProps = {
        show: true,
        database_name: 'my database',
        sqlalchemy_uri: 'gsheets://',
      };
      const mounted = act(async () => {
        render(<DatabaseModal {...dbProps} dbEngine="Google Sheets" />, {
          useRedux: true,
        });
      });

      return mounted;
    };

    beforeEach(async () => {
      await renderAndWait();
    });

    it('enters step 2 of 2 when proper database is selected', () => {
      const step2of2text = screen.getByText(/step 2 of 2/i);
      expect(step2of2text).toBeVisible();
    });

    it('renders the "Advanced" - SECURITY tab without Allow File Upload Checkbox', async () => {
      // Click the "Advanced" tab
      userEvent.click(screen.getByRole('tab', { name: /advanced/i }));
      // Click the "Security" tab
      userEvent.click(
        screen.getByRole('tab', {
          name: /right security add extra connection information\./i,
        }),
      );

      // ----- BEGIN STEP 2 (ADVANCED - SECURITY)
      // <ExtraOptions> - Advanced tabs
      const impersonateLoggerUserCheckbox = screen.getByRole('checkbox', {
        name: /impersonate logged in/i,
      });
      const impersonateLoggerUserText = screen.getByText(
        /impersonate logged in/i,
      );
      const allowFileUploadText = screen.queryByText(
        /Allow file uploads to database/i,
      );
      const schemasForFileUploadText = screen.queryByText(
        /Schemas allowed for File upload/i,
      );

      const visibleComponents = [impersonateLoggerUserText];
      // These components exist in the DOM but are not visible
      const invisibleComponents = [impersonateLoggerUserCheckbox];

      // ---------- Assertions ----------
      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
      invisibleComponents.forEach(component => {
        expect(component).not.toBeVisible();
      });
      expect(allowFileUploadText).not.toBeInTheDocument();
      expect(schemasForFileUploadText).not.toBeInTheDocument();
    });

    it('if the SSH Tunneling toggle is not displayed, nothing should get displayed', async () => {
      const SSHTunnelingToggle = screen.queryByTestId('ssh-tunnel-switch');
      expect(SSHTunnelingToggle).not.toBeInTheDocument();
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
  });

  describe('DatabaseModal w errors as objects', () => {
    jest.mock('src/views/CRUD/hooks', () => ({
      ...jest.requireActual('src/views/CRUD/hooks'),
      useSingleViewResource: jest.fn(),
    }));

    const renderAndWait = async () => {
      const mounted = act(async () => {
        render(<DatabaseModal {...dbProps} dbEngine="PostgreSQL" />, {
          useRedux: true,
        });
      });

      return mounted;
    };

    beforeEach(async () => {
      await renderAndWait();
    });

    test('Error displays when it is an object', async () => {
      const step2of3text = screen.getByText(/step 2 of 3/i);
      const errorSection = screen.getByText(/Database Creation Error/i);
      expect(step2of3text).toBeVisible();
      expect(errorSection).toBeVisible();
    });
  });

  describe('DatabaseModal w errors as strings', () => {
    jest.mock('src/views/CRUD/hooks', () => ({
      ...jest.requireActual('src/views/CRUD/hooks'),
      useSingleViewResource: jest.fn(),
    }));
    const useSingleViewResourceMock = jest.spyOn(
      hooks,
      'useSingleViewResource',
    );

    useSingleViewResourceMock.mockReturnValue({
      state: {
        loading: false,
        resource: null,
        error: 'Test Error With String',
      },
      fetchResource: jest.fn(),
      createResource: jest.fn(),
      updateResource: jest.fn(),
      clearError: jest.fn(),
      setResource: jest.fn(),
    });

    const renderAndWait = async () => {
      const mounted = act(async () => {
        render(<DatabaseModal {...dbProps} dbEngine="PostgreSQL" />, {
          useRedux: true,
        });
      });

      return mounted;
    };

    beforeEach(async () => {
      await renderAndWait();
    });

    test('Error displays when it is a string', async () => {
      const step2of3text = screen.getByText(/step 2 of 3/i);
      const errorTitleMessage = screen.getByText(/Database Creation Error/i);
      const button = screen.getByText('See more');
      userEvent.click(button);
      const errorMessage = screen.getByText(/Test Error With String/i);
      expect(errorMessage).toBeVisible();
      const closeButton = screen.getByText('Close');
      userEvent.click(closeButton);
      expect(step2of3text).toBeVisible();
      expect(errorTitleMessage).toBeVisible();
    });
  });

  describe('DatabaseModal w Extensions', () => {
    const renderAndWait = async () => {
      const extensionsRegistry = getExtensionsRegistry();

      extensionsRegistry.set('ssh_tunnel.form.switch', () => (
        <>ssh_tunnel.form.switch extension component</>
      ));

      setupExtensions();

      const mounted = act(async () => {
        render(<DatabaseModal {...dbProps} dbEngine="SQLite" />, {
          useRedux: true,
        });
      });

      return mounted;
    };

    beforeEach(async () => {
      await renderAndWait();
    });

    test('should render an extension component if one is supplied', () => {
      expect(
        screen.getByText('ssh_tunnel.form.switch extension component'),
      ).toBeInTheDocument();
    });
  });
});

describe('dbReducer', () => {
  test('it will reset state to null', () => {
    const action: DBReducerActionType = { type: ActionType.reset };
    const currentState = dbReducer(databaseFixture, action);
    expect(currentState).toBeNull();
  });

  test('it will set state to payload from fetched', () => {
    const action: DBReducerActionType = {
      type: ActionType.fetched,
      payload: databaseFixture,
    };
    const currentState = dbReducer({}, action);
    expect(currentState).toEqual({
      ...databaseFixture,
      engine: 'postgres',
      masked_encrypted_extra: '',
      parameters: undefined,
      query_input: '',
    });
  });

  test('it will set state to payload from extra editor', () => {
    const action: DBReducerActionType = {
      type: ActionType.extraEditorChange,
      payload: { name: 'foo', json: JSON.stringify({ bar: 1 }) },
    };
    const currentState = dbReducer(databaseFixture, action);
    // extra should be serialized
    expect(currentState).toEqual({
      ...databaseFixture,
      extra: '{"foo":{"bar":1}}',
    });
  });

  test('it will set state to payload from editor', () => {
    const action: DBReducerActionType = {
      type: ActionType.editorChange,
      payload: { name: 'foo', json: JSON.stringify({ bar: 1 }) },
    };
    const currentState = dbReducer(databaseFixture, action);
    // extra should be serialized
    expect(currentState).toEqual({
      ...databaseFixture,
      foo: JSON.stringify({ bar: 1 }),
    });
  });

  test('it will add extra payload to existing extra data', () => {
    const action: DBReducerActionType = {
      type: ActionType.extraEditorChange,
      payload: { name: 'foo', json: JSON.stringify({ bar: 1 }) },
    };
    // extra should be a string
    const currentState = dbReducer(
      {
        ...databaseFixture,
        extra: JSON.stringify({ name: 'baz', json: { fiz: 2 } }),
      },
      action,
    );
    // extra should be serialized
    expect(currentState).toEqual({
      ...databaseFixture,
      extra: '{"name":"baz","json":{"fiz":2},"foo":{"bar":1}}',
    });
  });

  test('it will set state to payload from extra input change', () => {
    const action: DBReducerActionType = {
      type: ActionType.extraInputChange,
      payload: { name: 'foo', value: 'bar' },
    };
    const currentState = dbReducer(databaseFixture, action);

    // extra should be serialized
    expect(currentState).toEqual({
      ...databaseFixture,
      extra: '{"foo":"bar"}',
    });
  });

  test('it will set state to payload from extra input change when checkbox', () => {
    const action: DBReducerActionType = {
      type: ActionType.extraInputChange,
      payload: { name: 'foo', type: 'checkbox', checked: true },
    };
    const currentState = dbReducer(databaseFixture, action);

    // extra should be serialized
    expect(currentState).toEqual({
      ...databaseFixture,
      extra: '{"foo":true}',
    });
  });

  test('it will set state to payload from extra input change when schema_cache_timeout', () => {
    const action: DBReducerActionType = {
      type: ActionType.extraInputChange,
      payload: { name: 'schema_cache_timeout', value: 'bar' },
    };
    const currentState = dbReducer(databaseFixture, action);

    // extra should be serialized
    expect(currentState).toEqual({
      ...databaseFixture,
      extra: '{"metadata_cache_timeout":{"schema_cache_timeout":"bar"}}',
    });
  });

  test('it will set state to payload from extra input change when table_cache_timeout', () => {
    const action: DBReducerActionType = {
      type: ActionType.extraInputChange,
      payload: { name: 'table_cache_timeout', value: 'bar' },
    };
    const currentState = dbReducer(databaseFixture, action);

    // extra should be serialized
    expect(currentState).toEqual({
      ...databaseFixture,
      extra: '{"metadata_cache_timeout":{"table_cache_timeout":"bar"}}',
    });
  });

  test('it will overwrite state to payload from extra input change when table_cache_timeout', () => {
    const action: DBReducerActionType = {
      type: ActionType.extraInputChange,
      payload: { name: 'table_cache_timeout', value: 'bar' },
    };
    const currentState = dbReducer(
      {
        ...databaseFixture,
        extra: '{"metadata_cache_timeout":{"table_cache_timeout":"foo"}}',
      },
      action,
    );

    // extra should be serialized
    expect(currentState).toEqual({
      ...databaseFixture,
      extra: '{"metadata_cache_timeout":{"table_cache_timeout":"bar"}}',
    });
  });

  test(`it will set state to payload from extra
  input change when schemas_allowed_for_file_upload`, () => {
    const action: DBReducerActionType = {
      type: ActionType.extraInputChange,
      payload: { name: 'schemas_allowed_for_file_upload', value: 'bar' },
    };
    const currentState = dbReducer(databaseFixture, action);

    // extra should be serialized
    expect(currentState).toEqual({
      ...databaseFixture,
      extra: '{"schemas_allowed_for_file_upload":["bar"]}',
    });
  });

  test(`it will overwrite state to payload from extra
  input change when schemas_allowed_for_file_upload`, () => {
    const action: DBReducerActionType = {
      type: ActionType.extraInputChange,
      payload: { name: 'schemas_allowed_for_file_upload', value: 'bar' },
    };
    const currentState = dbReducer(
      {
        ...databaseFixture,
        extra: '{"schemas_allowed_for_file_upload":["foo"]}',
      },
      action,
    );

    // extra should be serialized
    expect(currentState).toEqual({
      ...databaseFixture,
      extra: '{"schemas_allowed_for_file_upload":["bar"]}',
    });
  });

  test(`it will set state to payload from extra
  input change when schemas_allowed_for_file_upload
  with blank list`, () => {
    const action: DBReducerActionType = {
      type: ActionType.extraInputChange,
      payload: { name: 'schemas_allowed_for_file_upload', value: 'bar,' },
    };
    const currentState = dbReducer(databaseFixture, action);

    // extra should be serialized
    expect(currentState).toEqual({
      ...databaseFixture,
      extra: '{"schemas_allowed_for_file_upload":["bar"]}',
    });
  });

  test('it will set state to payload from input change', () => {
    const action: DBReducerActionType = {
      type: ActionType.inputChange,
      payload: { name: 'foo', value: 'bar' },
    };
    const currentState = dbReducer(databaseFixture, action);

    expect(currentState).toEqual({
      ...databaseFixture,
      foo: 'bar',
    });
  });

  test('it will set state to payload from input change for checkbox', () => {
    const action: DBReducerActionType = {
      type: ActionType.inputChange,
      payload: { name: 'foo', type: 'checkbox', checked: true },
    };
    const currentState = dbReducer(databaseFixture, action);

    expect(currentState).toEqual({
      ...databaseFixture,
      foo: true,
    });
  });

  test('it will change state to payload from input change for checkbox', () => {
    const action: DBReducerActionType = {
      type: ActionType.inputChange,
      payload: { name: 'allow_ctas', type: 'checkbox', checked: false },
    };
    const currentState = dbReducer(
      {
        ...databaseFixture,
        allow_ctas: true,
      },
      action,
    );

    expect(currentState).toEqual({
      ...databaseFixture,
      allow_ctas: false,
    });
  });

  test('it will add a parameter', () => {
    const action: DBReducerActionType = {
      type: ActionType.parametersChange,
      payload: { name: 'host', value: '127.0.0.1' },
    };
    const currentState = dbReducer(databaseFixture, action);

    expect(currentState).toEqual({
      ...databaseFixture,
      parameters: {
        host: '127.0.0.1',
      },
    });
  });

  test('it will add a parameter with existing parameters', () => {
    const action: DBReducerActionType = {
      type: ActionType.parametersChange,
      payload: { name: 'port', value: '1234' },
    };
    const currentState = dbReducer(
      {
        ...databaseFixture,
        parameters: {
          host: '127.0.0.1',
        },
      },
      action,
    );

    expect(currentState).toEqual({
      ...databaseFixture,
      parameters: {
        host: '127.0.0.1',
        port: '1234',
      },
    });
  });

  test('it will change a parameter with existing parameters', () => {
    const action: DBReducerActionType = {
      type: ActionType.parametersChange,
      payload: { name: 'host', value: 'localhost' },
    };
    const currentState = dbReducer(
      {
        ...databaseFixture,
        parameters: {
          host: '127.0.0.1',
        },
      },
      action,
    );

    expect(currentState).toEqual({
      ...databaseFixture,
      parameters: {
        host: 'localhost',
      },
    });
  });

  test('it will set state to payload from parametersChange with catalog', () => {
    const action: DBReducerActionType = {
      type: ActionType.parametersChange,
      payload: { name: 'name', type: 'catalog-0', value: 'bar' },
    };
    const currentState = dbReducer(
      { ...databaseFixture, catalog: [{ name: 'foo', value: 'baz' }] },
      action,
    );

    expect(currentState).toEqual({
      ...databaseFixture,
      catalog: [{ name: 'bar', value: 'baz' }],
      parameters: {
        catalog: {
          bar: 'baz',
        },
      },
    });
  });

  test('it will add a new catalog array when empty', () => {
    const action: DBReducerActionType = {
      type: ActionType.addTableCatalogSheet,
    };
    const currentState = dbReducer(databaseFixture, action);

    expect(currentState).toEqual({
      ...databaseFixture,
      catalog: [{ name: '', value: '' }],
    });
  });

  test('it will add a new catalog array when one exists', () => {
    const action: DBReducerActionType = {
      type: ActionType.addTableCatalogSheet,
    };
    const currentState = dbReducer(
      { ...databaseFixture, catalog: [{ name: 'foo', value: 'baz' }] },
      action,
    );

    expect(currentState).toEqual({
      ...databaseFixture,
      catalog: [
        { name: 'foo', value: 'baz' },
        { name: '', value: '' },
      ],
    });
  });

  test('it will remove a catalog when one exists', () => {
    const action: DBReducerActionType = {
      type: ActionType.removeTableCatalogSheet,
      payload: { indexToDelete: 0 },
    };
    const currentState = dbReducer(
      { ...databaseFixture, catalog: [{ name: 'foo', value: 'baz' }] },
      action,
    );

    expect(currentState).toEqual({
      ...databaseFixture,
      catalog: [],
    });
  });

  test('it will add db information when one is selected', () => {
    const { backend, ...db } = databaseFixture;
    const action: DBReducerActionType = {
      type: ActionType.dbSelected,
      payload: {
        engine_information: {
          supports_file_upload: true,
          disable_ssh_tunneling: false,
        },
        ...db,
        driver: db.driver,
        engine: backend,
      },
    };
    const currentState = dbReducer({}, action);

    expect(currentState).toEqual({
      database_name: db.database_name,
      engine: backend,
      configuration_method: db.configuration_method,
      engine_information: {
        supports_file_upload: true,
        disable_ssh_tunneling: false,
      },
      driver: db.driver,
      expose_in_sqllab: true,
      extra: '{"allows_virtual_table_explore":true}',
      is_managed_externally: false,
      name: 'PostgresDB',
    });
  });

  test('it will add a SSH Tunnel config parameter', () => {
    const action: DBReducerActionType = {
      type: ActionType.parametersSSHTunnelChange,
      payload: { name: 'server_address', value: '127.0.0.1' },
    };
    const currentState = dbReducer(databaseFixture, action);

    expect(currentState).toEqual({
      ...databaseFixture,
      ssh_tunnel: {
        server_address: '127.0.0.1',
      },
    });
  });

  test('it will add a SSH Tunnel config parameter with existing configs', () => {
    const action: DBReducerActionType = {
      type: ActionType.parametersSSHTunnelChange,
      payload: { name: 'server_port', value: '22' },
    };
    const currentState = dbReducer(
      {
        ...databaseFixture,
        ssh_tunnel: {
          server_address: '127.0.0.1',
        },
      },
      action,
    );

    expect(currentState).toEqual({
      ...databaseFixture,
      ssh_tunnel: {
        server_address: '127.0.0.1',
        server_port: '22',
      },
    });
  });

  test('it will change a SSH Tunnel config parameter with existing configs', () => {
    const action: DBReducerActionType = {
      type: ActionType.parametersSSHTunnelChange,
      payload: { name: 'server_address', value: 'localhost' },
    };
    const currentState = dbReducer(
      {
        ...databaseFixture,
        ssh_tunnel: {
          server_address: '127.0.0.1',
        },
      },
      action,
    );

    expect(currentState).toEqual({
      ...databaseFixture,
      ssh_tunnel: {
        server_address: 'localhost',
      },
    });
  });

  test('it will remove the SSH Tunnel config parameters', () => {
    const action: DBReducerActionType = {
      type: ActionType.removeSSHTunnelConfig,
    };
    const currentState = dbReducer(databaseFixture, action);
    expect(currentState).toEqual({
      ...databaseFixture,
      ssh_tunnel: undefined,
    });
  });
});
