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
    const { dashboard, filters, refresh } = reducers(initState, action);
    expect(dashboard.slices).to.have.length(1);
    expect(filters).to.deep.equal(defaultFilters);
    expect(refresh).to.equal(false);
  });

  it('should remove filter slice', () => {
    const action = {
      type: actions.REMOVE_SLICE,
      slice: initState.dashboard.slices[0],
    };
    const { dashboard, filters, refresh } = reducers(initState, action);
    expect(dashboard.slices).to.have.length(1);
    expect(filters).to.deep.equal({});
    expect(refresh).to.equal(true);
  });
});
