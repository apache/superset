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

import DatabaseModal from 'src/views/CRUD/data/database/DatabaseModal';
import Modal from 'src/common/components/Modal';
import Tabs from 'src/common/components/Tabs';

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

describe('DatabaseModal', () => {
  const wrapper = mount(<DatabaseModal store={store} {...mockedProps} />);
  const editWrapper = mount(<DatabaseModal store={store} {...dbProps} />);

  it('renders', () => {
    expect(wrapper.find(DatabaseModal)).toExist();
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).toExist();
  });

  it('renders "Add Database" header when no database is included', () => {
    expect(wrapper.find('h4').text()).toEqual('Add Database');
  });

  it('renders "Edit Database" header when database prop is included', () => {
    expect(editWrapper.find('h4').text()).toEqual('Edit Database');
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
