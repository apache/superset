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
import FlashType from 'src/views/CRUD/flash/components/FlashType/FlashType';
import { Provider } from 'react-redux';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { styledMount as mount } from 'spec/helpers/theming';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import Modal from 'src/components/Modal';
import SchemaForm from 'react-jsonschema-form';

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(
  appContainer?.getAttribute('data-bootstrap') || '{}',
);
const flashTypeConf = bootstrapData?.common?.conf?.FLASH_TYPE;

const getJSONSchema = () => {
  const jsonSchema = flashTypeConf?.JSONSCHEMA;
  return jsonSchema;
};

const FLASH_TYPE = {

  "JSONSCHEMA": {
    "type": "object",
    "properties": {
      "flashType": {
        "title": "Flash Type",
        "type": "string",
        "enum": ["", "One Time", "Short Term", "Long Term"],
        "enumNames": [
          "Please Select",
          "One Time (Valid upto 7 days)",
          "Short Term (Valid upto 7 days)",
          "Long Term (Valid upto 90 days)",
        ],
        "default": "Please Select",
      },
    },
    "required": [
      "flashType"
    ],
    "dependencies": {
      "flashType": {
        "oneOf": [
          {
            "properties": {
              "flashType": { "enum": ["Long Term"] },
              "teamSlackChannel": {
                "type": "string",
                "title": "Slack Channel",
                "pattern": "^(#)[A-Za-z0-9_-]+$",
              },
              "teamSlackHandle": {
                "type": "string",
                "title": "Slack Handle",
                "pattern": "^(@)[A-Za-z0-9_-\\s]+$",
              },
              "scheduleType": {
                "title": "Schedule Type",
                "type": "string",
                "enum": ["", "Hourly", "Daily", "Weekly", "Monthly"],
                "enumNames": [
                  "Please Select",
                  "Hourly",
                  "Daily",
                  "Weekly",
                  "Monthly",
                ],
                "default": "Please Select",
              },
              "scheduleStartTime": {
                "type": "string",
                "title": "Schedule Start Time (In UTC)",
                "format": "date-time",
              },
            },
            "required": [
              "teamSlackChannel",
              "teamSlackHandle",
              "scheduleType",
              "scheduleStartTime"
            ],
          },
          {
            "properties": {
              "flashType": { "enum": ["Short Term"] },
              "scheduleType": {
                "title": "Schedule Type",
                "type": "string",
                "enum": ["", "Hourly", "Daily", "Weekly", "Monthly"],
                "enumNames": [
                  "Please Select",
                  "Hourly",
                  "Daily",
                  "Weekly",
                  "Monthly",
                ],
                "default": "Please Select",
              },
              "scheduleStartTime": {
                "type": "string",
                "title": "Schedule Start Time (In UTC)",
                "format": "date-time",
              },
            },
            "required": ["scheduleType", "scheduleStartTime"],
          },
        ]
      }
    },
  },
  "UISCHEMA": {
    "ui:order": [
      "flashType",
      "*"
    ],
    "teamSlackChannel": {
      "ui:placeholder": "#slack_channel_name",
      "ui:help": "Slack channel for notification",
    },
    "teamSlackHandle": {
      "ui:placeholder": "@slack_handle_name",
      "ui:help": "Slack handle for notification",
    },
    "scheduleType": { "ui:help": "Schedule type for the Flash object" },
    "scheduleStartTime": {
      "ui:help": "Start time from which the flash object is to be scheduled."
    },
  },
  "VALIDATION": [],
}

const mockFlash = {
  flashType: 'ShortTerm',
  teamSlackHandle: '@abc',
  teamSlackChannel: '#abc',
  ttl: '2023-03-01',
  scheduleType: 'Daily',
  scheduleSratTime: '2023-05-31 12:59:00',
};


const mockedProps = {
  addDangerToast: () => { },
  addSuccessToast: () => { },
  onHide: () => { },
  refreshData: () => { },
  flash: mockFlash,
  show: true,
  // flashSchema: FLASH_TYPE.JSONSCHEMA
};
const mockStore = configureStore([thunk]);
const store = mockStore({});

async function mountAndWait(props = mockedProps) {
  const mounted = mount(
    <Provider store={store}>
      <FlashType show  {...props} />
    </Provider>,
  );

  let app

  await waitForComponentToPaint(mounted);

  return mounted;
}

describe('FlashType', () => {
  let wrapper;
  beforeAll(async () => {
    wrapper = await mountAndWait();
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

  it('For Flash Type: SHORT TERM, Following conditional controls should appear:  Schedule Type and Schedule Start Time', async () => {
    const schemaForm = wrapper.find(SchemaForm)
    let flashDropdown = schemaForm.find('select[id="root_flashType"]')
    expect(flashDropdown.props().value).toEqual("Short Term")
    const scheduleTypeControl = schemaForm.find('select[id="root_scheduleType"]')
    expect(scheduleTypeControl.exists()).toBe(true);
    const scheduleTimeControl = schemaForm.find('input[id="root_scheduleStartTime"]')
    expect(scheduleTimeControl.exists()).toBe(true);
  });


});
