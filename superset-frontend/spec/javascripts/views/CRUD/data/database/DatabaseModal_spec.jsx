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
import { render, getByTestId, screen, container, fireEvent } from 'spec/helpers/testing-library';
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
  const wrapper = mount(<DatabaseModal store={store} {...mockedProps} />);

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

  // it('renders solely "Expose in SQL Lab" option when unchecked', () => {
  //   const editWrapper = mount(<DatabaseModal store={store} {...dbProps} />);
  //   waitForComponentToPaint(editWrapper);

  //   // Open edit db modal
  //   const dbEditButton = editWrapper.find('h4');
  //   dbEditButton.simulate('click');

  //   // Select SQL Lab settings tab
  //   const sqlLabSettingsTab = editWrapper.find('span').at(5);
  //   sqlLabSettingsTab.simulate('click');

  //   // Uncheck "Expose in SQL Lab"
  //   const exposeInSqlLabCheckbox = editWrapper.find('input[name="expose_in_sqllab"]');
  //   console.log(exposeInSqlLabCheckbox.prop('checked'));
  //   exposeInSqlLabCheckbox.simulate('click');
  //   exposeInSqlLabCheckbox.simulate('change', { target: { name: 'checked', value: true } });
  //   // exposeInSqlLabCheckbox.setState({ checked: true })

  //   console.log(exposeInSqlLabCheckbox.prop('checked'));
  //   expect(sqlLabSettingsTab.text()).toEqual('SQL Lab settings');
  // });

  it('renders solely "Expose in SQL Lab" option when unchecked', () => {
    const { getByTestId } = render(<DatabaseModal store={store} {...dbProps} />);

    // Open edit db modal
    const dbEditButton = screen.getByTestId('edit-database-button');
    console.log(dbEditButton);

    // Select SQL Lab settings tab
    // const sqlLabSettingsTab = getByRole('tab', { id: "rc-tabs-test-tab-3" });
    // console.log(sqlLabSettingsTab);

    // Uncheck "Expose in SQL Lab"
  });
});
