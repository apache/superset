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
import { Menu } from 'src/common/components';
import {
  DatasourceModal,
  ChangeDatasourceModal,
} from 'src/components/Datasource';
import DatasourceControl from 'src/explore/components/controls/DatasourceControl';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';

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
    health_check_message: 'Warning message!',
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

  it('should not render Modal', () => {
    const wrapper = setup();
    expect(wrapper.find(DatasourceModal)).toHaveLength(0);
  });

  it('should not render ChangeDatasourceModal', () => {
    const wrapper = setup();
    expect(wrapper.find(ChangeDatasourceModal)).toHaveLength(0);
  });

  it('show or hide Edit Datasource option', () => {
    let wrapper = setup();
    expect(wrapper.find('[data-test="datasource-menu"]')).toExist();
    let menuWrapper = shallow(
      <div>
        {wrapper.find('[data-test="datasource-menu"]').prop('overlay')}
      </div>,
    );
    expect(menuWrapper.find(Menu.Item)).toHaveLength(3);

    wrapper = setup({
      isEditable: false,
    });
    expect(wrapper.find('[data-test="datasource-menu"]')).toExist();
    menuWrapper = shallow(
      <div>
        {wrapper.find('[data-test="datasource-menu"]').prop('overlay')}
      </div>,
    );
    expect(menuWrapper.find(Menu.Item)).toHaveLength(2);

    wrapper = setup({
      datasource: {
        name: 'birth_names',
        type: 'druid',
        uid: '1__druid',
        id: 1,
        columns: [],
        metrics: [],
        database: {
          backend: 'druid',
          name: 'main',
        },
      },
    });
    expect(wrapper.find('[data-test="datasource-menu"]')).toExist();
    menuWrapper = shallow(
      <div>
        {wrapper.find('[data-test="datasource-menu"]').prop('overlay')}
      </div>,
    );
    expect(menuWrapper.find(Menu.Item)).toHaveLength(2);
  });

  it('should render health check message', () => {
    const wrapper = setup();
    expect(wrapper.find(Icons.AlertSolid)).toExist();
    const tooltip = wrapper.find(Tooltip).at(0);
    expect(tooltip.prop('title')).toBe(
      defaultProps.datasource.health_check_message,
    );
  });
});
