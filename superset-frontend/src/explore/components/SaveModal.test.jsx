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
import { Provider } from 'react-redux';

import { shallow } from 'enzyme';
import { styledMount as mount } from 'spec/helpers/theming';
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

const store = mockStore(initialState);

const defaultProps = {
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

const fetchDashboardsEndpoint = `glob:*/dashboardasync/api/read?_flt_0_owners=${1}`;

beforeAll(() => fetchMock.get(fetchDashboardsEndpoint, mockDashboardData));

afterAll(() => fetchMock.restore());

const getWrapper = () =>
  shallow(
    <BrowserRouter>
      <SaveModal {...defaultProps} store={store} />
    </BrowserRouter>,
  )
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
    saveToDashboardId: null,
    newDashboardName: 'Test new dashboard',
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

test('fetches dashboards on component mount', () => {
  sinon.spy(defaultProps.actions, 'fetchDashboards');
  mount(
    <Provider store={store}>
      <SaveModal {...defaultProps} />
    </Provider>,
  );
  expect(defaultProps.actions.fetchDashboards.calledOnce).toBe(true);

  defaultProps.actions.fetchDashboards.restore();
});

test('updates slice name and selected dashboard', () => {
  const wrapper = getWrapper();
  const dashboardId = mockEvent.value;

  wrapper.instance().onSliceNameChange(mockEvent);
  expect(wrapper.state().newSliceName).toBe(mockEvent.target.value);

  wrapper.instance().onDashboardSelectChange(dashboardId);
  expect(wrapper.state().saveToDashboardId).toBe(dashboardId);
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
