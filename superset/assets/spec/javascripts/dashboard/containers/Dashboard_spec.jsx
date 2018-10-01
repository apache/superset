import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { shallow } from 'enzyme';
import { expect } from 'chai';

import Dashboard from '../../../../src/dashboard/containers/Dashboard';
import getInitialState from '../../../../src/dashboard/reducers/getInitialState';

describe('Dashboard Container', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  let store;
  let wrapper;

  before(() => {
    const bootstrapData = {
      dashboard_data: {
        slices: [],
        metadata: {},
      },
      common: {
        feature_flags: {
          FOO_BAR: true,
        },
        conf: {},
      },
    };
    store = mockStore(getInitialState(bootstrapData), {});
  });

  beforeEach(() => {
    wrapper = shallow(<Dashboard />, { context: { store } });
  });

  it('should set feature flags', () => {
    expect(wrapper.prop('isFeatureEnabled')('FOO_BAR')).to.equal(true);
  });
});
