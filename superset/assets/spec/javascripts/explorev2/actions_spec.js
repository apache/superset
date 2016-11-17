import { it, describe } from 'mocha';
import { expect } from 'chai';
import * as actions from '../../../javascripts/explorev2/actions/exploreActions';
import { initialState } from '../../../javascripts/explorev2/stores/store';
import { exploreReducer } from '../../../javascripts/explorev2/reducers/exploreReducer';

describe('reducers', () => {
  it('sets correct field value given a key and value', () => {
    const newState = exploreReducer(
      initialState('dist_bar'), actions.setFieldValue('x_axis_label', 'x'));
    expect(newState.viz.form_data.x_axis_label).to.equal('x');
  });
  it('toggles a boolean field value given only a key', () => {
    const newState = exploreReducer(initialState('dist_bar'), actions.setFieldValue('show_legend'));
    expect(newState.viz.form_data.show_legend).to.equal(false);
  });
});
