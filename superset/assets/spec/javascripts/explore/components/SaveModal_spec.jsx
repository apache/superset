import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { expect } from 'chai';
import { describe, it, afterEach, beforeEach, before, after } from 'mocha';
import { shallow, mount } from 'enzyme';
import { Modal, Button, Radio } from 'react-bootstrap';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';

import * as exploreUtils from '../../../../src/explore/exploreUtils';
import * as saveModalActions from '../../../../src/explore/actions/saveModalActions';
import SaveModal from '../../../../src/explore/components/SaveModal';
import setupSupersetClient from '../../../helpers/setupSupersetClient';

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
    actions: saveModalActions,
    form_data: { datasource: '107__table' },
  };
  const mockEvent = {
    target: {
      value: 'mock event target',
    },
    value: 'mock value',
  };

  const getWrapper = () =>
    shallow(<SaveModal {...defaultProps} />, {
      context: { store },
    }).dive();

  it('renders a Modal with 7 inputs and 2 buttons', () => {
    const wrapper = getWrapper();
    expect(wrapper.find(Modal)).to.have.lengthOf(1);
    expect(wrapper.find('input')).to.have.lengthOf(2);
    expect(wrapper.find(Button)).to.have.lengthOf(2);
    expect(wrapper.find(Radio)).to.have.lengthOf(5);
  });

  it('does not show overwrite option for new slice', () => {
    const wrapperNewSlice = getWrapper();
    wrapperNewSlice.setProps({ slice: null });
    expect(wrapperNewSlice.find('#overwrite-radio')).to.have.lengthOf(0);
    expect(wrapperNewSlice.find('#saveas-radio')).to.have.lengthOf(1);
  });

  it('disable overwrite option for non-owner', () => {
    const wrapperForNonOwner = getWrapper();
    wrapperForNonOwner.setProps({ can_overwrite: false });
    const overwriteRadio = wrapperForNonOwner.find('#overwrite-radio');
    expect(overwriteRadio).to.have.lengthOf(1);
    expect(overwriteRadio.prop('disabled')).to.equal(true);
  });

  it('saves a new slice', () => {
    const wrapperForNewSlice = getWrapper();
    wrapperForNewSlice.setProps({ can_overwrite: false });
    wrapperForNewSlice.instance().changeAction('saveas');
    const saveasRadio = wrapperForNewSlice.find('#saveas-radio');
    saveasRadio.simulate('click');
    expect(wrapperForNewSlice.state().action).to.equal('saveas');
  });

  it('overwrite a slice', () => {
    const wrapperForOverwrite = getWrapper();
    const overwriteRadio = wrapperForOverwrite.find('#overwrite-radio');
    overwriteRadio.simulate('click');
    expect(wrapperForOverwrite.state().action).to.equal('overwrite');
  });

  it('componentDidMount', () => {
    sinon.spy(SaveModal.prototype, 'componentDidMount');
    sinon.spy(saveModalActions, 'fetchDashboards');
    mount(<SaveModal {...defaultProps} />, {
      context: { store },
    });
    expect(SaveModal.prototype.componentDidMount.calledOnce).to.equal(true);
    expect(saveModalActions.fetchDashboards.calledOnce).to.equal(true);

    SaveModal.prototype.componentDidMount.restore();
    saveModalActions.fetchDashboards.restore();
  });

  it('onChange', () => {
    const wrapper = getWrapper();

    wrapper.instance().onChange('newSliceName', mockEvent);
    expect(wrapper.state().newSliceName).to.equal(mockEvent.target.value);

    wrapper.instance().onChange('saveToDashboardId', mockEvent);
    expect(wrapper.state().saveToDashboardId).to.equal(mockEvent.value);

    wrapper.instance().onChange('newDashboardName', mockEvent);
    expect(wrapper.state().newDashboardName).to.equal(mockEvent.target.value);
  });

  describe('saveOrOverwrite', () => {
    beforeEach(() => {
      // this must be non-null when saveOrOverwrite(gotodash = true) is called
      Object.defineProperty(window.location, 'origin', {
        writable: true,
        value: 'http://localhost',
      });

      sinon
        .stub(exploreUtils, 'getExploreUrlAndPayload')
        .callsFake(() => ({ url: 'mockURL', payload: defaultProps.form_data }));

      sinon
        .stub(saveModalActions, 'saveSlice')
        .callsFake(() =>
          Promise.resolve({ data: { dashboard: '/mock/', slice: { slice_url: '/mock/' } } }),
        );
    });

    afterEach(() => {
      Object.defineProperty(window.location, 'origin', {
        writable: true,
        value: null,
      });
      exploreUtils.getExploreUrlAndPayload.restore();
      saveModalActions.saveSlice.restore();
    });

    it('should save slice', () => {
      const wrapper = getWrapper();
      wrapper.instance().saveOrOverwrite(true);
      const args = saveModalActions.saveSlice.getCall(0).args;
      expect(args[0]).to.deep.equal(defaultProps.form_data);
    });

    it('existing dashboard', () => {
      const wrapper = getWrapper();
      const saveToDashboardId = 100;

      wrapper.setState({ addToDash: 'existing' });
      wrapper.instance().saveOrOverwrite(true);
      expect(wrapper.state().alert).to.equal('Please select a dashboard');

      wrapper.setState({ saveToDashboardId });
      wrapper.instance().saveOrOverwrite(true);
      const args = saveModalActions.saveSlice.getCall(0).args;
      expect(args[1].save_to_dashboard_id).to.equal(saveToDashboardId);
    });

    it('new dashboard', () => {
      const wrapper = getWrapper();
      const newDashboardName = 'new dashboard name';

      wrapper.setState({ addToDash: 'new' });
      wrapper.instance().saveOrOverwrite(true);
      expect(wrapper.state().alert).to.equal('Please enter a dashboard name');

      wrapper.setState({ newDashboardName });
      wrapper.instance().saveOrOverwrite(true);
      const args = saveModalActions.saveSlice.getCall(0).args;
      expect(args[1].new_dashboard_name).to.equal(newDashboardName);
    });
  });

  describe('fetchDashboards', () => {
    let dispatch;
    let actionThunk;
    const userID = 1;

    const mockDashboardData = {
      pks: ['id'],
      result: [{ id: 'id', dashboard_title: 'dashboard title' }],
    };

    const saveEndpoint = `glob:*/dashboardasync/api/read?_flt_0_owners=${1}`;

    before(() => {
      setupSupersetClient();
      fetchMock.get(saveEndpoint, mockDashboardData);
    });

    after(fetchMock.restore);

    beforeEach(() => {
      dispatch = sinon.spy();
    });

    afterEach(() => {
      fetchMock.resetHistory();
    });

    const makeRequest = () => {
      actionThunk = saveModalActions.fetchDashboards(userID);
      return actionThunk(dispatch);
    };

    it('makes the fetch request', (done) => {
      makeRequest().then(() => {
        expect(fetchMock.calls(saveEndpoint)).to.have.lengthOf(1);
        done();
      });
    });

    it('calls correct actions on success', (done) => {
      makeRequest().then(() => {
        expect(dispatch.callCount).to.equal(1);
        expect(dispatch.getCall(0).args[0].type).to.equal(
          saveModalActions.FETCH_DASHBOARDS_SUCCEEDED,
        );
        done();
      });
    });

    it('calls correct actions on error', (done) => {
      fetchMock.get(saveEndpoint, { throws: 'error' }, { overwriteRoutes: true });

      makeRequest().then(() => {
        expect(dispatch.callCount).to.equal(1);
        expect(dispatch.getCall(0).args[0].type).to.equal(saveModalActions.FETCH_DASHBOARDS_FAILED);

        fetchMock.get(saveEndpoint, mockDashboardData, { overwriteRoutes: true });
        done();
      });
    });
  });

  it('removeAlert', () => {
    sinon.spy(saveModalActions, 'removeSaveModalAlert');
    const wrapper = getWrapper();
    wrapper.setProps({ alert: 'old alert' });

    wrapper.instance().removeAlert();
    expect(saveModalActions.removeSaveModalAlert.callCount).to.equal(1);
    expect(wrapper.state().alert).to.be.a('null');
    saveModalActions.removeSaveModalAlert.restore();
  });
});
