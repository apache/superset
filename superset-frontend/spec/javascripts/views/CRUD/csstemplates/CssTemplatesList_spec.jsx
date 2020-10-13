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
import fetchMock from 'fetch-mock';
import { styledMount as mount } from 'spec/helpers/theming';

import CssTemplatesList from 'src/views/CRUD/csstemplates/CssTemplatesList';
import SubMenu from 'src/components/Menu/SubMenu';
import ListView from 'src/components/ListView';
// import Filters from 'src/components/ListView/Filters';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
// import { act } from 'react-dom/test-utils';

// store needed for withToasts(DatabaseList)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const templatesInfoEndpoint = 'glob:*/api/v1/css_template/_info*';
const templatesEndpoint = 'glob:*/api/v1/css_template/?*';

const mocktemplates = [...new Array(3)].map((_, i) => ({
  changed_on_delta_humanized: `${i} day(s) ago`,
  created_by: {
    first_name: `user`,
    last_name: `${i}`,
  },
  created_on: new Date().toISOString,
  css: 'css',
  id: i,
  template_name: `template ${i}`,
}));

fetchMock.get(templatesInfoEndpoint, {
  permissions: ['can_delete'],
});
fetchMock.get(templatesEndpoint, {
  result: mocktemplates,
  templates_count: 3,
});

describe('CssTemplatesList', () => {
  const wrapper = mount(<CssTemplatesList />, { context: { store } });

  beforeAll(async () => {
    await waitForComponentToPaint(wrapper);
  });

  it('renders', () => {
    expect(wrapper.find(CssTemplatesList)).toExist();
  });

  it('renders a SubMenu', () => {
    expect(wrapper.find(SubMenu)).toExist();
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toExist();
  });
});
