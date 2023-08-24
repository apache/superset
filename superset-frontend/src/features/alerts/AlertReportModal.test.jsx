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
import { act } from 'react-dom/test-utils';
import Modal from 'src/components/Modal';
import { Select, AsyncSelect } from 'src/components';
import { Switch } from 'src/components/Switch';
import { Radio } from 'src/components/Radio';
import TextAreaControl from 'src/explore/components/controls/TextAreaControl';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { styledMount as mount } from 'spec/helpers/theming';
import AlertReportModal from './AlertReportModal';

const mockData = {
  active: true,
  id: 1,
  name: 'test report',
  description: 'test report description',
  chart: { id: 1, slice_name: 'test chart', viz_type: 'table' },
  database: { id: 1, database_name: 'test database' },
  sql: 'SELECT NaN',
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
const ownersEndpoint = 'glob:*/api/v1/alert/related/owners?*';
const databaseEndpoint = 'glob:*/api/v1/alert/related/database?*';
const dashboardEndpoint = 'glob:*/api/v1/alert/related/dashboard?*';
const chartEndpoint = 'glob:*/api/v1/alert/related/chart?*';

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
  result: [{ text: 'table chart', value: 1 }],
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

  it('render a empty modal', () => {
    expect(wrapper.find('input[name="name"]').text()).toEqual('');
    expect(wrapper.find('input[name="description"]').text()).toEqual('');
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

  it('renders edit modal', async () => {
    const props = {
      ...mockedProps,
      alert: mockData,
    };

    const editWrapper = await mountAndWait(props);
    expect(
      editWrapper.find('[data-test="alert-report-modal-title"]').text(),
    ).toEqual('Edit Report');
    expect(editWrapper.find('input[name="name"]').props().value).toEqual(
      'test report',
    );
    expect(editWrapper.find('input[name="description"]').props().value).toEqual(
      'test report description',
    );
  });

  it('renders async select with value in alert edit modal', async () => {
    const props = {
      ...mockedProps,
      alert: mockData,
      isReport: false,
    };

    const editWrapper = await mountAndWait(props);
    expect(
      editWrapper.find('[aria-label="Database"]').at(0).props().value,
    ).toEqual({
      value: 1,
      label: 'test database',
    });
    expect(
      editWrapper.find('[aria-label="Chart"]').at(0).props().value,
    ).toEqual({
      value: 1,
      label: 'test chart',
    });
  });

  // Fields
  it('renders input element for name', () => {
    expect(wrapper.find('input[name="name"]')).toExist();
  });

  it('renders four select elements when in report mode', () => {
    expect(wrapper.find(Select)).toExist();
    expect(wrapper.find(AsyncSelect)).toExist();
    expect(wrapper.find(Select)).toHaveLength(2);
    expect(wrapper.find(AsyncSelect)).toHaveLength(2);
  });

  it('renders Switch element', () => {
    expect(wrapper.find(Switch)).toExist();
  });

  it('renders input element for description', () => {
    expect(wrapper.find('input[name="description"]')).toExist();
  });

  it('renders input element for sql in alert mode only', async () => {
    const props = {
      ...mockedProps,
      isReport: false,
    };

    const addWrapper = await mountAndWait(props);

    expect(wrapper.find(TextAreaControl)).toHaveLength(0);
    expect(addWrapper.find(TextAreaControl)).toExist();
  });

  it('renders input element for sql with NaN', async () => {
    const props = {
      ...mockedProps,
      alert: mockData,
      isReport: false,
    };

    const editWrapper = await mountAndWait(props);
    const input = editWrapper.find(TextAreaControl);
    expect(input).toExist();
    expect(input.props().initialValue).toEqual('SELECT NaN');
  });

  it('renders four select element when in report mode', () => {
    expect(wrapper.find(Select)).toExist();
    expect(wrapper.find(AsyncSelect)).toExist();
    expect(wrapper.find(Select)).toHaveLength(2);
    expect(wrapper.find(AsyncSelect)).toHaveLength(2);
  });

  it('renders six select elements when in alert mode', async () => {
    const props = {
      ...mockedProps,
      isReport: false,
    };

    const addWrapper = await mountAndWait(props);

    expect(addWrapper.find(Select)).toExist();
    expect(addWrapper.find(AsyncSelect)).toExist();
    expect(addWrapper.find(Select)).toHaveLength(3);
    expect(addWrapper.find(AsyncSelect)).toHaveLength(3);
  });

  it('renders value input element when in alert mode', async () => {
    const props = {
      ...mockedProps,
      isReport: false,
    };

    const addWrapper = await mountAndWait(props);

    expect(wrapper.find('input[name="threshold"]')).toHaveLength(0);
    expect(addWrapper.find('input[name="threshold"]')).toExist();
  });

  it('renders two radio buttons', () => {
    expect(wrapper.find(Radio)).toExist();
    expect(wrapper.find(Radio)).toHaveLength(2);
  });

  it('renders text option for text-based charts', async () => {
    const props = {
      ...mockedProps,
      alert: mockData,
    };
    const textWrapper = await mountAndWait(props);

    const chartOption = textWrapper.find('input[value="chart"]');
    act(() => {
      chartOption.props().onChange({ target: { value: 'chart' } });
    });
    await waitForComponentToPaint(textWrapper);

    expect(textWrapper.find('input[value="TEXT"]')).toExist();
  });

  it('renders input element for working timeout', () => {
    expect(wrapper.find('input[name="working_timeout"]')).toExist();
  });

  it('renders input element for grace period for alert only', async () => {
    const props = {
      ...mockedProps,
      isReport: false,
    };

    const addWrapper = await mountAndWait(props);

    expect(addWrapper.find('input[name="grace_period"]')).toExist();
    expect(wrapper.find('input[name="grace_period"]')).toHaveLength(0);
  });

  it('only allows grace period values > 1', async () => {
    const props = {
      ...mockedProps,
      isReport: false,
    };

    const addWrapper = await mountAndWait(props);

    const input = addWrapper.find('input[name="grace_period"]');

    input.simulate('change', { target: { name: 'grace_period', value: 7 } });
    expect(input.instance().value).toEqual('7');

    input.simulate('change', { target: { name: 'grace_period', value: 0 } });
    expect(input.instance().value).toEqual('');

    input.simulate('change', { target: { name: 'grace_period', value: -1 } });
    expect(input.instance().value).toEqual('1');
  });

  it('only allows working timeout values > 1', () => {
    const input = wrapper.find('input[name="working_timeout"]');

    input.simulate('change', { target: { name: 'working_timeout', value: 7 } });
    expect(input.instance().value).toEqual('7');

    input.simulate('change', { target: { name: 'working_timeout', value: 0 } });
    expect(input.instance().value).toEqual('');

    input.simulate('change', {
      target: { name: 'working_timeout', value: -1 },
    });
    expect(input.instance().value).toEqual('1');
  });

  it('allows to add notification method', async () => {
    const button = wrapper.find('[data-test="notification-add"]');
    act(() => {
      button.props().onClick();
    });
    await waitForComponentToPaint(wrapper);

    // use default config: only show Email as notification option.
    expect(
      wrapper.find('[data-test="notification-add"]').props().status,
    ).toEqual('hidden');
    act(() => {
      wrapper
        .find('[data-test="select-delivery-method"]')
        .last()
        .props()
        .onSelect('Email');
    });
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find('textarea[name="recipients"]')).toHaveLength(1);
  });

  it('renders bypass cache checkbox', async () => {
    const bypass = wrapper.find('[data-test="bypass-cache"]');
    expect(bypass).toExist();
  });

  it('renders no bypass cache checkbox when alert', async () => {
    const props = {
      ...mockedProps,
      alert: mockData,
      isReport: false,
    };

    const alertWrapper = await mountAndWait(props);

    const bypass = alertWrapper.find('[data-test="bypass-cache"]');
    expect(bypass).not.toExist();
  });
});
