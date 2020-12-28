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
import { FormControl, Radio } from 'react-bootstrap';
import Button from 'src/components/Button';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';

import * as exploreUtils from 'src/explore/exploreUtils';
import * as saveModalActions from 'src/explore/actions/saveModalActions';
import SaveModal, { StyledModal } from 'src/explore/components/SaveModal';

describe('SaveModal', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const initialState = {
    chart: {},
    saveModal: {
      dashboards: [],
    },
    explore: {
      can_overwrite: true,
      user_id: '1',
      datasource: {},
      slice: {
        slice_id: 1,
        slice_name: 'title',
      },
      alert: null,
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
    form_data: { datasource: '107__table' },
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

  const saveEndpoint = `glob:*/dashboardasync/api/read?_flt_0_owners=${1}`;

  beforeAll(() => fetchMock.get(saveEndpoint, mockDashboardData));

  afterAll(() => fetchMock.restore());

  const getWrapper = () =>
    shallow(<SaveModal {...defaultProps} store={store} />)
      .dive()
      .dive();

  it('renders a Modal with the right set of components', () => {
    const wrapper = getWrapper();
    expect(wrapper.find(StyledModal)).toExist();
    expect(wrapper.find(FormControl)).toExist();
    expect(wrapper.find(Radio)).toHaveLength(2);

    const footerWrapper = shallow(wrapper.find(StyledModal).props().footer);
    expect(footerWrapper.find(Button)).toHaveLength(3);
  });

  it('overwrite radio button is disabled for new slice', () => {
    const wrapper = getWrapper();
    wrapper.setProps({ slice: null });
    expect(wrapper.find('#overwrite-radio').prop('disabled')).toBe(true);
  });

  it('disable overwrite option for non-owner', () => {
    const wrapperForNonOwner = getWrapper();
    wrapperForNonOwner.setProps({ can_overwrite: false });
    const overwriteRadio = wrapperForNonOwner.find('#overwrite-radio');
    expect(overwriteRadio).toHaveLength(1);
    expect(overwriteRadio.prop('disabled')).toBe(true);
  });

  it('saves a new slice', () => {
    const wrapperForNewSlice = getWrapper();
    wrapperForNewSlice.setProps({ can_overwrite: false });
    wrapperForNewSlice.instance().changeAction('saveas');
    const saveasRadio = wrapperForNewSlice.find('#saveas-radio');
    saveasRadio.simulate('click');
    expect(wrapperForNewSlice.state().action).toBe('saveas');
  });

  it('overwrite a slice', () => {
    const wrapperForOverwrite = getWrapper();
    const overwriteRadio = wrapperForOverwrite.find('#overwrite-radio');
    overwriteRadio.simulate('click');
    expect(wrapperForOverwrite.state().action).toBe('overwrite');
  });

  it('componentDidMount', () => {
    sinon.spy(defaultProps.actions, 'fetchDashboards');
    mount(
      <Provider store={store}>
        <SaveModal {...defaultProps} />
      </Provider>,
    );
    expect(defaultProps.actions.fetchDashboards.calledOnce).toBe(true);

    defaultProps.actions.fetchDashboards.restore();
  });

  it('onChange', () => {
    const wrapper = getWrapper();

    wrapper.instance().onSliceNameChange(mockEvent);
    expect(wrapper.state().newSliceName).toBe(mockEvent.target.value);

    wrapper.instance().onDashboardSelectChange(mockEvent);
    expect(wrapper.state().saveToDashboardId).toBe(mockEvent.value);
  });

  describe('saveOrOverwrite', () => {
    beforeEach(() => {
      sinon.stub(exploreUtils, 'getExploreUrl').callsFake(() => 'mockURL');

      sinon.stub(defaultProps.actions, 'saveSlice').callsFake(() =>
        Promise.resolve({
          dashboard_url: 'http://localhost/mock_dashboard/',
          slice: { slice_url: '/mock_slice/' },
        }),
      );
    });

    afterEach(() => {
      exploreUtils.getExploreUrl.restore();
      defaultProps.actions.saveSlice.restore();
    });

    it('should save slice', () => {
      const wrapper = getWrapper();
      wrapper.instance().saveOrOverwrite(true);
      const { args } = defaultProps.actions.saveSlice.getCall(0);
      expect(args[0]).toEqual(defaultProps.form_data);
    });

    it('existing dashboard', () => {
      const wrapper = getWrapper();
      const saveToDashboardId = 100;

      wrapper.setState({ saveToDashboardId });
      wrapper.instance().saveOrOverwrite(true);
      const { args } = defaultProps.actions.saveSlice.getCall(0);
      expect(args[1].save_to_dashboard_id).toBe(saveToDashboardId);
    });

    it('new dashboard', () => {
      const wrapper = getWrapper();
      const newDashboardName = 'new dashboard name';

      wrapper.setState({ newDashboardName });
      wrapper.instance().saveOrOverwrite(true);
      const { args } = defaultProps.actions.saveSlice.getCall(0);
      expect(args[1].new_dashboard_name).toBe(newDashboardName);
    });

    describe('should always reload or redirect', () => {
      const originalLocation = window.location;
      delete window.location;
      window.location = { assign: jest.fn() };
      const stub = sinon.stub(window.location, 'assign');

      afterAll(() => {
        delete window.location;
        window.location = originalLocation;
      });

      let wrapper;

      beforeEach(() => {
        stub.resetHistory();
        wrapper = getWrapper();
      });

      it('Save & go to dashboard', () =>
        new Promise(done => {
          wrapper.instance().saveOrOverwrite(true);
          defaultProps.actions.saveSlice().then(() => {
            expect(window.location.assign.callCount).toEqual(1);
            expect(window.location.assign.getCall(0).args[0]).toEqual(
              'http://localhost/mock_dashboard/',
            );
            done();
          });
        }));

      it('saveas new slice', () =>
        new Promise(done => {
          wrapper.setState({
            action: 'saveas',
            newSliceName: 'new slice name',
          });
          wrapper.instance().saveOrOverwrite(false);
          defaultProps.actions.saveSlice().then(() => {
            expect(window.location.assign.callCount).toEqual(1);
            expect(window.location.assign.getCall(0).args[0]).toEqual(
              '/mock_slice/',
            );
            done();
          });
        }));

      it('overwrite original slice', () =>
        new Promise(done => {
          wrapper.setState({ action: 'overwrite' });
          wrapper.instance().saveOrOverwrite(false);
          defaultProps.actions.saveSlice().then(() => {
            expect(window.location.assign.callCount).toEqual(1);
            expect(window.location.assign.getCall(0).args[0]).toEqual(
              '/mock_slice/',
            );
            done();
          });
        }));
    });
  });

  describe('fetchDashboards', () => {
    let dispatch;
    let actionThunk;
    const userID = 1;

    beforeEach(() => {
      fetchMock.resetHistory();
      dispatch = sinon.spy();
    });

    const makeRequest = () => {
      actionThunk = saveModalActions.fetchDashboards(userID);
      return actionThunk(dispatch);
    };

    it('makes the fetch request', () =>
      makeRequest().then(() => {
        expect(fetchMock.calls(saveEndpoint)).toHaveLength(1);

        return Promise.resolve();
      }));

    it('calls correct actions on success', () =>
      makeRequest().then(() => {
        expect(dispatch.callCount).toBe(1);
        expect(dispatch.getCall(0).args[0].type).toBe(
          saveModalActions.FETCH_DASHBOARDS_SUCCEEDED,
        );

        return Promise.resolve();
      }));

    it('calls correct actions on error', () => {
      fetchMock.get(
        saveEndpoint,
        { throws: 'error' },
        { overwriteRoutes: true },
      );

      return makeRequest().then(() => {
        expect(dispatch.callCount).toBe(1);
        expect(dispatch.getCall(0).args[0].type).toBe(
          saveModalActions.FETCH_DASHBOARDS_FAILED,
        );

        fetchMock.get(saveEndpoint, mockDashboardData, {
          overwriteRoutes: true,
        });

        return Promise.resolve();
      });
    });
  });

  it('removeAlert', () => {
    sinon.spy(defaultProps.actions, 'removeSaveModalAlert');
    const wrapper = getWrapper();
    wrapper.setProps({ alert: 'old alert' });

    wrapper.instance().removeAlert();
    expect(defaultProps.actions.removeSaveModalAlert.callCount).toBe(1);
    expect(wrapper.state().alert).toBeNull();
    defaultProps.actions.removeSaveModalAlert.restore();
  });
});
