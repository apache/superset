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
import { styledMount as mount } from 'spec/helpers/theming';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { Provider } from 'react-redux';
import DatabaseModal from 'src/views/CRUD/data/database/DatabaseModal';
import Modal from 'src/common/components/Modal';
import Tabs from 'src/common/components/Tabs';
import fetchMock from 'fetch-mock';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';

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
  },
};
const DATABASE_ENDPOINT = 'glob:*/api/v1/database/*';
fetchMock.get(DATABASE_ENDPOINT, {});

describe('DatabaseModal', () => {
  describe('enzyme', () => {
    let wrapper;
    beforeEach(() => {
      wrapper = mount(<DatabaseModal store={store} {...mockedProps} />);
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
    it('renders five TabPanes', () => {
      expect(wrapper.find(Tabs.TabPane)).toExist();
      expect(wrapper.find(Tabs.TabPane)).toHaveLength(5);
    });
    it('renders input elements for Connection section', () => {
      expect(wrapper.find('input[name="database_name"]')).toExist();
      expect(wrapper.find('input[name="sqlalchemy_uri"]')).toExist();
    });
  });

  describe('RTL', () => {
    it('renders solely "Expose in SQL Lab" option when unchecked', () => {
      render(
        <ThemeProvider theme={supersetTheme}>
          <Provider store={store}>
            <DatabaseModal {...dbProps} />
          </Provider>
        </ThemeProvider>,
      );

      // Select SQL Lab settings tab
      const sqlLabSettingsTab = screen.getByRole('tab', {
        name: /sql lab settings/i,
      });
      userEvent.click(sqlLabSettingsTab);
      // Grab all SQL Lab Settings by their labels
      const exposeInSqlLab = screen.getByText('Expose in SQL Lab');
      const allowCTAS = screen.getByText('Allow CREATE TABLE AS');
      const allowCVAS = screen.getByText('Allow CREATE VIEW AS');
      const allowDML = screen.getByText('Allow DML');
      const allowMSMF = screen.getByText('Allow multi schema metadata fetch');

      // While 'Expose in SQL Lab' is checked, all settings should display
      expect(exposeInSqlLab).toBeVisible();
      expect(allowCTAS).toBeVisible();
      expect(allowCVAS).toBeVisible();
      expect(allowDML).toBeVisible();
      expect(allowMSMF).toBeVisible();

      // When clicked, "Expose in SQL Lab" becomes unchecked
      userEvent.click(exposeInSqlLab);
      // While unchecked, only "Expose in SQL Lab" should display
      expect(exposeInSqlLab).toBeVisible();
      expect(allowCTAS).not.toBeVisible();
      expect(allowCVAS).not.toBeVisible();
      expect(allowDML).not.toBeVisible();
      expect(allowMSMF).not.toBeVisible();
    });

    it('renders the schema field when allowCTAS is checked', () => {
      render(
        <ThemeProvider theme={supersetTheme}>
          <Provider store={store}>
            <DatabaseModal {...dbProps} />
          </Provider>
        </ThemeProvider>,
      );

      // Select SQL Lab settings tab
      const sqlLabSettingsTab = screen.getByRole('tab', {
        name: /sql lab settings/i,
      });
      userEvent.click(sqlLabSettingsTab);
      // Grab CTAS & schema field by their labels
      const allowCTAS = screen.getByLabelText('Allow CREATE TABLE AS');
      const schemaField = screen.getByText('CTAS & CVAS SCHEMA');

      // While CTAS & CVAS are unchecked, schema field is not visible
      expect(schemaField).not.toBeVisible();

      // Check "Allow CTAS" to reveal schema field
      // 🐞 ----- This needs to be clicked 2x for some reason, should only be 1x ----- 🐞
      userEvent.click(allowCTAS);
      userEvent.click(allowCTAS);
      expect(schemaField).toBeVisible();

      // Uncheck "Allow CTAS" to hide schema field again
      userEvent.click(allowCTAS);
      expect(schemaField).not.toBeVisible();
    });

    it('renders the schema field when allowCVAS is checked', () => {
      render(
        <ThemeProvider theme={supersetTheme}>
          <Provider store={store}>
            <DatabaseModal {...dbProps} />
          </Provider>
        </ThemeProvider>,
      );

      // Select SQL Lab settings tab
      const sqlLabSettingsTab = screen.getByRole('tab', {
        name: /sql lab settings/i,
      });
      userEvent.click(sqlLabSettingsTab);
      // Grab CVAS by it's label & schema field
      const allowCVAS = screen.getByText('Allow CREATE VIEW AS');
      const schemaField = screen.getByText('CTAS & CVAS SCHEMA');

      // While CTAS & CVAS are unchecked, schema field is not visible
      expect(schemaField).not.toBeVisible();

      // Check "Allow CVAS" to reveal schema field
      // 🐞 ----- This needs to be clicked 2x for some reason, should only be 1x ----- 🐞
      userEvent.click(allowCVAS);
      userEvent.click(allowCVAS);
      expect(schemaField).toBeVisible();

      // Uncheck "Allow CVAS" to hide schema field again
      userEvent.click(allowCVAS);
      expect(schemaField).not.toBeVisible();
    });

    it('renders the schema field when both allowCTAS and allowCVAS are checked', () => {
      render(
        <ThemeProvider theme={supersetTheme}>
          <Provider store={store}>
            <DatabaseModal {...dbProps} />
          </Provider>
        </ThemeProvider>,
      );

      // Select SQL Lab settings tab
      const sqlLabSettingsTab = screen.getByRole('tab', {
        name: /sql lab settings/i,
      });
      userEvent.click(sqlLabSettingsTab);
      // Grab CTAS and CVAS by their labels, & schema field
      const allowCTAS = screen.getByText('Allow CREATE TABLE AS');
      const allowCVAS = screen.getByText('Allow CREATE VIEW AS');
      const schemaField = screen.getByText('CTAS & CVAS SCHEMA');

      // While CTAS & CVAS are unchecked, schema field is not visible
      expect(schemaField).not.toBeVisible();

      // Check both "Allow CTAS" and "Allow CVAS" to reveal schema field
      userEvent.click(allowCTAS);
      userEvent.click(allowCVAS);
      expect(schemaField).toBeVisible();
      // Uncheck both "Allow CTAS" and "Allow CVAS" to hide schema field again
      userEvent.click(allowCTAS);
      userEvent.click(allowCVAS);
      // 🐞 ----- This extra click should not be happening to make the schema field invisible ----- 🐞
      // Both checkboxes go unchecked, so the field should no longer render
      // But the field requires one more click in order to lose visibility, as seen below
      userEvent.click(allowCVAS);
      expect(schemaField).not.toBeVisible();
    });
  });
});
