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
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { Provider } from 'react-redux';
import DatabaseModal from 'src/views/CRUD/data/database/DatabaseModal';
import Modal from 'src/components/Modal';
import Tabs from 'src/common/components/Tabs';
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
    describe('initial load', () => {
      it('hides the forms from the db when not selected', () => {
        render(
          <ThemeProvider theme={supersetTheme}>
            <Provider store={store}>
              <DatabaseModal
                show
                database={{
                  expose_in_sqllab: false,
                  allow_ctas: false,
                  allow_cvas: false,
                }}
              />
            </Provider>
          </ThemeProvider>,
        );
        // Select SQL Lab settings tab
        const sqlLabSettingsTab = screen.getByRole('tab', {
          name: /sql lab settings/i,
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

      expect(checkboxes.length).toEqual(4);
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
