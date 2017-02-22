import { it, describe } from 'mocha';
import { expect } from 'chai';
import * as actions from '../../../javascripts/explorev2/actions/exploreActions';
import { defaultState } from '../../../javascripts/explorev2/stores/store';
import { exploreReducer } from '../../../javascripts/explorev2/reducers/exploreReducer';

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
