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
import { shallow } from 'enzyme';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import { Radio } from 'react-bootstrap';

import Icon from 'src/components/Icon';
import Tabs from 'src/common/components/Tabs';
import DatasourceEditor from 'src/datasource/DatasourceEditor';
import Field from 'src/CRUD/Field';
import mockDatasource from 'spec/fixtures/mockDatasource';
import * as featureFlags from 'src/featureFlags';
import TableSelector from 'src/components/TableSelector';

const props = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: () => {},
};

const DATASOURCE_ENDPOINT = 'glob:*/datasource/external_metadata/*';

describe('DatasourceEditor', () => {
  const mockStore = configureStore([thunk]);
  const store = mockStore({});
  fetchMock.get(DATASOURCE_ENDPOINT, []);

  let wrapper;
  let el;
  let inst;
  let isFeatureEnabledMock;

  beforeEach(() => {
    el = <DatasourceEditor {...props} store={store} />;
    wrapper = shallow(el).dive();
    inst = wrapper.instance();
  });

  it('is valid', () => {
    expect(React.isValidElement(el)).toBe(true);
  });

  it('renders Tabs', () => {
    expect(wrapper.find(Tabs)).toExist();
  });

  it('makes an async request', () => {
    return new Promise(done => {
      wrapper.setState({ activeTabKey: 2 });
      const syncButton = wrapper.find('.sync-from-source');
      expect(syncButton).toHaveLength(1);
      syncButton.simulate('click');

      setTimeout(() => {
        expect(fetchMock.calls(DATASOURCE_ENDPOINT)).toHaveLength(1);
        fetchMock.reset();
        done();
      }, 0);
    });
  });

  it('to add, remove and modify columns accordingly', () => {
    const columns = [
      {
        name: 'ds',
        type: 'DATETIME',
        nullable: true,
        default: '',
        primary_key: false,
      },
      {
        name: 'gender',
        type: 'VARCHAR(32)',
        nullable: true,
        default: '',
        primary_key: false,
      },
      {
        name: 'new_column',
        type: 'VARCHAR(10)',
        nullable: true,
        default: '',
        primary_key: false,
      },
    ];

    const numCols = props.datasource.columns.length;
    expect(inst.state.databaseColumns).toHaveLength(numCols);
    inst.updateColumns(columns);
    expect(inst.state.databaseColumns).toEqual(
      expect.arrayContaining([
        {
          type: 'DATETIME',
          description: null,
          filterable: false,
          verbose_name: null,
          is_dttm: true,
          expression: '',
          groupby: false,
          column_name: 'ds',
        },
        {
          type: 'VARCHAR(32)',
          description: null,
          filterable: true,
          verbose_name: null,
          is_dttm: false,
          expression: '',
          groupby: true,
          column_name: 'gender',
        },
        expect.objectContaining({
          column_name: 'new_column',
          type: 'VARCHAR(10)',
        }),
      ]),
    );
    expect(inst.state.databaseColumns).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'name' })]),
    );
  });

  it('renders isSqla fields', () => {
    wrapper.setState({ activeTabKey: 4 });
    expect(wrapper.state('isSqla')).toBe(true);
    expect(
      wrapper.find(Field).find({ fieldKey: 'fetch_values_predicate' }).exists(),
    ).toBe(true);
  });

  describe('enable edit Source tab', () => {
    beforeAll(() => {
      isFeatureEnabledMock = jest
        .spyOn(featureFlags, 'isFeatureEnabled')
        .mockImplementation(() => false);
      wrapper = shallow(el, { context: { store } }).dive();
    });

    afterAll(() => {
      isFeatureEnabledMock.mockRestore();
    });

    it('Source Tab: edit mode', () => {
      wrapper.setState({ activeTabKey: 0, isEditMode: true });
      const sourceTab = wrapper.find(Tabs.TabPane).first();
      expect(sourceTab.find(Radio).first().prop('disabled')).toBe(false);

      const icon = sourceTab.find(Icon);
      expect(icon.prop('name')).toBe('lock-unlocked');

      const tableSelector = sourceTab.find(Field).shallow().find(TableSelector);
      expect(tableSelector.length).toBe(1);
      expect(tableSelector.prop('readOnly')).toBe(false);
    });

    it('Source Tab: readOnly mode', () => {
      const sourceTab = wrapper.find(Tabs.TabPane).first();
      expect(sourceTab.find(Radio).length).toBe(2);
      expect(sourceTab.find(Radio).first().prop('disabled')).toBe(true);

      const icon = sourceTab.find(Icon);
      expect(icon.prop('name')).toBe('lock-locked');
      icon.parent().simulate('click');
      expect(wrapper.state('isEditMode')).toBe(true);

      const tableSelector = sourceTab.find(Field).shallow().find(TableSelector);
      expect(tableSelector.length).toBe(1);
      expect(tableSelector.prop('readOnly')).toBe(true);
    });
  });

  it('disable edit Source tab', () => {
    // when edit is disabled, show readOnly controls and no padlock
    isFeatureEnabledMock = jest
      .spyOn(featureFlags, 'isFeatureEnabled')
      .mockImplementation(() => true);
    wrapper = shallow(el, { context: { store } }).dive();
    wrapper.setState({ activeTabKey: 0 });

    const sourceTab = wrapper.find(Tabs.TabPane).first();
    expect(sourceTab.find(Radio).length).toBe(2);
    expect(sourceTab.find(Radio).first().prop('disabled')).toBe(true);

    const icon = sourceTab.find(Icon);
    expect(icon).toHaveLength(0);

    isFeatureEnabledMock.mockRestore();
  });
});
