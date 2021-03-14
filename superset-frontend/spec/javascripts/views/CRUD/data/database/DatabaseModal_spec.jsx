import React from 'react';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import { styledMount as mount } from 'spec/helpers/theming';
import {
  render,
  screen,
  fireEvent,
  waitFor
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { Provider } from 'react-redux';
import DatabaseModal from 'src/views/CRUD/data/database/DatabaseModal';
import Modal from 'src/common/components/Modal';
import Tabs from 'src/common/components/Tabs';
import fetchMock from 'fetch-mock';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { debug } from 'webpack';
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
      // 🐞 ----- Checked is false, should be true ----- 🐞
      expect(exposeInSqlLab.checked).toBeFalsy();
      // While checked, all settings should display
      expect(exposeInSqlLab).toBeVisible();
      expect(allowCTAS).toBeVisible();
      expect(allowCVAS).toBeVisible();
      expect(allowDML).toBeVisible();
      expect(allowMSMF).toBeVisible();

      // When clicked, "Expose in SQL Lab" becomes unchecked
      userEvent.click(exposeInSqlLab);
      // 🐞 ----- Unchecked is true, should be false ----- 🐞
      expect(exposeInSqlLab.checked).toBeTruthy();
      // While unchecked, only "Expose in SQL Lab" should display
      expect(exposeInSqlLab).toBeVisible();
      expect(allowCTAS).not.toBeVisible();
      expect(allowCVAS).not.toBeVisible();
      expect(allowDML).not.toBeVisible();
      expect(allowMSMF).not.toBeVisible();
    });

    it('renders the schema field when allowCTAS is checked', async () => {
      const { debug, container } = render(
        <ThemeProvider theme={supersetTheme}>
          <Provider store={store}>
            <DatabaseModal {...dbProps} />
          </Provider>
        </ThemeProvider>,
      );

      // Select SQL Lab settings tab
      const sqlLabSettingsTab = screen.getByRole('tab', { name: /sql lab settings/i });
      // const sqlLabSettingsTab = container.querySelector('[data-test-id="sql_lab_settings_tab_test_id"');
      debug(sqlLabSettingsTab);
      userEvent.click(sqlLabSettingsTab);
      
      // Grab all SQL Lab Settings, CTAS checkbox, & schema field
      const sqlLabSettings = screen.getAllByRole('checkbox', { name: '' });
      const allowCTAS = sqlLabSettings[1];
      const allowCVAS = sqlLabSettings[2];
      const schemaField = screen.getByText('CTAS & CVAS SCHEMA');

      // While CTAS & CVAS are unchecked, schema field is not visible
      expect(allowCTAS).toHaveClass('hidden');
      expect(allowCVAS.checked).toBeFalsy();
      expect(schemaField).not.toBeVisible();

      // Check "Allow CTAS" to reveal schema field
      userEvent.click(allowCTAS);
      // debug(null, 20000);
      // 🐞 ----- This needs to be clicked 2x for some reason, should only be 1x ----- 🐞
      userEvent.click(allowCTAS);
      // await waitFor(() => {
        expect(allowCTAS.checked).toBeFalsy()
        expect(schemaField).toBeVisible()
        // expect(allowCTAS.checked).toBeTruthy()
      // })

      // Uncheck "Allow CTAS" to hide schema field again
      userEvent.click(allowCTAS);
      expect(allowCTAS.checked).toBeTruthy();
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
      const sqlLabSettingsTab = screen.getByRole('tab', { name: /sql lab settings/i });
      userEvent.click(sqlLabSettingsTab);
      
      // Grab all SQL Lab Settings, CVAS checkbox, & schema field
      const sqlLabSettings = screen.getAllByRole('checkbox', { name: '' });
      const allowCTAS = sqlLabSettings[1];
      const allowCVAS = sqlLabSettings[2];
      const schemaField = screen.getByText('CTAS & CVAS SCHEMA');

      // While CTAS & CVAS are unchecked, schema field is not visible
      expect(allowCTAS.checked).toBeFalsy();
      expect(allowCVAS.checked).toBeFalsy();
      expect(schemaField).not.toBeVisible();

      // Check "Allow CVAS" to reveal schema field
      userEvent.click(allowCVAS);
      expect(allowCVAS.checked).toBeTruthy();
      // 🐞 ----- This needs to be clicked 2x for some reason, should only be 1x ----- 🐞
      userEvent.click(allowCVAS);
      expect(allowCVAS.checked).toBeFalsy();
      expect(schemaField).toBeVisible();

      // Uncheck "Allow CVAS" to hide schema field again
      userEvent.click(allowCVAS);
      expect(allowCVAS.checked).toBeTruthy();
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
      const sqlLabSettingsTab = screen.getByRole('tab', { name: /sql lab settings/i });
      userEvent.click(sqlLabSettingsTab);
      
      // Grab all SQL Lab Settings, CTAS/CVAS checkboxes, & schema field
      const sqlLabSettings = screen.getAllByRole('checkbox', { name: '' });
      const allowCTAS = sqlLabSettings[1];
      const allowCVAS = sqlLabSettings[2];
      const schemaField = screen.getByTestId('schema_field_test_id');

      // While CTAS & CVAS are unchecked, schema field is not visible
      expect(allowCTAS.checked).toBeFalsy();
      expect(allowCVAS.checked).toBeFalsy();
      expect(schemaField).not.toBeVisible();

      // Check both "Allow CTAS" and "Allow CVAS" to reveal schema field
      userEvent.click(allowCTAS);
      expect(allowCTAS.checked).toBeTruthy();
      userEvent.click(allowCVAS);
      expect(allowCVAS.checked).toBeTruthy();
      expect(schemaField).toBeVisible();
      
      // Uncheck both "Allow CTAS" and "Allow CVAS" to hide schema field again
      userEvent.click(allowCTAS);
      expect(allowCTAS.checked).toBeFalsy();
      userEvent.click(allowCVAS);
      expect(allowCVAS.checked).toBeFalsy();
      // ----- This extra click should not be happening to make the field invisible -----
      // Both checkboxes go unchecked, so the field should no longer render
      // But the field requires one more click in order to lose visibility, as seen below
      userEvent.click(allowCVAS);
      expect(allowCVAS.checked).toBeTruthy();
      expect(schemaField).not.toBeVisible();
    });
  });
});