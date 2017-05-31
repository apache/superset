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

describe('runQuery', () => {
  it('should handle query timeout', () => {
    const dispatch = sinon.spy();
    const urlStub = sinon.stub(exploreUtils, 'getExploreUrl').callsFake(() => ('mockURL'));
    const ajaxStub = sinon.stub($, 'ajax');
    ajaxStub.yieldsTo('error', { statusText: 'timeout' });

    const request = actions.runQuery({});
    request(dispatch);

    expect(dispatch.callCount).to.equal(2);
    expect(dispatch.args[0][0].type).to.equal(actions.CHART_UPDATE_TIMEOUT);

    urlStub.restore();
    ajaxStub.restore();
  });
});
