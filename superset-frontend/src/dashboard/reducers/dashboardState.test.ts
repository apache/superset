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
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import dashboardStateReducer from './dashboardState';
import { setActiveTab, setActiveTabs } from '../actions/dashboardState';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('DashboardState reducer', () => {
  describe('SET_ACTIVE_TAB', () => {
    it('switches a single tab', () => {
      const store = mockStore({
        dashboardState: { activeTabs: [] },
        dashboardLayout: { present: { tab1: { parents: [] } } },
      });
      const request = setActiveTab('tab1');
      const thunkAction = request(store.dispatch, store.getState);

      expect(dashboardStateReducer({ activeTabs: [] }, thunkAction)).toEqual({
        activeTabs: ['tab1'],
        inactiveTabs: [],
      });

      const request2 = setActiveTab('tab2', 'tab1');
      const thunkAction2 = request2(store.dispatch, store.getState);
      expect(
        dashboardStateReducer({ activeTabs: ['tab1'] }, thunkAction2),
      ).toEqual({ activeTabs: ['tab2'], inactiveTabs: [] });
    });

    it('switches a multi-depth tab', () => {
      const initState = { activeTabs: ['TAB-1', 'TAB-A', 'TAB-__a'] };
      const store = mockStore({
        dashboardState: initState,
        dashboardLayout: {
          present: {
            'TAB-1': { parents: [] },
            'TAB-2': { parents: [] },
            'TAB-A': { parents: ['TAB-1', 'TABS-1'] },
            'TAB-B': { parents: ['TAB-1', 'TABS-1'] },
            'TAB-__a': { parents: ['TAB-1', 'TABS-1', 'TAB-A', 'TABS-A'] },
            'TAB-__b': { parents: ['TAB-1', 'TABS-1', 'TAB-B', 'TABS-B'] },
          },
        },
      });
      let request = setActiveTab('TAB-B', 'TAB-A');
      let thunkAction = request(store.dispatch, store.getState);
      let result = dashboardStateReducer(
        { activeTabs: ['TAB-1', 'TAB-A', 'TAB-__a'] },
        thunkAction,
      );
      expect(result).toEqual({
        activeTabs: expect.arrayContaining(['TAB-1', 'TAB-B']),
        inactiveTabs: ['TAB-__a'],
      });
      request = setActiveTab('TAB-2', 'TAB-1');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = dashboardStateReducer(result, thunkAction);
      expect(result).toEqual({
        activeTabs: ['TAB-2'],
        inactiveTabs: expect.arrayContaining(['TAB-B', 'TAB-__a']),
      });
      request = setActiveTab('TAB-1', 'TAB-2');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = dashboardStateReducer(result, thunkAction);
      expect(result).toEqual({
        activeTabs: expect.arrayContaining(['TAB-1', 'TAB-B']),
        inactiveTabs: ['TAB-__a'],
      });
      request = setActiveTab('TAB-A', 'TAB-B');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = dashboardStateReducer(result, thunkAction);
      expect(result).toEqual({
        activeTabs: expect.arrayContaining(['TAB-1', 'TAB-A', 'TAB-__a']),
        inactiveTabs: [],
      });
      request = setActiveTab('TAB-2', 'TAB-1');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = dashboardStateReducer(result, thunkAction);
      expect(result).toEqual({
        activeTabs: expect.arrayContaining(['TAB-2']),
        inactiveTabs: ['TAB-A', 'TAB-__a'],
      });
      request = setActiveTab('TAB-1', 'TAB-2');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = dashboardStateReducer(result, thunkAction);
      expect(result).toEqual({
        activeTabs: expect.arrayContaining(['TAB-1', 'TAB-A', 'TAB-__a']),
        inactiveTabs: [],
      });
    });
  });
  it('SET_ACTIVE_TABS', () => {
    expect(
      dashboardStateReducer({ activeTabs: [] }, setActiveTabs(['tab1'])),
    ).toEqual({ activeTabs: ['tab1'] });
    expect(
      dashboardStateReducer(
        { activeTabs: ['tab1', 'tab2'] },
        setActiveTabs(['tab3', 'tab4']),
      ),
    ).toEqual({ activeTabs: ['tab3', 'tab4'] });
  });
});
