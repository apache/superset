import { describe, it } from 'mocha';
import { expect } from 'chai';

import { dashboard as reducers } from '../../../javascripts/dashboard/reducers';
import * as actions from '../../../javascripts/dashboard/actions';
import { defaultFilters, dashboard as initState } from './fixtures';

describe('Dashboard reducers', () => {
  it('should remove slice', () => {
    const action = {
      type: actions.REMOVE_SLICE,
      slice: initState.dashboard.slices[1],
    };
    expect(initState.dashboard.slices).to.have.length(3);

    const { dashboard, filters, refresh } = reducers(initState, action);
    expect(dashboard.slices).to.have.length(2);
    expect(filters).to.deep.equal(defaultFilters);
    expect(refresh).to.equal(false);
  });

  it('should remove filter slice', () => {
    const action = {
      type: actions.REMOVE_SLICE,
      slice: initState.dashboard.slices[0],
    };
    const initFilters = Object.keys(initState.filters);
    expect(initFilters).to.have.length(2);

    const { dashboard, filters, refresh } = reducers(initState, action);
    expect(dashboard.slices).to.have.length(2);
    expect(Object.keys(filters)).to.have.length(1);
    expect(refresh).to.equal(true);
  });
});
