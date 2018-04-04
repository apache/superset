import { describe, it } from 'mocha';
import { expect } from 'chai';

import reducers from '../../../javascripts/dashboard/reducers/dashboard';
import * as actions from '../../../javascripts/dashboard/actions/dashboard';
import { defaultFilters, dashboard as initState, allSlices } from './fixtures';

describe('Dashboard reducers', () => {
  it('should initialized', () => {
    expect(initState.dashboard.sliceIds).to.have.length(3);
  });

  it('should remove slice', () => {
    const action = {
      type: actions.REMOVE_SLICE,
      slice: allSlices['slice_248'],
    };

    const { dashboard, filters, refresh } = reducers(initState, action);
    expect(dashboard.sliceIds).to.have.length(2);
    expect(filters).to.deep.equal(defaultFilters);
    expect(refresh).to.equal(false);
  });

  it('should remove filter slice', () => {
    const action = {
      type: actions.REMOVE_SLICE,
      slice: allSlices['slice_256'],
    };
    const initFilters = Object.keys(initState.filters);
    expect(initFilters).to.have.length(2);

    const { dashboard, filters, refresh } = reducers(initState, action);
    expect(dashboard.sliceIds).to.have.length(2);
    expect(Object.keys(filters)).to.have.length(1);
    expect(refresh).to.equal(true);
  });
});
