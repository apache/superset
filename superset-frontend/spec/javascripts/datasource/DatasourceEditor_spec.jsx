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
import { Tabs } from 'react-bootstrap';
import { shallow } from 'enzyme';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';

import DatasourceEditor from 'src/datasource/DatasourceEditor';
import Field from 'src/CRUD/Field';
import mockDatasource from '../../fixtures/mockDatasource';

const props = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: () => {},
};

const extraColumn = {
  column_name: 'new_column',
  type: 'VARCHAR(10)',
  description: null,
  filterable: true,
  verbose_name: null,
  is_dttm: false,
  expression: '',
  groupby: true,
};

const DATASOURCE_ENDPOINT = 'glob:*/datasource/external_metadata/*';

describe('DatasourceEditor', () => {
  const mockStore = configureStore([thunk]);
  const store = mockStore({});
  fetchMock.get(DATASOURCE_ENDPOINT, []);

  let wrapper;
  let el;
  let inst;

  beforeEach(() => {
    el = <DatasourceEditor {...props} />;
    wrapper = shallow(el, { context: { store } }).dive();
    inst = wrapper.instance();
  });

  it('is valid', () => {
    expect(React.isValidElement(el)).toBe(true);
  });

  it('renders Tabs', () => {
    expect(wrapper.find(Tabs)).toHaveLength(1);
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

  it('merges columns', () => {
    const numCols = props.datasource.columns.length;
    expect(inst.state.databaseColumns).toHaveLength(numCols);
    inst.mergeColumns([extraColumn]);
    expect(inst.state.databaseColumns).toHaveLength(numCols + 1);
  });

  it('renders isSqla fields', () => {
    wrapper.setState({ activeTabKey: 4 });
    expect(wrapper.state('isSqla')).toBe(true);
    expect(
      wrapper.find(Field).find({ fieldKey: 'fetch_values_predicate' }).exists(),
    ).toBe(true);
  });
});
