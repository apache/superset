/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { shallow } from 'enzyme';

import getInitialState from 'src/explore/reducers/getInitialState';
import ExploreViewContainer from 'src/explore/components/ExploreViewContainer';
import QueryAndSaveBtns from 'src/explore/components/QueryAndSaveBtns';
import ConnectedControlPanelsContainer from 'src/explore/components/ControlPanelsContainer';
import ChartContainer from 'src/explore/components/ExploreChartPanel';
import * as featureFlags from 'src/featureFlags';

// I added .skip to this entire suite because none of these tests
// are actually testing particularly useful things,
// and too many hacks were needed to get enzyme to play well with context.
// Leaving it here in the hopes that someone can salvage this.
describe.skip('ExploreViewContainer', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  let store;
  let wrapper;
  let isFeatureEnabledMock;

  // jest.spyOn(ReactAll, 'useContext').mockImplementation(() => {
  //   return {
  //     store,
  //     subscription: new Subscription(store),
  //   };
  // });

  beforeAll(() => {
    isFeatureEnabledMock = jest
      .spyOn(featureFlags, 'isFeatureEnabled')
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
    wrapper = shallow(<ExploreViewContainer store={store} />, {
      disableLifecycleMethods: true,
    })
      .dive()
      .dive();
  });

  it('renders', () => {
    expect(React.isValidElement(<ExploreViewContainer />)).toBe(true);
  });

  it('renders QueryAndSaveButtons', () => {
    expect(wrapper.find(QueryAndSaveBtns)).toExist();
  });

  it('renders ControlPanelsContainer', () => {
    expect(wrapper.find(ConnectedControlPanelsContainer)).toExist();
  });

  it('renders ChartContainer', () => {
    expect(wrapper.find(ChartContainer)).toExist();
  });
});
