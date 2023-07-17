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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { bindActionCreators } from 'redux';

import { shallow } from 'enzyme';
import { Radio } from 'src/components/Radio';
import Button from 'src/components/Button';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';

import * as saveModalActions from 'src/explore/actions/saveModalActions';
import SaveModal, { StyledModal } from 'src/explore/components/SaveModal';
import { BrowserRouter } from 'react-router-dom';

const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const initialState = {
  chart: {},
  saveModal: {
    dashboards: [],
    isVisible: true,
  },
  explore: {
    datasource: {},
    slice: {
      slice_id: 1,
      slice_name: 'title',
      owners: [1],
    },
    alert: null,
  },
  user: {
    userId: 1,
  },
};

const initialStore = mockStore(initialState);

const defaultProps = {
  addDangerToast: jest.fn(),
  onHide: () => ({}),
  actions: bindActionCreators(saveModalActions, arg => {
    if (typeof arg === 'function') {
      return arg(jest.fn);
    }
    return arg;
  }),
  form_data: { datasource: '107__table', url_params: { foo: 'bar' } },
};

const mockEvent = {
  target: {
    value: 'mock event target',
  },
  value: 10,
};

const mockDashboardData = {
  pks: ['id'],
  result: [{ id: 'id', dashboard_title: 'dashboard title' }],
};

const queryStore = mockStore({
  chart: {},
  saveModal: {
    dashboards: [],
    isVisible: true,
  },
  explore: {
    datasource: { name: 'test', type: 'query' },
    slice: null,
    alert: null,
  },
  user: {
    userId: 1,
  },
});

const queryDefaultProps = {
  ...defaultProps,
  form_data: { datasource: '107__query', url_params: { foo: 'bar' } },
};

const fetchDashboardsEndpoint = `glob:*/dashboardasync/api/read?_flt_0_owners=${1}`;

beforeAll(() => fetchMock.get(fetchDashboardsEndpoint, mockDashboardData));

afterAll(() => fetchMock.restore());

const getWrapper = (props = defaultProps, store = initialStore) =>
  shallow(
    <BrowserRouter>
      <SaveModal {...props} store={store} />
    </BrowserRouter>,
  )
    .dive()
    .dive()
    .dive()
    .dive()
    .dive()
    .dive()
    .dive()
    .dive();

test('renders a Modal with the right set of components', () => {
  const wrapper = getWrapper();
  expect(wrapper.find(StyledModal)).toExist();
  expect(wrapper.find(Radio)).toHaveLength(2);

  const footerWrapper = shallow(wrapper.find(StyledModal).props().footer);

  expect(footerWrapper.find(Button)).toHaveLength(3);
});

test('renders the right footer buttons when existing dashboard selected', () => {
  const wrapper = getWrapper();
  const footerWrapper = shallow(wrapper.find(StyledModal).props().footer);
  const saveAndGoDash = footerWrapper
    .find('#btn_modal_save_goto_dash')
    .getElement();
  const save = footerWrapper.find('#btn_modal_save').getElement();
  expect(save.props.children).toBe('Save');
  expect(saveAndGoDash.props.children).toBe('Save & go to dashboard');
});

test('renders the right footer buttons when new dashboard selected', () => {
  const wrapper = getWrapper();
  wrapper.setState({
    dashboard: { label: 'Test new dashboard', value: 'Test new dashboard' },
  });
  const footerWrapper = shallow(wrapper.find(StyledModal).props().footer);
  const saveAndGoDash = footerWrapper
    .find('#btn_modal_save_goto_dash')
    .getElement();
  const save = footerWrapper.find('#btn_modal_save').getElement();
  expect(save.props.children).toBe('Save to new dashboard');
  expect(saveAndGoDash.props.children).toBe('Save & go to new dashboard');
});

test('disables overwrite option for new slice', () => {
  const wrapper = getWrapper();
  wrapper.setProps({ slice: null });
  expect(wrapper.find('#overwrite-radio').prop('disabled')).toBe(true);
});

test('disables overwrite option for non-owner', () => {
  const wrapperForNonOwner = getWrapper();
  wrapperForNonOwner.setProps({ userId: 2 });
  const overwriteRadio = wrapperForNonOwner.find('#overwrite-radio');
  expect(overwriteRadio).toHaveLength(1);
  expect(overwriteRadio.prop('disabled')).toBe(true);
});

test('sets action when saving as new slice', () => {
  const wrapperForNewSlice = getWrapper();
  wrapperForNewSlice.setProps({ can_overwrite: false });
  wrapperForNewSlice.instance().changeAction('saveas');
  const saveasRadio = wrapperForNewSlice.find('#saveas-radio');
  saveasRadio.simulate('click');
  expect(wrapperForNewSlice.state().action).toBe('saveas');
});

test('sets action when overwriting slice', () => {
  const wrapperForOverwrite = getWrapper();
  const overwriteRadio = wrapperForOverwrite.find('#overwrite-radio');
  overwriteRadio.simulate('click');
  expect(wrapperForOverwrite.state().action).toBe('overwrite');
});

test('updates slice name and selected dashboard', () => {
  const wrapper = getWrapper();
  const dashboardId = mockEvent.value;

  wrapper.instance().onSliceNameChange(mockEvent);
  expect(wrapper.state().newSliceName).toBe(mockEvent.target.value);

  wrapper.instance().onDashboardChange({ value: dashboardId });
  expect(wrapper.state().dashboard.value).toBe(dashboardId);
});

test('removes alert', () => {
  sinon.spy(defaultProps.actions, 'removeSaveModalAlert');
  const wrapper = getWrapper();
  wrapper.setProps({ alert: 'old alert' });

  wrapper.instance().removeAlert();
  expect(defaultProps.actions.removeSaveModalAlert.callCount).toBe(1);
  expect(wrapper.state().alert).toBeNull();
  defaultProps.actions.removeSaveModalAlert.restore();
});

test('set dataset name when chart source is query', () => {
  const wrapper = getWrapper(queryDefaultProps, queryStore);
  expect(wrapper.find('[data-test="new-dataset-name"]')).toExist();
  expect(wrapper.state().datasetName).toBe('test');
});
