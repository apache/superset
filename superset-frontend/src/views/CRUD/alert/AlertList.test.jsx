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
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import { styledMount as mount } from 'spec/helpers/theming';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { Switch } from 'src/components/Switch';
import ListView from 'src/components/ListView';
import SubMenu from 'src/components/Menu/SubMenu';
import AlertList from 'src/views/CRUD/alert/AlertList';
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';
import { act } from 'react-dom/test-utils';

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
  permissions: ['can_write'],
});
fetchMock.get(alertsCreatedByEndpoint, { result: [] });
fetchMock.put(alertEndpoint, { ...mockalerts[0], active: false });
fetchMock.put(alertsEndpoint, { ...mockalerts[0], active: false });
fetchMock.delete(alertEndpoint, {});
fetchMock.delete(alertsEndpoint, {});

async function mountAndWait(props = {}) {
  const mounted = mount(
    <Provider store={store}>
      <AlertList store={store} user={mockUser} {...props} />
    </Provider>,
  );

  await waitForComponentToPaint(mounted);

  return mounted;
}

describe('AlertList', () => {
  let wrapper;

  beforeAll(async () => {
    wrapper = await mountAndWait();
  });

  it('renders', async () => {
    expect(wrapper.find(AlertList)).toExist();
  });

  it('renders a SubMenu', async () => {
    expect(wrapper.find(SubMenu)).toExist();
  });

  it('renders a ListView', async () => {
    expect(wrapper.find(ListView)).toExist();
  });

  it('renders switches', async () => {
    expect(wrapper.find(Switch)).toHaveLength(3);
  });

  it('deletes', async () => {
    act(() => {
      wrapper.find('[data-test="delete-action"]').first().props().onClick();
    });
    await waitForComponentToPaint(wrapper);

    act(() => {
      wrapper
        .find('#delete')
        .first()
        .props()
        .onChange({ target: { value: 'DELETE' } });
    });
    await waitForComponentToPaint(wrapper);
    act(() => {
      wrapper
        .find('[data-test="modal-confirm-button"]')
        .last()
        .props()
        .onClick();
    });

    await waitForComponentToPaint(wrapper);

    expect(fetchMock.calls(/report\/0/, 'DELETE')).toHaveLength(1);
  });

  it('shows/hides bulk actions when bulk actions is clicked', async () => {
    const button = wrapper.find('[data-test="bulk-select-toggle"]').first();
    act(() => {
      button.props().onClick();
    });
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(IndeterminateCheckbox)).toHaveLength(
      mockalerts.length + 1, // 1 for each row and 1 for select all
    );
  });

  it('hides bulk actions when switch between alert and report list', async () => {
    expect(wrapper.find(IndeterminateCheckbox)).toHaveLength(
      mockalerts.length + 1,
    );
    expect(wrapper.find('[data-test="alert-list"]').hasClass('active')).toBe(
      true,
    );
    expect(wrapper.find('[data-test="report-list"]').hasClass('active')).toBe(
      false,
    );

    const reportWrapper = await mountAndWait({ isReportEnabled: true });

    expect(fetchMock.calls(/report\/\?q/)[2][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/report/?q=(filters:!((col:type,opr:eq,value:Report)),order_column:name,order_direction:desc,page:0,page_size:25)"`,
    );

    expect(
      reportWrapper.find('[data-test="report-list"]').hasClass('active'),
    ).toBe(true);
    expect(
      reportWrapper.find('[data-test="alert-list"]').hasClass('active'),
    ).toBe(false);
    expect(reportWrapper.find(IndeterminateCheckbox)).toHaveLength(0);
  });
});
