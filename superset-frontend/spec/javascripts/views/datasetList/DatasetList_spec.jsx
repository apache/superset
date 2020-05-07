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
import { mount } from 'enzyme';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';

import DatasetList from 'src/views/datasetList/DatasetList';
import ListView from 'src/components/ListView/ListView';

// store needed for withToasts(datasetTable)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const datasetsInfoEndpoint = 'glob:*/api/v1/dataset/_info*';
const datasetsOwnersEndpoint = 'glob:*/api/v1/dataset/related/owners*';
const datasetsEndpoint = 'glob:*/api/v1/dataset/?*';

const mockdatasets = [...new Array(3)].map((_, i) => ({
  changed_by_name: 'user',
  changed_by_url: 'changed_by_url',
  changed_by: 'user',
  changed_on: new Date().toISOString(),
  database_name: `db ${i}`,
  explore_url: `/explore/table/${i}`,
  id: i,
  schema: `schema ${i}`,
  table_name: `coolest table ${i}`,
}));

fetchMock.get(datasetsInfoEndpoint, {
  permissions: ['can_list', 'can_edit'],
  filters: {
    database: [],
    schema: [],
    table_name: [],
    owners: [],
    is_sqllab_view: [],
  },
});
fetchMock.get(datasetsOwnersEndpoint, {
  result: [],
});
fetchMock.get(datasetsEndpoint, {
  result: mockdatasets,
  dataset_count: 3,
});

describe('DatasetList', () => {
  const mockedProps = {};
  const wrapper = mount(<DatasetList {...mockedProps} />, {
    context: { store },
  });

  it('renders', () => {
    expect(wrapper.find(DatasetList)).toHaveLength(1);
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toHaveLength(1);
  });

  it('fetches info', () => {
    const callsI = fetchMock.calls(/dataset\/_info/);
    expect(callsI).toHaveLength(1);
  });

  it('fetches owners', () => {
    const callsO = fetchMock.calls(/dataset\/related\/owners/);
    expect(callsO).toHaveLength(1);
  });

  it('fetches data', () => {
    wrapper.update();
    const callsD = fetchMock.calls(/dataset\/\?q/);
    expect(callsD).toHaveLength(1);
    expect(callsD[0][0]).toMatchInlineSnapshot(
      `"/http//localhost/api/v1/dataset/?q=(order_column:changed_on,order_direction:desc,page:0,page_size:25)"`,
    );
  });
});
