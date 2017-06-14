import { it, describe } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import $ from 'jquery';
import * as actions from '../../../javascripts/explore/actions/exploreActions';
import * as exploreUtils from '../../../javascripts/explore/exploreUtils';
import { defaultState } from '../../../javascripts/explore/stores/store';
import { exploreReducer } from '../../../javascripts/explore/reducers/exploreReducer';

describe('reducers', () => {
  it('sets correct control value given a key and value', () => {
    const newState = exploreReducer(
      defaultState, actions.setControlValue('x_axis_label', 'x', []));
    expect(newState.controls.x_axis_label.value).to.equal('x');
  });
  it('setControlValue works as expected with a checkbox', () => {
    const newState = exploreReducer(defaultState,
      actions.setControlValue('show_legend', true, []));
    expect(newState.controls.show_legend.value).to.equal(true);
  });
});

describe('fetchDatasourceMetadata', () => {
  let datasourceKey = '1__table';
  let dispatch;
  let request;
  let ajaxSpy;

  let makeRequest = () => {
    request = actions.fetchDatasourceMetadata(datasourceKey);
    request(dispatch);
  };

  beforeEach(() => {
    dispatch = sinon.spy();
    ajaxSpy = sinon.spy($, 'ajax');
  });
  afterEach(() => {
    ajaxSpy.restore();
  });

  it('calls fetchDatasourceStarted', () => {
    makeRequest();
    expect(dispatch.args[0][0].type).to.equal(actions.FETCH_DATASOURCE_STARTED);
  });

  it('makes the ajax request', () => {
    makeRequest();
    expect(ajaxSpy.calledOnce).to.be.true;
  });
});

describe('fetchDatasources', () => {

});

describe('fetchFaveStar', () => {

});

describe('saveFaveStar', () => {

});

describe('fetchDashboards', () => {

});

describe('fetchDashboards', () => {

});

describe('saveSlice', () => {

});

describe('runQuery', () => {
  let dispatch;
  let urlStub;
  let ajaxStub;
  let request;

  beforeEach(() => {
    dispatch = sinon.spy();
    urlStub = sinon.stub(exploreUtils, 'getExploreUrl').callsFake(() => ('mockURL'));
    ajaxStub = sinon.stub($, 'ajax');
  });

  afterEach(() => {
    urlStub.restore();
    ajaxStub.restore();
  });

  it('should handle query timeout', () => {
    ajaxStub.yieldsTo('error', { statusText: 'timeout' });
    request = actions.runQuery({});
    request(dispatch);
    expect(dispatch.callCount).to.equal(2);
    expect(dispatch.args[0][0].type).to.equal(actions.CHART_UPDATE_TIMEOUT);
  });
});
