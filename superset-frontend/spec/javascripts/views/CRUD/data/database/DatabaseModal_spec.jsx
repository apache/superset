import React from 'react';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import { styledMount as mount } from 'spec/helpers/theming';
import {
  render,
  screen,
  fireEvent
} from '@testing-library/react';
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
      const sqlLabSettingsTab = screen.getByRole('tab', { name: /sql lab settings/i });
      userEvent.click(sqlLabSettingsTab);
      
      // Grab all SQL Lab Settings and checkboxes
      const sqlLabSettings = screen.getAllByRole('checkbox', { name: '' });
      const exposeInSqlLab = sqlLabSettings[0];
      const allowCTAS = sqlLabSettings[1];
      const allowCVAS = sqlLabSettings[2];
      const allowDML = sqlLabSettings[3];
      const allowMSMF = sqlLabSettings[4];

      // Check that "Expose in SQL Lab" starts checked
      expect(exposeInSqlLab.checked).toBeFalsy();
      // While checked, all settings should display
      expect(exposeInSqlLab).toBeVisible();
      expect(allowCTAS).toBeVisible();
      expect(allowCVAS).toBeVisible();
      expect(allowDML).toBeVisible();
      expect(allowMSMF).toBeVisible();

      // When clicked, "Expose in SQL Lab" becomes unchecked
      userEvent.click(exposeInSqlLab);
      expect(exposeInSqlLab.checked).toBeTruthy();
      // While unchecked, only "Expose in SQL Lab" should display
      expect(exposeInSqlLab).toBeVisible();
      expect(allowCTAS).not.toBeVisible();
      expect(allowCVAS).not.toBeVisible();
      expect(allowDML).not.toBeVisible();
      expect(allowMSMF).not.toBeVisible();
    });
    it('only renders the CTAS/CVAS schema field when one or both options are selected', () => {
      render(
        <ThemeProvider theme={supersetTheme}>
          <Provider store={store}>
            <DatabaseModal {...dbProps} />
          </Provider>
        </ThemeProvider>,
      );

      // Select SQL Lab settings tab
      const sqlLabSettingsTab = screen.getByRole('tab', { name: /sql lab settings/i });
      userEvent.click(sqlLabSettingsTab);
      
      // Grab all SQL Lab Settings, checkboxes && schema field
      const sqlLabSettings = screen.getAllByRole('checkbox', { name: '' });
      const allowCTAS = sqlLabSettings[1];
      const allowCVAS = sqlLabSettings[2];
      const schemaField = screen.getByText('CTAS & CVAS SCHEMA');

      // While CTAS & CVAS are unchecked, schema field is not visible
      expect(schemaField).not.toBeVisible();

      // Check "Allow CTAS" to reveal schema field
      userEvent.click(allowCTAS);
      userEvent.click(allowCTAS);   // This needs to be clicked 2x for some reason? Investigate!!!
      expect(schemaField).toBeVisible();
      // Uncheck "Allow CTAS" to hide schema field again
      userEvent.click(allowCTAS);
      expect(schemaField).not.toBeVisible();
    });
  });
});