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
import FlashType from 'src/views/CRUD/flash/components/FlashType/FlashType';
import { Provider } from 'react-redux';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { styledMount as mount } from 'spec/helpers/theming';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import Modal from 'src/components/Modal';
import SchemaForm from 'react-jsonschema-form';
import { FLASH_TYPE_JSON } from '../../constants';

const mockFlash = {
  flashType: 'ShortTerm',
  teamSlackHandle: '@abc',
  teamSlackChannel: '#abc',
  ttl: '2023-03-01',
  scheduleType: 'Daily',
  scheduleSratTime: '2023-05-31 12:59:00',
};

const mockedProps = {
  addDangerToast: () => {},
  addSuccessToast: () => {},
  onHide: () => {},
  refreshData: () => {},
  flash: mockFlash,
  show: true,
};
const mockStore = configureStore([thunk]);
const store = mockStore({});

async function mountAndWait(props = mockedProps) {
  const mounted = mount(
    <Provider store={store}>
      <FlashType show {...props} />
    </Provider>,
    {
      context: { store },
    },
  );
  await waitForComponentToPaint(mounted);
  return mounted;
}

describe('FlashType', () => {
  let wrapper;
  beforeAll(async () => {
    wrapper = await mountAndWait();
  });

  it('should render with the correct flashTypeConf', async () => {
    expect(wrapper.find(SchemaForm).prop('schema')).toEqual(
      FLASH_TYPE_JSON.JSONSCHEMA,
    );
  });

  it('The component should render', () => {
    expect(wrapper.find(FlashType)).toExist();
  });

  it('The modal inside flash type should be rendered', () => {
    expect(wrapper.find(Modal)).toExist();
  });

  it('The schema form inside flash type should be rendered', () => {
    expect(wrapper.find(SchemaForm)).toExist();
  });

  it('renders header for flash type modal', async () => {
    expect(wrapper.find('[data-test="flash-type-modal-title"]').text()).toEqual(
      'Update Flash Type',
    );
  });

  it('For Flash Type: SHORT TERM, Following conditional controls should appear: SCHEDULE TYPE, SCHEDULE START TIME', async () => {
    const schemaForm = wrapper.find(SchemaForm);
    const flashDropdown = schemaForm.find('select[id="root_flashType"]');
    expect(flashDropdown.props().value).toEqual('Short Term');
    const scheduleTypeControl = schemaForm.find(
      'select[id="root_scheduleType"]',
    );
    expect(scheduleTypeControl.exists()).toBe(true);
    const scheduleTimeControl = schemaForm.find(
      'input[id="root_scheduleStartTime"]',
    );
    expect(scheduleTimeControl.exists()).toBe(true);
    const slackChannelControl = schemaForm.find(
      'input[id="root_teamSlackChannel"]',
    );
    expect(slackChannelControl.exists()).toBe(false);
    const slackHandleControl = schemaForm.find(
      'input[id="root_teamSlackHandle"]',
    );
    expect(slackHandleControl.exists()).toBe(false);
  });

  it('For Flash Type: ONE TIME, Following conditional controls should appear:  None', async () => {
    const props = {
      ...mockedProps,
    };
    props.flash.flashType = 'OneTime';
    const updatedWrapper = await mountAndWait(props);
    const schemaForm = updatedWrapper.find(SchemaForm);
    const flashDropdown = schemaForm.find('select[id="root_flashType"]');
    expect(flashDropdown.props().value).toEqual('One Time');
    const scheduleTypeControl = schemaForm.find(
      'select[id="root_scheduleType"]',
    );
    expect(scheduleTypeControl.exists()).toBe(false);
    const scheduleTimeControl = schemaForm.find(
      'input[id="root_scheduleStartTime"]',
    );
    expect(scheduleTimeControl.exists()).toBe(false);
    const slackChannelControl = schemaForm.find(
      'input[id="root_teamSlackChannel"]',
    );
    expect(slackChannelControl.exists()).toBe(false);
    const slackHandleControl = schemaForm.find(
      'input[id="root_teamSlackHandle"]',
    );
    expect(slackHandleControl.exists()).toBe(false);
  });

  it('For Flash Type: LONG TERM, Following conditional controls should appear: SCHEDULE TYPE, SCHEDULE START TIME, SLACK CHANNEL, SLACK HANDLE', async () => {
    const props = {
      ...mockedProps,
    };
    props.flash.flashType = 'LongTerm';
    const updatedWrapper = await mountAndWait(props);
    const schemaForm = updatedWrapper.find(SchemaForm);
    const flashDropdown = schemaForm.find('select[id="root_flashType"]');
    expect(flashDropdown.props().value).toEqual('Long Term');
    const scheduleTypeControl = schemaForm.find(
      'select[id="root_scheduleType"]',
    );
    expect(scheduleTypeControl.exists()).toBe(true);
    const scheduleTimeControl = schemaForm.find(
      'input[id="root_scheduleStartTime"]',
    );
    expect(scheduleTimeControl.exists()).toBe(true);
    const slackChannelControl = schemaForm.find(
      'input[id="root_teamSlackChannel"]',
    );
    expect(slackChannelControl.exists()).toBe(true);
    const slackHandleControl = schemaForm.find(
      'input[id="root_teamSlackHandle"]',
    );
    expect(slackHandleControl.exists()).toBe(true);
  });
});
