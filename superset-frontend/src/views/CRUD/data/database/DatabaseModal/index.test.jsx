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
import { render, screen, within, cleanup } from 'spec/helpers/testing-library';
import { act } from 'react-dom/test-utils';
import DatabaseModal from './index';

const dbProps = {
  show: true,
  // databaseId: 10,
  database_name: 'my database',
  sqlalchemy_uri: 'postgres://superset:superset@something:1234/superset',
};

const DATABASE_FETCH_ENDPOINT = 'glob:*/api/v1/database/10';
// const DATABASE_POST_ENDPOINT = 'glob:*/api/v1/database/';
const AVAILABLE_DB_ENDPOINT = 'glob:*/api/v1/database/available*';
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
      engine: 'mysql',
      name: 'MySQL',
      preferred: true,
    },
    {
      engine: 'postgresql',
      name: 'PostgreSQL',
      preferred: false,
    },
  ],
});

describe('DatabaseModal', () => {
  async function renderAndWait() {
    const mounted = act(async () => {
      render(<DatabaseModal {...dbProps} />, {
        useRedux: true,
      });
    });

    return mounted;
  }

  async function renderAndWaitStep3() {
    const newProps = {
      ...dbProps,
      configuration_method: 'SQLALCHEMY_URI',
    };
    const mounted = act(async () => {
      render(<DatabaseModal {...newProps} hasDbConnected />, {
        useRedux: true,
      });
    });

    return mounted;
  }

  // beforeEach(async () => {
  //   await renderAndWait();
  // });

  afterEach(() => {
    cleanup();
  });

  describe('New database connection', () => {
    it('visually renders the initial load of Step 1 correctly', async () => {
      await renderAndWait();
      // ---------- Components ----------
      // <TabHeader> - AntD header
      const closeButton = screen.getByRole('button', { name: /close/i });
      const step1Header = screen.getByRole('heading', {
        name: /connect a database/i,
      });
      // <ModalHeader> - Connection header
      const step1Helper = screen.getByText(/step 1 of 3/i);
      const selectDbHeader = screen.getByRole('heading', {
        name: /select a database to connect/i,
      });
      // <IconButton> - Preferred database buttons
      const preferredDbButton = screen.getByRole('button', {
        name: /default-database mysql/i,
      });
      const preferredDbIcon = screen.getByRole('img', {
        name: /default-database/i,
      });
      const preferredDbText = within(preferredDbButton).getByText(/mysql/i);
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

      // ---------- TODO: Selector options, can't seem to get these to render properly.

      // renderAvailableSelector() => <Alert> - Supported databases alert
      const alertIcon = screen.getByRole('img', { name: /info icon/i });
      const alertMessage = screen.getByText(/want to add a new database\?/i);
      const alertDescription = screen.getByText(
        /any databases that allow connetions via sql alchemy uris can be added\. learn about how to connect a database driver \./i,
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
        preferredDbButton,
        preferredDbIcon,
        preferredDbText,
      ];

      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
    });

    it('visually renders the "Basic" tab of Step 2 correctly', async () => {
      await renderAndWait();
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /default-database mysql/i,
        }),
      );

      // ----- BEGIN STEP 2 (BASIC)
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

    it('visually renders the unexpanded "Advanced" tab of Step 2 correctly', async () => {
      await renderAndWait();
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /default-database mysql/i,
        }),
      );
      // Click the "Advanced" tab
      userEvent.click(screen.getByRole('tab', { name: /advanced/i }));

      // ----- BEGIN STEP 2 (ADVANCED)
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

    it('visually renders the "Advanced" - SQL LAB tab correctly', async () => {
      await renderAndWait();
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /default-database mysql/i,
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

      // screen.logTestingPlaygroundURL();

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
      ];

      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
    });

    it('visually renders the "Advanced" - PERFORMANCE tab correctly', async () => {
      await renderAndWait();
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /default-database mysql/i,
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

      // screen.logTestingPlaygroundURL();

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

    it('visually renders the "Advanced" - SECURITY tab correctly', async () => {
      await renderAndWait();
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /default-database mysql/i,
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

      // screen.logTestingPlaygroundURL();

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

    it('visually renders the "Advanced" - OTHER tab correctly', async () => {
      await renderAndWait();
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /default-database mysql/i,
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

      // screen.logTestingPlaygroundURL();

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

    it('Postgres form', async () => {
      fetchMock.mock(AVAILABLE_DB_ENDPOINT, {
        databases: [
          {
            engine: 'mysql',
            name: 'MySQL',
            preferred: true,
          },
          {
            engine: 'postgresql',
            name: 'PostgreSQL',
            preferred: true,
          },
        ],
      });
      await renderAndWaitStep3();
      // ---------- Components ----------
      // On step 1, click dbButton to access step 2
      userEvent.click(
        screen.getByRole('button', {
          name: /default-database postgresql/i,
        }),
      );

      screen.logTestingPlaygroundURL();
      expect.anything();
    });
  });

  // describe('create database', () => {
  //   beforeEach(() => {
  //     fetchMock.post(DATABASE_POST_ENDPOINT, {
  //       id: 10,
  //     });
  //     fetchMock.mock(AVAILABLE_DB_ENDPOINT, {
  //       databases: [
  //         {
  //           engine: 'mysql',
  //           name: 'MySQL',
  //           preferred: false,
  //         },
  //       ],
  //     });
  //   });
  //   const props = {
  //     ...dbProps,
  //     databaseId: null,
  //     database_name: null,
  //     sqlalchemy_uri: null,
  //   };
  //   it('should show a form when dynamic_form is selected', async () => {
  //     render(<DatabaseModal {...props} />, { useRedux: true });
  //     // it should have the correct header text
  //     const headerText = screen.getByText(/connect a database/i);
  //     expect(headerText).toBeVisible();

  //     await screen.findByText(/display name/i);

  //     // it does not fetch any databases if no id is passed in
  //     expect(fetchMock.calls(DATABASE_FETCH_ENDPOINT).length).toEqual(0);

  //     // todo we haven't hooked this up to load dynamically yet so
  //     // we can't currently test it
  //   });
  //   it('should close the modal on save if using the sqlalchemy form', async () => {
  //     const onHideMock = jest.fn();
  //     render(<DatabaseModal {...props} onHide={onHideMock} />, {
  //       useRedux: true,
  //     });
  //     // button should be disabled by default
  //     const submitButton = screen.getByTestId('modal-confirm-button');
  //     expect(submitButton).toBeDisabled();

  //     const displayName = screen.getByTestId('database-name-input');
  //     userEvent.type(displayName, 'MyTestDB');
  //     expect(displayName.value).toBe('MyTestDB');
  //     const sqlalchemyInput = screen.getByTestId('sqlalchemy-uri-input');
  //     userEvent.type(sqlalchemyInput, 'some_url');
  //     expect(sqlalchemyInput.value).toBe('some_url');

  //     // button should not be disabled now
  //     expect(submitButton).toBeEnabled();

  //     await waitFor(() => {
  //       userEvent.click(submitButton);
  //     });
  //     expect(fetchMock.calls(DATABASE_POST_ENDPOINT)).toHaveLength(1);
  //     expect(onHideMock).toHaveBeenCalled();
  //   });
  // });

  // describe('edit database', () => {
  //   beforeEach(() => {
  //     fetchMock.mock(AVAILABLE_DB_ENDPOINT, {
  //       databases: [
  //         {
  //           engine: 'mysql',
  //           name: 'MySQL',
  //           preferred: false,
  //         },
  //       ],
  //     });
  //   });
  //   it('renders the sqlalchemy form when the sqlalchemy_form configuration method is set', async () => {
  //     render(<DatabaseModal {...dbProps} />, { useRedux: true });

  //     // it should have tabs
  //     const tabs = screen.getAllByRole('tab');
  //     expect(tabs.length).toEqual(2);
  //     expect(tabs[0]).toHaveTextContent('Basic');
  //     expect(tabs[1]).toHaveTextContent('Advanced');

  //     // it should have the correct header text
  //     const headerText = screen.getByText(/edit database/i);
  //     expect(headerText).toBeVisible();
  //   });
  // it('renders the dynamic form when the dynamic_form configuration method is set', async () => {
  //   fetchMock.get(DATABASE_FETCH_ENDPOINT, {
  //     result: {
  //       id: 10,
  //       database_name: 'my database',
  //       expose_in_sqllab: false,
  //       allow_ctas: false,
  //       allow_cvas: false,
  //       configuration_method: 'dynamic_form',
  //       parameters: {
  //         database: 'mydatabase',
  //       },
  //     },
  //   });
  //   render(<DatabaseModal {...dbProps} />, { useRedux: true });

  //   await screen.findByText(/edit database/i);

  //   // // it should have tabs
  //   const tabs = screen.getAllByRole('tab');
  //   expect(tabs.length).toEqual(2);

  //   // it should show a TODO for now
  //   const headerText = screen.getByText(/edit database/i);
  //   expect(headerText).toBeVisible();
  // });
  // });
});
