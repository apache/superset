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
import { shallow } from 'enzyme';
import sinon from 'sinon';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';

import QueryAutoRefresh from 'src/SqlLab/components/QueryAutoRefresh';
import { initialState, runningQuery } from './fixtures';

describe('QueryAutoRefresh', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const sqlLab = {
    ...initialState.sqlLab,
    queries: {
      ryhMUZCGb: runningQuery,
    },
  };
  const state = {
    ...initialState,
    sqlLab,
  };
  const store = mockStore(state);

  const getWrapper = () =>
    shallow(<QueryAutoRefresh />, {
      context: { store },
    }).dive();

  let wrapper;

  it('shouldCheckForQueries', () => {
    wrapper = getWrapper();
    expect(wrapper.instance().shouldCheckForQueries()).toBe(true);
  });

  it('setUserOffline', () => {
    wrapper = getWrapper();
    const spy = sinon.spy(wrapper.instance().props.actions, 'setUserOffline');

    // state not changed
    wrapper.setState({
      offline: false,
    });
    expect(spy.called).toBe(false);

    // state is changed
    wrapper.setState({
      offline: true,
    });
    expect(spy.callCount).toBe(1);
  });
});
