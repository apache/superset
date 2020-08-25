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
import { supersetTheme, ThemeProvider } from '@superset-ui/style';

import ChartList from 'src/views/CRUD/chart/ChartList';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import ListView from 'src/components/ListView';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import ListViewCard from 'src/components/ListViewCard';

// store needed for withToasts(ChartTable)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const chartsInfoEndpoint = 'glob:*/api/v1/chart/_info*';
const chartssOwnersEndpoint = 'glob:*/api/v1/chart/related/owners*';
const chartsEndpoint = 'glob:*/api/v1/chart/?*';
const chartsVizTypesEndpoint = 'glob:*/api/v1/chart/viz_types';
const chartsDtasourcesEndpoint = 'glob:*/api/v1/chart/datasources';

const mockCharts = [...new Array(3)].map((_, i) => ({
  changed_on: new Date().toISOString(),
  creator: 'super user',
  id: i,
  slice_name: `cool chart ${i}`,
  url: 'url',
  viz_type: 'bar',
  datasource_name: `ds${i}`,
  thumbnail_url: '/thumbnail',
}));

fetchMock.get(chartsInfoEndpoint, {
  permissions: ['can_list', 'can_edit', 'can_delete'],
});
fetchMock.get(chartssOwnersEndpoint, {
  result: [],
});
fetchMock.get(chartsEndpoint, {
  result: mockCharts,
  chart_count: 3,
});

fetchMock.get(chartsVizTypesEndpoint, {
  result: [],
  count: 0,
});

fetchMock.get(chartsDtasourcesEndpoint, {
  result: [],
  count: 0,
});

global.URL.createObjectURL = jest.fn();
fetchMock.get('/thumbnail', { body: new Blob(), sendAsJson: false });

describe('ChartList', () => {
  const mockedProps = {};
  const wrapper = mount(<ChartList {...mockedProps} />, {
    context: { store },
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: { theme: supersetTheme },
  });

  it('renders', () => {
    expect(wrapper.find(ChartList)).toExist();
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toExist();
  });

  it('fetches info', () => {
    const callsI = fetchMock.calls(/chart\/_info/);
    expect(callsI).toHaveLength(1);
  });

  it('fetches data', () => {
    wrapper.update();
    const callsD = fetchMock.calls(/chart\/\?q/);
    expect(callsD).toHaveLength(1);
    expect(callsD[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/chart/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)"`,
    );
  });

  it('renders a card view', () => {
    expect(wrapper.find(ListViewCard)).toExist();
  });

  it('renders a table view', () => {
    wrapper.find('[data-test="list-view"]').first().simulate('click');
    expect(wrapper.find('table')).toExist();
  });

  it('edits', () => {
    expect(wrapper.find(PropertiesModal)).not.toExist();
    wrapper.find('[data-test="pencil"]').first().simulate('click');
    expect(wrapper.find(PropertiesModal)).toExist();
  });

  it('delete', () => {
    wrapper.find('[data-test="trash"]').first().simulate('click');
    expect(wrapper.find(ConfirmStatusChange)).toExist();
  });
});
