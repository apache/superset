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
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';

import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { initialState } from 'spec/javascripts/sqllab/fixtures';
import { styledMount as mount } from 'spec/helpers/theming';
import { render, screen } from 'spec/helpers/testing-library';

import Modal from 'src/components/Modal';
import Tabs from 'src/components/Tabs';
import DatabaseModal from './index';

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
    it('renders "Connect a database" header when no database is included', () => {
      expect(wrapper.find('h4').text()).toEqual('Connect a database');
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
      expect(exposeInSqlLab).toBeChecked();

      // While checked make sure all checkboxes are showing
      expect(exposeInSqlLab).toBeChecked();
      const checkboxes = screen
        .getAllByRole('checkbox')
        .filter(checkbox => !checkbox.checked);

      expect(checkboxes.length).toEqual(4);
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
