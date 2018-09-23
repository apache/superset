import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { expect } from 'chai';
import { shallow } from 'enzyme';

import getInitialState from '../../../../src/explore/reducers/getInitialState';
import ExploreViewContainer
  from '../../../../src/explore/components/ExploreViewContainer';
import QueryAndSaveBtns
  from '../../../../src/explore/components/QueryAndSaveBtns';
import ControlPanelsContainer
  from '../../../../src/explore/components/ControlPanelsContainer';
import ChartContainer
  from '../../../../src/explore/components/ExploreChartPanel';

describe('ExploreViewContainer', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  let store;
  let wrapper;

  before(() => {
    const bootstrapData = {
      common: {
        feature_flags: {
          FOO_BAR: true,
        },
        conf: {},
      },
      datasource: {
        columns: [],
      },
      form_data: {
        datasource: {},
      },
    };
    store = mockStore(getInitialState(bootstrapData), {});
  });

  beforeEach(() => {
    wrapper = shallow(<ExploreViewContainer />, {
      context: { store },
      disableLifecycleMethods: true,
    });
  });

  it('should set feature flags', () => {
    expect(wrapper.prop('isFeatureEnabled')('FOO_BAR')).to.equal(true);
  });

  it('renders', () => {
    expect(
      React.isValidElement(<ExploreViewContainer />),
    ).to.equal(true);
  });

  it('renders QueryAndSaveButtons', () => {
    expect(wrapper.dive().find(QueryAndSaveBtns)).to.have.length(1);
  });

  it('renders ControlPanelsContainer', () => {
    expect(wrapper.dive().find(ControlPanelsContainer)).to.have.length(1);
  });

  it('renders ChartContainer', () => {
    expect(wrapper.dive().find(ChartContainer)).to.have.length(1);
  });
});
