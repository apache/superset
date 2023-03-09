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
import sinon from 'sinon';
import { SupersetClient } from '@superset-ui/core';

import {
  FETCH_ALL_SLICES_STARTED,
  fetchSortedSlices,
  fetchFilteredSlices,
  fetchAllSlices,
} from './sliceEntities';

describe('slice entity actions', () => {
  const mockState = {
    sliceEntities: { slices: {} },
    isLoading: true,
    errorMessage: null,
    lastUpdated: 0,
  };

  function setup(stateOverrides) {
    const state = { ...mockState, ...stateOverrides };
    const getState = sinon.spy(() => state);
    const dispatch = sinon.spy();

    return { getState, dispatch, state };
  }

  let spy;

  beforeEach(() => {
    spy = sinon.spy(SupersetClient);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('fetchSortedSlices', () => {
    it('should dispatch an fetchAllSlicesStarted action', async () => {
      const { dispatch } = setup();
      const thunk1 = fetchSortedSlices('userId', false, 'orderColumn');
      await thunk1(dispatch);
      expect(dispatch.getCall(0).args[0]).toEqual({
        type: FETCH_ALL_SLICES_STARTED,
      });
      expect(spy.get.callCount).toBe(1);
    });
  });

  describe('fetchFilteredSlices', () => {
    it('should dispatch an fetchAllSlicesStarted action', async () => {
      const { dispatch, getState } = setup();
      const thunk1 = fetchFilteredSlices('userId', 'filter_value');
      await thunk1(dispatch, getState);
      expect(dispatch.getCall(0).args[0]).toEqual({
        type: FETCH_ALL_SLICES_STARTED,
      });
      expect(spy.get.callCount).toBe(1);
    });
  });

  describe('fetchAllSlices', () => {
    it('should not trigger fetchSlices when sliceEntities lastUpdate is not 0', async () => {
      const { dispatch, getState } = setup({
        sliceEntities: { slices: {}, lastUpdated: 1 },
      });

      const thunk1 = fetchAllSlices('userId', 'filter_value');
      await thunk1(dispatch, getState);

      expect(spy.get.callCount).toBe(0);
    });

    it('should trigger fetchSlices when sliceEntities lastUpdate is 0', async () => {
      const { dispatch, getState } = setup({
        sliceEntities: { slices: {}, lastUpdated: 0 },
      });

      const thunk1 = fetchAllSlices('userId', false, 'filter_value');
      await thunk1(dispatch, getState);

      expect(spy.get.callCount).toBe(1);
    });
  });
});
