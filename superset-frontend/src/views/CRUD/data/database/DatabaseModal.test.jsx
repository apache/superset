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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import * as redux from 'react-redux';
import { styledMount as mount } from 'spec/helpers/theming';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import DatabaseModal from 'src/views/CRUD/data/database/DatabaseModal';
import Modal from 'src/components/Modal';
import Tabs from 'src/components/Tabs';
import fetchMock from 'fetch-mock';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { initialState } from 'spec/javascripts/sqllab/fixtures';

// store needed for withToasts(DatabaseModal)
const mockStore = configureStore([thunk]);
const store = mockStore({});
const mockedProps = {
  show: true,
};
const dbProps = {
  show: true,
  database: {
    id: 10,
    database_name: 'test',
    sqlalchemy_uri: 'sqllite:///user:pw/test',
    expose_in_sqllab: true,
  },
};

const DATABASE_ENDPOINT = 'glob:*/api/v1/database/*';
fetchMock.get(DATABASE_ENDPOINT, {});

describe('DatabaseModal', () => {
  describe('enzyme', () => {
    let wrapper;
    let spyOnUseSelector;
    beforeAll(() => {
      spyOnUseSelector = jest.spyOn(redux, 'useSelector');
      spyOnUseSelector.mockReturnValue(initialState.common.conf);
    });
    beforeEach(() => {
      wrapper = mount(
        <Provider store={store}>
          <DatabaseModal store={store} {...mockedProps} />
        </Provider>,
      );
    });
    afterEach(() => {
      wrapper.unmount();
    });
    it('renders', () => {
      expect(wrapper.find(DatabaseModal)).toExist();
    });
    it('renders a Modal', () => {
      expect(wrapper.find(Modal)).toExist();
    });
    it('renders "Add database" header when no database is included', () => {
      expect(wrapper.find('h4').text()).toEqual('Add database');
    });
    it('renders "Edit database" header when database prop is included', () => {
      const editWrapper = mount(<DatabaseModal store={store} {...dbProps} />);
      waitForComponentToPaint(editWrapper);
      expect(editWrapper.find('h4').text()).toEqual('Edit database');
      editWrapper.unmount();
    });
    it('renders a Tabs menu', () => {
      expect(wrapper.find(Tabs)).toExist();
    });
    it('renders two TabPanes', () => {
      expect(wrapper.find('.ant-tabs-tab')).toExist();
      expect(wrapper.find('.ant-tabs-tab')).toHaveLength(2);
    });
    it('renders input elements for Connection section', () => {
      expect(wrapper.find('input[name="database_name"]')).toExist();
      expect(wrapper.find('input[name="sqlalchemy_uri"]')).toExist();
    });
  });

  describe('RTL', () => {
    describe('initial load', () => {
      it('renders DatabaseModal correctly with Basic tab selected', () => {
        render(<DatabaseModal {...dbProps} />, { useRedux: true });

        // Grab all elements on the Basic tab of the DatabaseModal
        const closeButton = screen.getByRole('button', { name: /close/i });
        const editHeading = screen.getByRole('heading', {
          name: /edit database/i,
        });
        const basicTab = screen.getByRole('tab', { name: /basic/i });
        const advancedTab = screen.getByRole('tab', { name: /advanced/i });
        const displayNameLabel = screen.getByText(/display name/i);
        const displayNameTextbox = screen.getByTestId('database-name-test');
        const displayNameHelperText = screen.getByText(
          /pick a name to help you identify this database\./i,
        );
        const sqlalchemyUriLabel = screen.getByText(/sqlalchemy uri/i);
        const sqlalchemyUriTextbox = screen.getByTestId('sqlalchemy-uri-test');
        const sqlalchemyUriHelperText = screen.getByText(
          /refer to the for more information on how to structure your uri\./i,
        );
        const testConnectionButton = screen.getByRole('button', {
          name: /test connection/i,
        });
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        const saveButton = screen.getByRole('button', { name: /save/i });

        // Assert that all elements are rendered
        expect(closeButton).toBeVisible();
        expect(editHeading).toBeVisible();

        expect(basicTab).toBeVisible();
        expect(advancedTab).toBeVisible();

        expect(displayNameLabel).toBeVisible();
        expect(displayNameTextbox).toBeVisible();
        expect(displayNameHelperText).toBeVisible();
        expect(sqlalchemyUriLabel).toBeVisible();
        expect(sqlalchemyUriTextbox).toBeVisible();
        expect(sqlalchemyUriHelperText).toBeVisible();
        expect(testConnectionButton).toBeVisible();

        expect(cancelButton).toBeVisible();
        expect(saveButton).toBeVisible();
      });

      it('renders DatabaseModal correctly with Advanced tab selected', () => {
        render(<DatabaseModal {...dbProps} />, { useRedux: true });

        // Grab Advanced tab button and click to reveal Advanced tab
        const advancedTab = screen.getByRole('tab', { name: /advanced/i });
        userEvent.click(advancedTab);

        // Grab all elements on the Advanced tab of the DatabaseModal
        const closeButton = screen.getByRole('button', { name: /close/i });
        const editHeading = screen.getByRole('heading', {
          name: /edit database/i,
        });
        const basicTab = screen.getByRole('tab', { name: /basic/i });
        const sqlLabTab = screen.getByRole('tab', {
          name: /right sql lab configure how this database will function in sql lab\./i,
        });
        const performanceTab = screen.getByRole('tab', {
          name: /right performance adjust settings that will impact the performance of this database\./i,
        });
        const securityTab = screen.getByRole('tab', {
          name: /right security add connection information for other systems\./i,
        });
        const otherTab = screen.getByRole('tab', {
          name: /right other additional settings\./i,
        });
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        const saveButton = screen.getByRole('button', { name: /save/i });

        // Assert that all elements are rendered
        expect(closeButton).toBeVisible();
        expect(editHeading).toBeVisible();

        expect(basicTab).toBeVisible();
        expect(advancedTab).toBeVisible();

        expect(sqlLabTab).toBeVisible();
        expect(performanceTab).toBeVisible();
        expect(securityTab).toBeVisible();
        expect(otherTab).toBeVisible();

        expect(cancelButton).toBeVisible();
        expect(saveButton).toBeVisible();
      });

      it('renders DatabaseModal correctly with Advanced tab > SQL Lab tab selected', () => {
        render(<DatabaseModal {...dbProps} />, { useRedux: true });

        // Grab Advanced tab button and click to reveal Advanced tab
        const advancedTab = screen.getByRole('tab', { name: /advanced/i });
        userEvent.click(advancedTab);

        // Grab SQL Lab tab button and click to reveal SQL Lab tab
        const sqlLabTab = screen.getByRole('tab', {
          name: /right sql lab configure how this database will function in sql lab\./i,
        });
        userEvent.click(sqlLabTab);

        // Grab all elements on the SQL Lab tab
        const closeButton = screen.getByRole('button', { name: /close/i });
        const editHeading = screen.getByRole('heading', {
          name: /edit database/i,
        });
        const basicTab = screen.getByRole('tab', { name: /basic/i });
        const exposeInSqlLabCheckbox = screen.getByRole('checkbox', {
          name: /expose in sql lab/i,
        }).parentElement;
        const exposeInSqlLabText = screen.getByText(/expose in sql lab/i);
        const allowCTASCheckbox = screen.getByRole('checkbox', {
          name: /allow create table as/i,
        }).parentElement;
        const allowCTASText = screen.getByText(/allow create table as/i);
        const allowCVASCheckbox = screen.getByRole('checkbox', {
          name: /allow create view as/i,
        }).parentElement;
        const allowCVASText = screen.getByText(/allow create view as/i);
        const schemaField = screen.getByText('CTAS & CVAS SCHEMA')
          .parentElement;
        const schemaFieldHelperText = screen.getByText(
          /when allowing create table as option in sql lab, this option forces the table to be created in this schema\./i,
        );
        const allowDmlCheckbox = screen.getByRole('checkbox', {
          name: /allow dml/i,
        }).parentElement;
        const allowDmlText = screen.getByText(/allow dml/i);
        const allowMultiSchemaMdFetchCheckbox = screen.getByRole('checkbox', {
          name: /allow multi schema metadata fetch/i,
        }).parentElement;
        const allowMultiSchemaMdFetchText = screen.getByText(
          /allow multi schema metadata fetch/i,
        );
        const enableQueryCostCheckbox = screen.getByRole('checkbox', {
          name: /enable query cost estimation/i,
        }).parentElement;
        const enableQueryCostLabel = screen.getByText(
          /enable query cost estimation/i,
        );
        const allowDbExploreCheckbox = screen.getByRole('checkbox', {
          name: /allow this database to be explored/i,
        }).parentElement;
        const allowDbExploreText = screen.getByText(
          /allow this database to be explored/i,
        );
        const performanceTab = screen.getByRole('tab', {
          name: /right performance adjust settings that will impact the performance of this database\./i,
        });
        const securityTab = screen.getByRole('tab', {
          name: /right security add connection information for other systems\./i,
        });
        const otherTab = screen.getByRole('tab', {
          name: /right other additional settings\./i,
        });
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        const saveButton = screen.getByRole('button', { name: /save/i });

        // Assert that all elements are rendered
        expect(closeButton).toBeVisible();
        expect(editHeading).toBeVisible();

        expect(basicTab).toBeVisible();
        expect(advancedTab).toBeVisible();
        expect(sqlLabTab).toBeVisible();

        expect(exposeInSqlLabCheckbox).toBeVisible();
        expect(exposeInSqlLabText).toBeVisible();
        expect(allowCTASCheckbox).toBeVisible();
        expect(allowCTASText).toBeVisible();
        expect(allowCVASCheckbox).toBeVisible();
        expect(allowCVASText).toBeVisible();
        // Assert that schemaField is not visible
        expect(schemaField).not.toHaveClass('open');
        expect(schemaFieldHelperText).toBeVisible();
        expect(allowDmlCheckbox).toBeVisible();
        expect(allowDmlText).toBeVisible();
        expect(allowMultiSchemaMdFetchCheckbox).toBeVisible();
        expect(allowMultiSchemaMdFetchText).toBeVisible();
        expect(enableQueryCostCheckbox).toBeVisible();
        expect(enableQueryCostLabel).toBeVisible();
        expect(allowDbExploreCheckbox).toBeVisible();
        expect(allowDbExploreText).toBeVisible();

        expect(performanceTab).toBeVisible();
        expect(securityTab).toBeVisible();
        expect(otherTab).toBeVisible();

        expect(cancelButton).toBeVisible();
        expect(saveButton).toBeVisible();
      });

      it('renders DatabaseModal correctly with Advanced tab > Performance tab selected', () => {
        render(<DatabaseModal {...dbProps} />, { useRedux: true });

        // Grab Advanced tab button and click to reveal Advanced tab
        const advancedTab = screen.getByRole('tab', { name: /advanced/i });
        userEvent.click(advancedTab);

        // Grab Performance tab button and click to reveal Performance tab
        const performanceTab = screen.getByRole('tab', {
          name: /right performance adjust settings that will impact the performance of this database\./i,
        });
        userEvent.click(performanceTab);

        // Grab all elements on the Performance tab
        const closeButton = screen.getByRole('button', { name: /close/i });
        const editHeading = screen.getByRole('heading', {
          name: /edit database/i,
        });
        const basicTab = screen.getByRole('tab', { name: /basic/i });
        const sqlLabTab = screen.getByRole('tab', {
          name: /right sql lab configure how this database will function in sql lab\./i,
        });
        const cacheTimeoutLabel = screen.getByText(/chart cache timeout/i);
        const cacheTimeoutSpinbox = screen.getByTestId('cache-timeout-test');
        const cacheTimeoutHelperText = screen.getByText(
          /duration \(in seconds\) of the caching timeout for charts of this database\. a timeout of 0 indicates that the cache never expires\. note this defaults to the global timeout if undefined\./i,
        );
        const mdCacheTimeoutLabel = screen.getByText(/metadata cache timeout/i);
        const mdCacheTimeoutSpinbutton = screen.getByTestId(
          'metadata-cache-timeout-test',
        );
        const mdCacheTimeoutHelperText = screen.getByText(
          /the metadata_cache_timeout is a cache timeout setting in seconds for metadata fetch of this database\. specify it as "metadata_cache_timeout": \{"schema_cache_timeout": 600, "table_cache_timeout": 600\}\. if unset, cache will not be enabled for the functionality\. a timeout of 0 indicates that the cache never expires\./i,
        );
        const asyncQueryExecutionCheckbox = screen.getByRole('checkbox', {
          name: /asynchronous query execution/i,
        }).parentElement;
        const asyncQueryExecutionLabel = screen.getByText(
          /asynchronous query execution/i,
        );
        const securityTab = screen.getByRole('tab', {
          name: /right security add connection information for other systems\./i,
        });
        const otherTab = screen.getByRole('tab', {
          name: /right other additional settings\./i,
        });
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        const saveButton = screen.getByRole('button', { name: /save/i });

        // Assert that all elements are rendered
        expect(closeButton).toBeVisible();
        expect(editHeading).toBeVisible();

        expect(basicTab).toBeVisible();
        expect(advancedTab).toBeVisible();
        expect(sqlLabTab).toBeVisible();
        expect(performanceTab).toBeVisible();

        expect(cacheTimeoutLabel).toBeVisible();
        expect(cacheTimeoutSpinbox).toBeVisible();
        expect(cacheTimeoutHelperText).toBeVisible();
        expect(mdCacheTimeoutLabel).toBeVisible();
        expect(mdCacheTimeoutSpinbutton).toBeVisible();
        expect(mdCacheTimeoutHelperText).toBeVisible();
        expect(asyncQueryExecutionCheckbox).toBeVisible();
        expect(asyncQueryExecutionLabel).toBeVisible();

        expect(securityTab).toBeVisible();
        expect(otherTab).toBeVisible();

        expect(cancelButton).toBeVisible();
        expect(saveButton).toBeVisible();
      });

      it('renders DatabaseModal correctly with Advanced tab > Security selected', () => {
        render(<DatabaseModal {...dbProps} />, { useRedux: true });

        // Grab Advanced tab button and click to reveal Advanced tab
        const advancedTab = screen.getByRole('tab', { name: /advanced/i });
        userEvent.click(advancedTab);

        // Grab Security tab button and click to reveal Security tab
        const securityTab = screen.getByRole('tab', {
          name: /right security add connection information for other systems\./i,
        });
        userEvent.click(securityTab);

        // Grab all elements on the Advanced tab of the DatabaseModal
        const closeButton = screen.getByRole('button', { name: /close/i });
        const editHeading = screen.getByRole('heading', {
          name: /edit database/i,
        });
        const basicTab = screen.getByRole('tab', { name: /basic/i });
        const sqlLabTab = screen.getByRole('tab', {
          name: /right sql lab configure how this database will function in sql lab\./i,
        });
        const performanceTab = screen.getByRole('tab', {
          name: /right performance adjust settings that will impact the performance of this database\./i,
        });
        const secureExtraLabel = screen.getByText(/secure extra/i);
        const secureExtraEditor = screen.getByTestId(
          'secure-extra-editor-test',
        );
        const secureExtraHelperText1 = screen.getByText(
          /json string containing additional connection configuration\./i,
        );
        const secureExtraHelperText2 = screen.getByText(
          /this is used to provide connection information for systems like hive, presto, and bigquery, which do not conform to the username:password syntax normally used by sqlalchemy\./i,
        );
        const rootCertificateLabel = screen.getByText(/root certificate/i);
        const rootCertificateTextbox = screen.getByTestId(
          'root-certificate-test',
        );
        const rootCertificateHelperText = screen.getByText(
          /optional ca_bundle contents to validate https requests\. only available on certain database engines\./i,
        );
        const schemaAllowedLabel = screen.getByText(
          /schemas allowed for csv upload/i,
        );
        const schemaAllowedTextbox = screen.getByTestId(
          'root-certificate-test',
        );
        const schemaAllowedHelperText = screen.getByText(
          /a list of schemas that csvs are allowed to upload to\./i,
        );
        const impersonateUserCheckbox = screen.getByRole('checkbox', {
          name: /impersonate logged in user \(presto & hive\)/i,
        }).parentElement;
        const impersonateUserLabel = screen.getByText(
          /impersonate logged in user \(presto & hive\)/i,
        );
        const allowDataUploadCheckbox = screen.getByRole('checkbox', {
          name: /allow data upload/i,
        }).parentElement;
        const allowDataUploadLabel = screen.getByText(/allow data upload/i);
        const otherTab = screen.getByRole('tab', {
          name: /right other additional settings\./i,
        });
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        const saveButton = screen.getByRole('button', { name: /save/i });

        // Assert that all elements are rendered
        expect(closeButton).toBeVisible();
        expect(editHeading).toBeVisible();

        expect(basicTab).toBeVisible();
        expect(advancedTab).toBeVisible();

        expect(sqlLabTab).toBeVisible();
        expect(performanceTab).toBeVisible();
        expect(securityTab).toBeVisible();

        expect(secureExtraEditor).toBeVisible();
        expect(secureExtraLabel).toBeVisible();
        expect(secureExtraHelperText1).toBeVisible();
        expect(secureExtraHelperText2).toBeVisible();
        expect(rootCertificateLabel).toBeVisible();
        expect(rootCertificateTextbox).toBeVisible();
        expect(rootCertificateHelperText).toBeVisible();
        expect(schemaAllowedLabel).toBeVisible();
        expect(schemaAllowedTextbox).toBeVisible();
        expect(schemaAllowedHelperText).toBeVisible();
        expect(impersonateUserCheckbox).toBeVisible();
        expect(impersonateUserLabel).toBeVisible();
        expect(allowDataUploadCheckbox).toBeVisible();
        expect(allowDataUploadLabel).toBeVisible();

        expect(otherTab).toBeVisible();

        expect(cancelButton).toBeVisible();
        expect(saveButton).toBeVisible();
      });

      it('renders DatabaseModal correctly with Advanced tab > Other selected', () => {
        render(<DatabaseModal {...dbProps} />, { useRedux: true });

        // Grab Advanced tab button and click to reveal Advanced tab
        const advancedTab = screen.getByRole('tab', { name: /advanced/i });
        userEvent.click(advancedTab);

        // Grab Other tab button and click to reveal Other tab
        const otherTab = screen.getByRole('tab', {
          name: /right other additional settings\./i,
        });
        userEvent.click(otherTab);

        // Grab all elements on the Advanced tab of the DatabaseModal
        const closeButton = screen.getByRole('button', { name: /close/i });
        const editHeading = screen.getByRole('heading', {
          name: /edit database/i,
        });
        const basicTab = screen.getByRole('tab', { name: /basic/i });
        const sqlLabTab = screen.getByRole('tab', {
          name: /right sql lab configure how this database will function in sql lab\./i,
        });
        const performanceTab = screen.getByRole('tab', {
          name: /right performance adjust settings that will impact the performance of this database\./i,
        });
        const securityTab = screen.getByRole('tab', {
          name: /right security add connection information for other systems\./i,
        });
        const extraEditorLabel = screen.getByTestId('extra-editor-label-test');
        const extraEditor = screen.getByTestId('extra-editor-test');
        const extraEditorHelperText1 = screen.getByText(
          /json string containing extra configuration elements\./i,
        );
        const extraEditorHelperText2 = screen.getByText(
          /the engine_params object gets unpacked into the sqlalchemy\.create_engine call, while the metadata_params gets unpacked into the sqlalchemy\.metadata call\./i,
        );
        const versionLabel = screen.getByTestId('version-label-test');
        const versionSpinbutton = screen.getByTestId('version-spinbutton-test');
        const versionHelperText = screen.getByText(
          /specify this database’s version\. this should be used with presto databases so that the syntax is correct\./i,
        );
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        const saveButton = screen.getByRole('button', { name: /save/i });

        // Assert that all elements are rendered
        expect(closeButton).toBeVisible();
        expect(editHeading).toBeVisible();

        expect(basicTab).toBeVisible();
        expect(advancedTab).toBeVisible();

        expect(sqlLabTab).toBeVisible();
        expect(performanceTab).toBeVisible();
        expect(securityTab).toBeVisible();
        expect(otherTab).toBeVisible();

        expect(extraEditorLabel).toBeVisible();
        expect(extraEditor).toBeVisible();
        expect(extraEditorHelperText1).toBeVisible();
        expect(extraEditorHelperText2).toBeVisible();
        expect(versionLabel).toBeVisible();
        expect(versionSpinbutton).toBeVisible();
        expect(versionHelperText).toBeVisible();

        expect(cancelButton).toBeVisible();
        expect(saveButton).toBeVisible();
      });

      it('hides the forms from the db when not selected', () => {
        render(
          <DatabaseModal
            show
            database={{
              expose_in_sqllab: false,
              allow_ctas: false,
              allow_cvas: false,
            }}
          />,
          { useRedux: true },
        );
        // Select Advanced tab
        const advancedTab = screen.getByRole('tab', {
          name: /advanced/i,
        });
        userEvent.click(advancedTab);
        // Select SQL Lab tab
        const sqlLabSettingsTab = screen.getByRole('tab', {
          name: /sql lab/i,
        });
        userEvent.click(sqlLabSettingsTab);

        const exposeInSqlLab = screen.getByText('Expose in SQL Lab');
        const exposeChoicesForm = exposeInSqlLab.parentElement.nextSibling;
        const schemaField = screen.getByText('CTAS & CVAS SCHEMA')
          .parentElement;
        expect(exposeChoicesForm).not.toHaveClass('open');
        expect(schemaField).not.toHaveClass('open');
      });
    });

    it('renders all settings when "Expose in SQL Lab" is checked', () => {
      render(<DatabaseModal {...dbProps} />, { useRedux: true });

      // Select Advanced tab
      const advancedTab = screen.getByRole('tab', {
        name: /advanced/i,
      });
      userEvent.click(advancedTab);

      // Select SQL Lab tab
      const sqlLabSettingsTab = screen.getByRole('tab', {
        name: /sql lab/i,
      });

      userEvent.click(sqlLabSettingsTab);

      // Grab all SQL Lab settings by their labels
      // const exposeInSqlLab = screen.getByText('Expose in SQL Lab');
      const exposeInSqlLab = screen.getByRole('checkbox', {
        name: /expose in sql lab/i,
      });

      // While 'Expose in SQL Lab' is checked, all settings should display
      expect(exposeInSqlLab).not.toBeChecked();

      // When clicked, "Expose in SQL Lab" becomes unchecked
      userEvent.click(exposeInSqlLab);

      // While checked make sure all checkboxes are showing
      expect(exposeInSqlLab).toBeChecked();
      const checkboxes = screen
        .getAllByRole('checkbox')
        .filter(checkbox => !checkbox.checked);

      expect(checkboxes.length).toEqual(6);
    });

    it('renders the schema field when allowCTAS is checked', () => {
      render(<DatabaseModal {...dbProps} />, { useRedux: true });

      // Select Advanced tab
      const advancedTab = screen.getByRole('tab', {
        name: /advanced/i,
      });
      userEvent.click(advancedTab);

      // Select SQL Lab tab
      const sqlLabSettingsTab = screen.getByRole('tab', {
        name: /sql lab/i,
      });
      userEvent.click(sqlLabSettingsTab);
      // Grab CTAS & schema field by their labels
      const allowCTAS = screen.getByLabelText('Allow CREATE TABLE AS');
      const schemaField = screen.getByText('CTAS & CVAS SCHEMA').parentElement;

      // While CTAS & CVAS are unchecked, schema field is not visible
      expect(schemaField).not.toHaveClass('open');

      // Check "Allow CTAS" to reveal schema field
      userEvent.click(allowCTAS);
      expect(schemaField).toHaveClass('open');

      // Uncheck "Allow CTAS" to hide schema field again
      userEvent.click(allowCTAS);
      expect(schemaField).not.toHaveClass('open');
    });

    it('renders the schema field when allowCVAS is checked', () => {
      render(<DatabaseModal {...dbProps} />, { useRedux: true });

      // Select Advanced tab
      const advancedTab = screen.getByRole('tab', {
        name: /advanced/i,
      });
      userEvent.click(advancedTab);

      // Select SQL Lab tab
      const sqlLabSettingsTab = screen.getByRole('tab', {
        name: /sql lab/i,
      });
      userEvent.click(sqlLabSettingsTab);
      // Grab CVAS by it's label & schema field
      const allowCVAS = screen.getByText('Allow CREATE VIEW AS');
      const schemaField = screen.getByText('CTAS & CVAS SCHEMA').parentElement;

      // While CTAS & CVAS are unchecked, schema field is not visible
      expect(schemaField).not.toHaveClass('open');

      // Check "Allow CVAS" to reveal schema field
      userEvent.click(allowCVAS);
      expect(schemaField).toHaveClass('open');

      // Uncheck "Allow CVAS" to hide schema field again
      userEvent.click(allowCVAS);
      expect(schemaField).not.toHaveClass('open');
    });

    it('renders the schema field when both allowCTAS and allowCVAS are checked', () => {
      render(<DatabaseModal {...dbProps} />, { useRedux: true });

      // Select Advanced tab
      const advancedTab = screen.getByRole('tab', {
        name: /advanced/i,
      });
      userEvent.click(advancedTab);

      // Select SQL Lab tab
      const sqlLabSettingsTab = screen.getByRole('tab', {
        name: /sql lab/i,
      });
      userEvent.click(sqlLabSettingsTab);
      // Grab CTAS and CVAS by their labels, & schema field
      const allowCTAS = screen.getByText('Allow CREATE TABLE AS');
      const allowCVAS = screen.getByText('Allow CREATE VIEW AS');
      const schemaField = screen.getByText('CTAS & CVAS SCHEMA').parentElement;

      // While CTAS & CVAS are unchecked, schema field is not visible
      expect(schemaField).not.toHaveClass('open');

      // Check both "Allow CTAS" and "Allow CVAS" to reveal schema field
      userEvent.click(allowCTAS);
      userEvent.click(allowCVAS);
      expect(schemaField).toHaveClass('open');
      // Uncheck both "Allow CTAS" and "Allow CVAS" to hide schema field again
      userEvent.click(allowCTAS);
      userEvent.click(allowCVAS);

      // Both checkboxes go unchecked, so the field should no longer render
      expect(schemaField).not.toHaveClass('open');
    });
  });
});
