import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow, mount } from 'enzyme';
import { Modal, Button, Radio } from 'react-bootstrap';
import sinon from 'sinon';

import * as exploreUtils from '../../../../javascripts/explore/exploreUtils';
import * as saveModalActions from '../../../../javascripts/explore/actions/saveModalActions';
import SaveModal from '../../../../javascripts/explore/components/SaveModal';

const $ = window.$ = require('jquery');

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
    form_data: {},
  };
  const mockEvent = {
    target: {
      value: 'mock event target',
    },
    value: 'mock value',
  };
  const getWrapper = () => (shallow(<SaveModal {...defaultProps} />, {
    context: { store },
  }).dive());

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
      sinon.stub(exploreUtils, 'getExploreUrl').callsFake(() => ('mockURL'));
      sinon.stub(saveModalActions, 'saveSlice').callsFake(() => {
        const d = $.Deferred();
        d.resolve('done');
        return d.promise();
      });
    });
    afterEach(() => {
      exploreUtils.getExploreUrl.restore();
      saveModalActions.saveSlice.restore();
    });

    it('should save slice', () => {
      const wrapper = getWrapper();
      wrapper.instance().saveOrOverwrite(true);
      expect(saveModalActions.saveSlice.getCall(0).args[0]).to.equal('mockURL');
    });
    it('existing dashboard', () => {
      const wrapper = getWrapper();
      const saveToDashboardId = 100;

      wrapper.setState({ addToDash: 'existing' });
      wrapper.instance().saveOrOverwrite(true);
      expect(wrapper.state().alert).to.equal('Please select a dashboard');

      wrapper.setState({ saveToDashboardId });
      wrapper.instance().saveOrOverwrite(true);
      const args = exploreUtils.getExploreUrl.getCall(0).args;
      expect(args[4].save_to_dashboard_id).to.equal(saveToDashboardId);
    });
    it('new dashboard', () => {
      const wrapper = getWrapper();
      const newDashboardName = 'new dashboard name';

      wrapper.setState({ addToDash: 'new' });
      wrapper.instance().saveOrOverwrite(true);
      expect(wrapper.state().alert).to.equal('Please enter a dashboard name');

      wrapper.setState({ newDashboardName });
      wrapper.instance().saveOrOverwrite(true);
      const args = exploreUtils.getExploreUrl.getCall(0).args;
      expect(args[4].new_dashboard_name).to.equal(newDashboardName);
    });
  });

  describe('should fetchDashboards', () => {
    let dispatch;
    let request;
    let ajaxStub;
    const userID = 1;
    beforeEach(() => {
      dispatch = sinon.spy();
      ajaxStub = sinon.stub($, 'ajax');
    });
    afterEach(() => {
      ajaxStub.restore();
    });
    const mockDashboardData = {
      pks: ['value'],
      result: [
        { dashboard_title: 'dashboard title' },
      ],
    };
    const makeRequest = () => {
      request = saveModalActions.fetchDashboards(userID);
      request(dispatch);
    };

    it('makes the ajax request', () => {
      makeRequest();
      expect(ajaxStub.callCount).to.equal(1);
    });

    it('calls correct url', () => {
      const url = '/dashboardmodelviewasync/api/read?_flt_0_owners=' + userID;
      makeRequest();
      expect(ajaxStub.getCall(0).args[0].url).to.be.equal(url);
    });

    it('calls correct actions on error', () => {
      ajaxStub.yieldsTo('error', { responseJSON: { error: 'error text' } });
      makeRequest();
      expect(dispatch.callCount).to.equal(1);
      expect(dispatch.getCall(0).args[0].type).to.equal(saveModalActions.FETCH_DASHBOARDS_FAILED);
    });

    it('calls correct actions on success', () => {
      ajaxStub.yieldsTo('success', mockDashboardData);
      makeRequest();
      expect(dispatch.callCount).to.equal(1);
      expect(dispatch.getCall(0).args[0].type)
        .to.equal(saveModalActions.FETCH_DASHBOARDS_SUCCEEDED);
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
