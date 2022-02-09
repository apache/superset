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
import { render, screen } from 'spec/helpers/testing-library';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import sinon from 'sinon';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import QueryAutoRefresh from 'src/SqlLab/components/QueryAutoRefresh';
import { initialState, runningQuery } from 'src/SqlLab/fixtures';
import fetchMock from 'fetch-mock';
import * as Actions from 'src/SqlLab/actions/sqlLab';

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
  const setup = (overrides = {}) => (
    <ThemeProvider theme={supersetTheme}>
      <QueryAutoRefresh store={store} {...overrides} />
    </ThemeProvider>
  );

  const mockFetch = fetchMock.get('glob:*/superset/queries/*', {});

  it('shouldCheckForQueries', () => {
    render(setup(), {
      useRedux: true,
    });

    expect(mockFetch.calls).toHaveBeenCalledTimes(1);
  });

  // const getWrapper = () =>
  //   shallow(<QueryAutoRefresh store={store} />)
  //     .dive()
  //     .dive();
  // let wrapper;

  // Just need to render for this
  // spy on setUserOffline for the actual test
  // eslint-disable-next-line jest/no-commented-out-tests
  // it('shouldCheckForQueries', () => {
  //   wrapper = getWrapper();
  //   expect(wrapper.instance().shouldCheckForQueries()).toBe(true);
  // });

  // Change the props passed into the render, setting offline to on or off
  // eslint-disable-next-line jest/no-commented-out-tests
  // it('setUserOffline', () => {
  //   wrapper = getWrapper();
  //   // calls action.setUserOffline, and keeps track of whether it has been called or not
  //   const spy = sinon.spy(wrapper.instance().props.actions, 'setUserOffline');

  //   // state not changed
  //   wrapper.setState({
  //     offline: false,
  //   });
  //   expect(spy.called).toBe(false);

  //   // state is changed
  //   wrapper.setState({
  //     offline: true,
  //   });
  //   expect(spy.callCount).toBe(1);
  // });
});
