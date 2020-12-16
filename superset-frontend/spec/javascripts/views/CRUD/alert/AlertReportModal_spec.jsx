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
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import AlertReportModal from 'src/views/CRUD/alert/AlertReportModal';
import Modal from 'src/common/components/Modal';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { styledMount as mount } from 'spec/helpers/theming';

const mockData = {
  id: 1,
  name: 'test report',
  description: 'test report description',
};
const FETCH_REPORT_ENDPOINT = 'glob:*/api/v1/report/*';
const REPORT_PAYLOAD = { result: mockData };

fetchMock.get(FETCH_REPORT_ENDPOINT, REPORT_PAYLOAD);

const mockStore = configureStore([thunk]);
const store = mockStore({});

// Report mock is default for testing
const mockedProps = {
  addDangerToast: () => {},
  onAdd: jest.fn(() => []),
  onHide: () => {},
  show: true,
  isReport: true,
};

// Related mocks
const ownersEndpoint = 'glob:*/api/v1/dashboard/related/owners?*';
const databaseEndpoint = 'glob:*/api/v1/dataset/related/database?*';
const dashboardEndpoint = 'glob:*/api/v1/dashboard?*';
const chartEndpoint = 'glob:*/api/v1/chart?*';

fetchMock.get(ownersEndpoint, {
  result: [],
});

fetchMock.get(databaseEndpoint, {
  result: [],
});

fetchMock.get(dashboardEndpoint, {
  result: [],
});

fetchMock.get(chartEndpoint, {
  result: [],
});

async function mountAndWait(props = mockedProps) {
  const mounted = mount(
    <Provider store={store}>
      <AlertReportModal show {...props} />
    </Provider>,
    {
      context: { store },
    },
  );

  await waitForComponentToPaint(mounted);

  return mounted;
}

describe('AlertReportModal', () => {
  let wrapper;

  beforeAll(async () => {
    wrapper = await mountAndWait();
  });

  it('renders', () => {
    expect(wrapper.find(AlertReportModal)).toExist();
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).toExist();
  });

  it('renders add header for report when no alert is included, and isReport is true', async () => {
    const addWrapper = await mountAndWait();

    expect(
      addWrapper.find('[data-test="alert-report-modal-title"]').text(),
    ).toEqual('Add Report');
  });

  it('renders add header for alert when no alert is included, and isReport is false', async () => {
    const props = {
      ...mockedProps,
      isReport: false,
    };

    const addWrapper = await mountAndWait(props);

    expect(
      addWrapper.find('[data-test="alert-report-modal-title"]').text(),
    ).toEqual('Add Alert');
  });

  it.skip('renders edit header when alert prop is included', () => {
    expect(
      wrapper.find('[data-test="alert-report-modal-title"]').text(),
    ).toEqual('Edit Report');
  });

  it('renders input element for name', () => {
    expect(wrapper.find('input[name="name"]')).toExist();
  });

  it('renders input element for description', () => {
    expect(wrapper.find('input[name="description"]')).toExist();
  });
});
