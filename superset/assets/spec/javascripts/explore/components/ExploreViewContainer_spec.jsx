import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { shallow } from 'enzyme';

import getInitialState from 'src/explore/reducers/getInitialState';
import ExploreViewContainer from 'src/explore/components/ExploreViewContainer';
import QueryAndSaveBtns from 'src/explore/components/QueryAndSaveBtns';
import ControlPanelsContainer from 'src/explore/components/ControlPanelsContainer';
import ChartContainer from 'src/explore/components/ExploreChartPanel';
import * as featureFlags from 'src/featureFlags';

describe('ExploreViewContainer', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  let store;
  let wrapper;
  let isFeatureEnabledMock;

  beforeAll(() => {
    isFeatureEnabledMock = jest.spyOn(featureFlags, 'isFeatureEnabled')
        .mockReturnValue(false);

    const bootstrapData = {
      common: {
        conf: {},
      },
      datasource: {
        columns: [],
      },
    };
    store = mockStore(getInitialState(bootstrapData), {});
  });

  afterAll(() => {
    isFeatureEnabledMock.mockRestore();
  });

  beforeEach(() => {
    wrapper = shallow(<ExploreViewContainer />, {
      context: { store },
      disableLifecycleMethods: true,
    });
  });

  it('renders', () => {
    expect(
      React.isValidElement(<ExploreViewContainer />),
    ).toBe(true);
  });

  it('renders QueryAndSaveButtons', () => {
    expect(wrapper.dive().find(QueryAndSaveBtns)).toHaveLength(1);
  });

  it('renders ControlPanelsContainer', () => {
    expect(wrapper.dive().find(ControlPanelsContainer)).toHaveLength(1);
  });

  it('renders ChartContainer', () => {
    expect(wrapper.dive().find(ChartContainer)).toHaveLength(1);
  });
});
