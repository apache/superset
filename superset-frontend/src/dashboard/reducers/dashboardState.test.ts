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
      const initState = { activeTabs: ['tab1', 'tabA', 'tab__a'] };
      const store = mockStore({
        dashboardState: initState,
        dashboardLayout: {
          present: {
            tab1: { parents: [] },
            tab2: { parents: [] },
            tabA: { parents: ['tab1'] },
            tabB: { parents: ['tab1'] },
            tab__a: { parents: ['tab1', 'tabA'] },
            tab__b: { parents: ['tab1', 'tabB'] },
          },
        },
      });
      let request = setActiveTab('tabB', 'tabA');
      let thunkAction = request(store.dispatch, store.getState);
      let result = dashboardStateReducer(
        { activeTabs: ['tab1', 'tabA', 'tab__a'] },
        thunkAction,
      );
      expect(result).toEqual({
        activeTabs: expect.arrayContaining(['tab1', 'tabB']),
        inactiveTabs: ['tab__a'],
      });
      request = setActiveTab('tab2', 'tab1');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = dashboardStateReducer(result, thunkAction);
      expect(result).toEqual({
        activeTabs: ['tab2'],
        inactiveTabs: expect.arrayContaining(['tabB', 'tab__a']),
      });
      request = setActiveTab('tab1', 'tab2');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = dashboardStateReducer(result, thunkAction);
      expect(result).toEqual({
        activeTabs: expect.arrayContaining(['tab1', 'tabB']),
        inactiveTabs: ['tab__a'],
      });
      request = setActiveTab('tabA', 'tabB');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = dashboardStateReducer(result, thunkAction);
      expect(result).toEqual({
        activeTabs: expect.arrayContaining(['tab1', 'tabA', 'tab__a']),
        inactiveTabs: [],
      });
      request = setActiveTab('tab2', 'tab1');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = dashboardStateReducer(result, thunkAction);
      expect(result).toEqual({
        activeTabs: expect.arrayContaining(['tab2']),
        inactiveTabs: ['tabA', 'tab__a'],
      });
      request = setActiveTab('tab1', 'tab2');
      thunkAction = request(store.dispatch, () => ({
        ...(store.getState() ?? {}),
        dashboardState: result,
      }));
      result = dashboardStateReducer(result, thunkAction);
      expect(result).toEqual({
        activeTabs: expect.arrayContaining(['tab1', 'tabA', 'tab__a']),
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
