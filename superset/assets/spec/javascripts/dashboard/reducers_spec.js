import { describe, it } from 'mocha';
import { expect } from 'chai';

import reducers from '../../../javascripts/dashboard/reducers/dashboard';
import * as actions from '../../../javascripts/dashboard/actions/dashboard';
import { defaultFilters, dashboard as initState } from './fixtures';

describe('Dashboard reducers', () => {
  it('should initialized', () => {
    expect(initState.dashboard.sliceIds.size).to.equal(3);
  });

  it('should remove slice', () => {
    const action = {
      type: actions.REMOVE_SLICE,
      sliceId: 248,
    };

    const { dashboard, filters, refresh } = reducers(initState, action);
    expect(dashboard.sliceIds.size).to.be.equal(2);
    expect(filters).to.deep.equal(defaultFilters);
    expect(refresh).to.equal(false);
  });

  it('should remove filter slice', () => {
    const action = {
      type: actions.REMOVE_SLICE,
      sliceId: 256,
    };
    const initFilters = Object.keys(initState.filters);
    expect(initFilters).to.have.length(2);

    const { dashboard, filters, refresh } = reducers(initState, action);
    expect(dashboard.sliceIds.size).to.equal(2);
    expect(Object.keys(filters)).to.have.length(1);
    expect(refresh).to.equal(true);
  });
});
