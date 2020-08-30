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
import sinon from 'sinon';
import configureStore from 'redux-mock-store';
import { shallow } from 'enzyme';
import { MenuItem } from 'react-bootstrap';
import DatasourceModal from 'src/datasource/DatasourceModal';
import ChangeDatasourceModal from 'src/datasource/ChangeDatasourceModal';
import DatasourceControl from 'src/explore/components/controls/DatasourceControl';

const defaultProps = {
  name: 'datasource',
  label: 'Dataset',
  value: '1__table',
  datasource: {
    name: 'birth_names',
    type: 'table',
    uid: '1__table',
    id: 1,
    columns: [],
    metrics: [],
    database: {
      backend: 'mysql',
      name: 'main',
    },
  },
  actions: {
    setDatasource: sinon.spy(),
  },
  onChange: sinon.spy(),
};

describe('DatasourceControl', () => {
  function setup(overrideProps) {
    const mockStore = configureStore([]);
    const store = mockStore({});
    const props = {
      ...defaultProps,
      ...overrideProps,
    };
    return shallow(<DatasourceControl {...props} />, {
      context: { store },
    });
  }

  it('renders a Modal', () => {
    const wrapper = setup();
    expect(wrapper.find(DatasourceModal)).toExist();
  });

  it('renders a ChangeDatasourceModal', () => {
    const wrapper = setup();
    expect(wrapper.find(ChangeDatasourceModal)).toExist();
  });

  it('show or hide Edit Datasource option', () => {
    let wrapper = setup();
    expect(wrapper.find('#datasource_menu')).toExist();
    expect(wrapper.find('#datasource_menu').dive().find(MenuItem)).toHaveLength(
      3,
    );

    wrapper = setup({
      isEditable: false,
    });
    expect(wrapper.find('#datasource_menu')).toExist();
    expect(wrapper.find('#datasource_menu').dive().find(MenuItem)).toHaveLength(
      2,
    );
  });
});
