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
  removeSliceFromDashboard,
  saveDashboardRequest,
} from 'src/dashboard/actions/dashboardState';
import { REMOVE_FILTER } from 'src/dashboard/actions/dashboardFilters';
import { UPDATE_COMPONENTS_PARENTS_LIST } from 'src/dashboard/actions/dashboardLayout';
import { DASHBOARD_GRID_ID } from 'src/dashboard/util/constants';
import {
  filterId,
  sliceEntitiesForDashboard as sliceEntities,
} from '../fixtures/mockSliceEntities';
import { emptyFilters } from '../fixtures/mockDashboardFilters';
import mockDashboardData from '../fixtures/mockDashboardData';

describe('dashboardState actions', () => {
  const mockState = {
    dashboardState: {
      sliceIds: [filterId],
      hasUnsavedChanges: true,
    },
    dashboardInfo: {},
    sliceEntities,
    dashboardFilters: emptyFilters,
    dashboardLayout: {
      past: [],
      present: mockDashboardData.positions,
      future: {},
    },
  };
  const newDashboardData = mockDashboardData;

  let postStub;
  beforeEach(() => {
    postStub = sinon
      .stub(SupersetClient, 'post')
      .resolves('the value you want to return');
  });
  afterEach(() => {
    postStub.restore();
  });

  function setup(stateOverrides) {
    const state = { ...mockState, ...stateOverrides };
    const getState = sinon.spy(() => state);
    const dispatch = sinon.stub();
    return { getState, dispatch, state };
  }

  describe('saveDashboardRequest', () => {
    it('should dispatch UPDATE_COMPONENTS_PARENTS_LIST action', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      const thunk = saveDashboardRequest(newDashboardData, 1, 'save_dash');
      thunk(dispatch, getState);
      expect(dispatch.callCount).toBe(1);
      expect(dispatch.getCall(0).args[0].type).toBe(
        UPDATE_COMPONENTS_PARENTS_LIST,
      );
    });

    it('should post dashboard data with updated redux state', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });

      // start with mockDashboardData, it didn't have parents attr
      expect(
        newDashboardData.positions[DASHBOARD_GRID_ID].parents,
      ).not.toBeDefined();

      // mock redux work: dispatch an event, cause modify redux state
      const mockParentsList = ['ROOT_ID'];
      dispatch.callsFake(() => {
        mockState.dashboardLayout.present[
          DASHBOARD_GRID_ID
        ].parents = mockParentsList;
      });

      // call saveDashboardRequest, it should post dashboard data with updated
      // layout object (with parents attribute)
      const thunk = saveDashboardRequest(newDashboardData, 1, 'save_dash');
      thunk(dispatch, getState);
      expect(postStub.callCount).toBe(1);
      const postPayload = postStub.getCall(0).args[0].postPayload;
      expect(postPayload.data.positions[DASHBOARD_GRID_ID].parents).toBe(
        mockParentsList,
      );
    });
  });

  it('should dispatch removeFilter if a removed slice is a filter_box', () => {
    const { getState, dispatch } = setup(mockState);
    const thunk = removeSliceFromDashboard(filterId);
    thunk(dispatch, getState);

    const removeFilter = dispatch.getCall(0).args[0];
    removeFilter(dispatch, getState);
    expect(dispatch.getCall(3).args[0].type).toBe(REMOVE_FILTER);
  });
});
