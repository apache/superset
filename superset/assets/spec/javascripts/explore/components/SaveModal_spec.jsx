import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { Modal, Button, Radio } from 'react-bootstrap';
import sinon from 'sinon';

import * as actions from '../../../../javascripts/explore/actions/saveModalActions';
import { SaveModal } from '../../../../javascripts/explore/components/SaveModal';

const $ = window.$ = require('jquery');

describe('SaveModal', () => {
  let wrapper;
  const defaultProps = {
    can_edit: true,
    onHide: () => ({}),
    actions: {
      saveSlice: sinon.spy(),
      fetchDashboards: sinon.spy(),
    },
    form_data: {},
    user_id: '1',
    dashboards: [],
    slice: {},
  };

  beforeEach(() => {
    wrapper = shallow(<SaveModal {...defaultProps} />);
  });

  it('renders a Modal with 7 inputs and 2 buttons', () => {
    expect(wrapper.find(Modal)).to.have.lengthOf(1);
    expect(wrapper.find('input')).to.have.lengthOf(2);
    expect(wrapper.find(Button)).to.have.lengthOf(2);
    expect(wrapper.find(Radio)).to.have.lengthOf(5);
  });

  it('does not show overwrite option for new slice', () => {
    defaultProps.slice = null;
    const wrapperNewSlice = shallow(<SaveModal {...defaultProps} />);
    expect(wrapperNewSlice.find('#overwrite-radio')).to.have.lengthOf(0);
    expect(wrapperNewSlice.find('#saveas-radio')).to.have.lengthOf(1);
  });

  it('disable overwrite option for non-owner', () => {
    defaultProps.slice = {};
    defaultProps.can_overwrite = false;
    const wrapperForNonOwner = shallow(<SaveModal {...defaultProps} />);
    const overwriteRadio = wrapperForNonOwner.find('#overwrite-radio');
    expect(overwriteRadio).to.have.lengthOf(1);
    expect(overwriteRadio.prop('disabled')).to.equal(true);
  });

  it('saves a new slice', () => {
    defaultProps.slice = {
      slice_id: 1,
      slice_name: 'title',
    };
    defaultProps.can_overwrite = false;
    const wrapperForNewSlice = shallow(<SaveModal {...defaultProps} />);
    const saveasRadio = wrapperForNewSlice.find('#saveas-radio');
    saveasRadio.simulate('click');
    expect(wrapperForNewSlice.state().action).to.equal('saveas');
  });

  it('overwrite a slice', () => {
    defaultProps.slice = {
      slice_id: 1,
      slice_name: 'title',
    };
    defaultProps.can_overwrite = true;
    const wrapperForOverwrite = shallow(<SaveModal {...defaultProps} />);
    const overwriteRadio = wrapperForOverwrite.find('#overwrite-radio');
    overwriteRadio.simulate('click');
    expect(wrapperForOverwrite.state().action).to.equal('overwrite');
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
      request = actions.fetchDashboards(userID);
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
      expect(dispatch.getCall(0).args[0].type).to.equal(actions.FETCH_DASHBOARDS_FAILED);
    });

    it('calls correct actions on success', () => {
      ajaxStub.yieldsTo('success', mockDashboardData);
      makeRequest();
      expect(dispatch.callCount).to.equal(1);
      expect(dispatch.getCall(0).args[0].type).to.equal(actions.FETCH_DASHBOARDS_SUCCEEDED);
    });
  });
});
