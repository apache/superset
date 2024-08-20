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
import sinon from 'sinon';
import configureStore from 'redux-mock-store';
import { mount, shallow } from 'enzyme';
import {
  supersetTheme,
  ThemeProvider,
  DatasourceType,
} from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import {
  DatasourceModal,
  ChangeDatasourceModal,
} from 'src/components/Datasource';
import DatasourceControl, {
  getDatasourceTitle,
} from 'src/explore/components/controls/DatasourceControl';
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
    owners: [{ username: 'admin', userId: 1 }],
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
  user: {
    createdOn: '2021-04-27T18:12:38.952304',
    email: 'admin',
    firstName: 'admin',
    isActive: true,
    lastName: 'admin',
    permissions: {},
    roles: { Admin: Array(173) },
    userId: 1,
    username: 'admin',
  },
};

describe('DatasourceControl', () => {
  function setup(overrideProps) {
    const mockStore = configureStore([]);
    const store = mockStore({});
    const props = {
      ...defaultProps,
      ...overrideProps,
    };
    return mount(<DatasourceControl {...props} />, {
      context: { store },
      wrappingComponent: ThemeProvider,
      wrappingComponentProps: { theme: supersetTheme },
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
        {wrapper.find('[data-test="datasource-menu"]').first().prop('overlay')}
      </div>,
    );
    expect(menuWrapper.find(Menu.Item)).toHaveLength(3);

    wrapper = setup({
      isEditable: false,
    });
    expect(wrapper.find('[data-test="datasource-menu"]')).toExist();
    menuWrapper = shallow(
      <div>
        {wrapper.find('[data-test="datasource-menu"]').first().prop('overlay')}
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

  it('Gets Datasource Title', () => {
    const sql = 'This is the sql';
    const name = 'this is a name';
    const emptyResult = '';
    const queryDatasource1 = { type: DatasourceType.Query, sql };
    let displayText = getDatasourceTitle(queryDatasource1);
    expect(displayText).toBe(sql);
    const queryDatasource2 = { type: DatasourceType.Query, sql: null };
    displayText = getDatasourceTitle(queryDatasource2);
    expect(displayText).toBe(null);
    const queryDatasource3 = { type: 'random type', name };
    displayText = getDatasourceTitle(queryDatasource3);
    expect(displayText).toBe(name);
    const queryDatasource4 = { type: 'random type' };
    displayText = getDatasourceTitle(queryDatasource4);
    expect(displayText).toBe(emptyResult);
    displayText = getDatasourceTitle();
    expect(displayText).toBe(emptyResult);
    displayText = getDatasourceTitle(null);
    expect(displayText).toBe(emptyResult);
    displayText = getDatasourceTitle('I should not be a string');
    expect(displayText).toBe(emptyResult);
    displayText = getDatasourceTitle([]);
    expect(displayText).toBe(emptyResult);
  });
});
