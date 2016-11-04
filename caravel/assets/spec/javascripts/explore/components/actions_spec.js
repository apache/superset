import { it, describe } from 'mocha';
import { expect } from 'chai';
import * as actions from '../../../../javascripts/explorev2/actions/exploreActions';
import { initialState } from '../../../../javascripts/explorev2/stores/store';
import { exploreReducer } from '../../../../javascripts/explorev2/reducers/exploreReducer';

describe('reducers', () => {
  it('set form data', () => {
    const newState = exploreReducer(initialState, actions.setFormData('x_axis_label', 'x'));
    expect(newState.viz.form_data.x_axis_label).to.equal('x');
  });
});
