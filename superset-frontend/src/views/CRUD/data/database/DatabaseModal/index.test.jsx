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
} from 'spec/helpers/testing-library';
/* -- These imports are used for the mock functions that currently don't work
import {
  testDatabaseConnection,
  useSingleViewResource,
} from 'src/views/CRUD/hooks'; */
import DatabaseModal from './index';

const dbProps = {
  show: true,
  database_name: 'my database',
  sqlalchemy_uri: 'postgres://superset:superset@something:1234/superset',
};

const DATABASE_FETCH_ENDPOINT = 'glob:*/api/v1/database/10';
// const DATABASE_POST_ENDPOINT = 'glob:*/api/v1/database/';
const AVAILABLE_DB_ENDPOINT = 'glob:*/api/v1/database/available*';
const VALIDATE_PARAMS_ENDPOINT = 'glob:*/api/v1/database/validate_parameters*';

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
    },
    {
      available_drivers: ['rest'],
      engine: 'presto',
      name: 'Presto',
      preferred: true,
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
    },
    {
      available_drivers: ['pysqlite'],
      engine: 'sqlite',
      name: 'SQLite',
      preferred: true,
    },
    {
      available_drivers: ['rest'],
      engine: 'druid',
      name: 'Apache Druid',
      preferred: false,
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

  describe('Visual: New database connection', () => {
    it('renders the initial load of Step 1 correctly', async () => {
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
      // All dbs render with this icon in this testing environment,
      // The Icon count should equal the count of databases rendered
      const preferredDbIcon = screen.getAllByRole('img', {
        name: /default-icon/i,
      });
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
        preferredDbIcon[0],
        preferredDbIcon[1],
        preferredDbIcon[2],
        preferredDbIcon[3],
        preferredDbTextPostgreSQL,
        preferredDbTextPresto,
        preferredDbTextMySQL,
        preferredDbTextSQLite,
      ];

      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
      // This is how many preferred databases are rendered
      expect(preferredDbIcon).toHaveLength(4);
    });

    it('renders the "Basic" tab of SQL Alchemy form (step 2 of 2) correctly', async () => {
      // On step 1, click dbButton to access SQL Alchemy form
      userEvent.click(
        screen.getByRole('button', {
          name: /sqlite/i,
        }),
      );

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

    it('renders the unexpanded "Advanced" tab correctly', async () => {
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /sqlite/i,
        }),
      );
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

    it('renders the "Advanced" - SQL LAB tab correctly (unexpanded)', async () => {
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
      const allowMultiSchemaMDFetchCheckbox = screen.getByRole('checkbox', {
        name: /allow multi schema metadata fetch/i,
      });
      const allowMultiSchemaMDFetchText = screen.getByText(
        /allow multi schema metadata fetch/i,
      );
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
        checkboxOffSVGs[5],
        checkboxOffSVGs[6],
        checkboxOffSVGs[7],
        tooltipIcons[0],
        tooltipIcons[1],
        tooltipIcons[2],
        tooltipIcons[3],
        tooltipIcons[4],
        tooltipIcons[5],
        tooltipIcons[6],
        tooltipIcons[7],
        exposeInSQLLabText,
        allowCTASText,
        allowCVASText,
        CTASCVASLabelText,
        CTASCVASInput,
        CTASCVASHelperText,
        allowDMLText,
        allowMultiSchemaMDFetchText,
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
        allowMultiSchemaMDFetchCheckbox,
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
      expect(checkboxOffSVGs).toHaveLength(8);
      expect(tooltipIcons).toHaveLength(8);
    });

    it('renders the "Advanced" - PERFORMANCE tab correctly', async () => {
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

    it('renders the "Advanced" - SECURITY tab correctly', async () => {
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
      ];

      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
    });

    it('renders the "Advanced" - OTHER tab correctly', async () => {
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

    it('Dynamic form', async () => {
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /postgresql/i,
        }),
      );

      expect.anything();
    });
  });

  describe('Functional: Create new database', () => {
    it('directs databases to the appropriate form (dynamic vs. SQL Alchemy)', () => {
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
      const sqlAlchemyFormStepText = screen.getByText(/step 2 of 2/i);

      expect(sqlAlchemyFormStepText).toBeVisible();
    });

    describe('SQL Alchemy form flow', () => {
      beforeEach(() => {
        userEvent.click(
          screen.getByRole('button', {
            name: /sqlite/i,
          }),
        );
      });

      it('enters step 2 of 2 when proper database is selected', () => {
        const step2text = screen.getByText(/step 2 of 2/i);
        expect(step2text).toBeVisible();
      });

      it('runs fetchResource when "Connect" is clicked', () => {
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
        it('properly interacts with textboxes', () => {
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

        it('runs testDatabaseConnection when "TEST CONNECTION" is clicked', () => {
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
    });

    describe('Dynamic form flow', () => {
      beforeEach(() => {
        userEvent.click(
          screen.getByRole('button', {
            name: /postgresql/i,
          }),
        );
      });

      it('enters step 2 of 3 when proper database is selected', () => {
        const step2of3text = screen.getByText(/step 2 of 3/i);
        expect(step2of3text).toBeVisible();
      });

      it('enters form credentials and runs fetchResource when "Connect" is clicked', () => {
        const textboxes = screen.getAllByRole('textbox');
        const hostField = textboxes[0];
        const portField = screen.getByRole('spinbutton');
        const databaseNameField = textboxes[1];
        const usernameField = textboxes[2];
        const passwordField = textboxes[3];

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

        expect(hostField).toHaveValue('localhost');
        expect(portField).toHaveValue(5432);
        expect(databaseNameField).toHaveValue('postgres');
        expect(usernameField).toHaveValue('testdb');
        expect(passwordField).toHaveValue('demoPassword');

        /* ---------- 🐞 TODO (lyndsiWilliams): function mock is not currently working 🐞 ----------

        // Mock useSingleViewResource
        const mockUseSingleViewResource = jest.fn();
        mockUseSingleViewResource.mockImplementation(useSingleViewResource);

        const { fetchResource } = mockUseSingleViewResource('database');

        // Invalid hook call?
        userEvent.click(screen.getByRole('button', { name: 'Connect' }));
        expect(fetchResource).toHaveBeenCalled();

        */
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

    it('enters step 2 of 3 when proper database is selected', () => {
      const step2of3text = screen.getByText(/step 2 of 3/i);
      expect(step2of3text).toBeVisible();
    });
  });
});
