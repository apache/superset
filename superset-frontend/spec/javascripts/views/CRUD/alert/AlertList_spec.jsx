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
import fetchMock from 'fetch-mock';
import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { styledMount as mount } from 'spec/helpers/theming';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { Switch } from 'src/common/components/Switch';
import ListView from 'src/components/ListView';
import SubMenu from 'src/components/Menu/SubMenu';
import AlertList from 'src/views/CRUD/alert/AlertList';

// store needed for withToasts(AlertList)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const alertsEndpoint = 'glob:*/api/v1/report/?*';
const alertEndpoint = 'glob:*/api/v1/report/*';
const alertsInfoEndpoint = 'glob:*/api/v1/report/_info*';
const alertsCreatedByEndpoint = 'glob:*/api/v1/report/related/created_by*';

const mockalerts = [...new Array(3)].map((_, i) => ({
  active: true,
  changed_by: {
    first_name: `user ${i}`,
    id: i,
  },
  changed_on_delta_humanized: `${i} day(s) ago`,
  created_by: {
    first_name: `user ${i}`,
    id: i,
  },
  created_on: new Date().toISOString,
  id: i,
  last_eval_dttm: Date.now(),
  last_state: 'ok',
  name: `alert ${i}  `,
  owners: [],
  recipients: [
    {
      id: `${i}`,
      type: 'email',
    },
  ],
  type: 'alert',
}));

const mockUser = {
  userId: 1,
};

fetchMock.get(alertsEndpoint, {
  ids: [2, 0, 1],
  result: mockalerts,
  count: 3,
});
fetchMock.get(alertsInfoEndpoint, {
  permissions: ['can_delete', 'can_edit'],
});
fetchMock.get(alertsCreatedByEndpoint, { result: [] });
fetchMock.put(alertEndpoint, { ...mockalerts[0], active: false });
fetchMock.put(alertsEndpoint, { ...mockalerts[0], active: false });

async function mountAndWait(props) {
  const mounted = mount(<AlertList {...props} user={mockUser} store={store} />);
  await waitForComponentToPaint(mounted);

  return mounted;
}

describe('AlertList', () => {
  let wrapper;

  beforeAll(async () => {
    wrapper = await mountAndWait();
  });

  it('renders', () => {
    expect(wrapper.find(AlertList)).toExist();
  });

  it('renders a SubMenu', () => {
    expect(wrapper.find(SubMenu)).toExist();
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toExist();
  });

  it('renders switches', () => {
    expect(wrapper.find(Switch)).toHaveLength(3);
  });
});
