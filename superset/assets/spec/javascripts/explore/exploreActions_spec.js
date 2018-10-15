/* eslint-disable no-unused-expressions */
import { defaultState } from '../../../src/explore/store';
import exploreReducer from '../../../src/explore/reducers/exploreReducer';
import * as actions from '../../../src/explore/actions/exploreActions';

describe('reducers', () => {
  it('sets correct control value given a key and value', () => {
    const newState = exploreReducer(
      defaultState, actions.setControlValue('x_axis_label', 'x', []));
    expect(newState.controls.x_axis_label.value).toBe('x');
  });
  it('setControlValue works as expected with a checkbox', () => {
    const newState = exploreReducer(defaultState,
      actions.setControlValue('show_legend', true, []));
    expect(newState.controls.show_legend.value).toBe(true);
  });
});
