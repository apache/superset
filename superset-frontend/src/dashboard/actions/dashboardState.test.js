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
import { SupersetClient, isFeatureEnabled } from '@superset-ui/core';
import { waitFor } from 'spec/helpers/testing-library';

import {
  SAVE_DASHBOARD_STARTED,
  saveDashboardRequest,
  SET_OVERRIDE_CONFIRM,
} from 'src/dashboard/actions/dashboardState';
import { UPDATE_COMPONENTS_PARENTS_LIST } from 'src/dashboard/actions/dashboardLayout';
import {
  DASHBOARD_GRID_ID,
  SAVE_TYPE_OVERWRITE,
  SAVE_TYPE_OVERWRITE_CONFIRMED,
} from 'src/dashboard/util/constants';
import {
  filterId,
  sliceEntitiesForDashboard as sliceEntities,
} from 'spec/fixtures/mockSliceEntities';
import { emptyFilters } from 'spec/fixtures/mockDashboardFilters';
import mockDashboardData from 'spec/fixtures/mockDashboardData';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

describe('dashboardState actions', () => {
  const mockState = {
    dashboardState: {
      sliceIds: [filterId],
      hasUnsavedChanges: true,
    },
    dashboardInfo: {
      metadata: {
        color_scheme: 'supersetColors',
      },
    },
    sliceEntities,
    dashboardFilters: emptyFilters,
    dashboardLayout: {
      past: [],
      present: mockDashboardData.positions,
      future: {},
    },
    charts: {},
  };
  const newDashboardData = mockDashboardData;

  let postStub;
  let getStub;
  let putStub;
  const updatedCss = '.updated_css_value {\n  color: black;\n}';

  beforeEach(() => {
    postStub = sinon
      .stub(SupersetClient, 'post')
      .resolves('the value you want to return');
    getStub = sinon.stub(SupersetClient, 'get').resolves({
      json: {
        result: {
          ...mockDashboardData,
          css: updatedCss,
        },
      },
    });
    putStub = sinon.stub(SupersetClient, 'put').resolves({
      json: {
        result: mockDashboardData,
      },
    });
  });
  afterEach(() => {
    postStub.restore();
    getStub.restore();
    putStub.restore();
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
      expect(dispatch.callCount).toBe(2);
      expect(dispatch.getCall(0).args[0].type).toBe(
        UPDATE_COMPONENTS_PARENTS_LIST,
      );
      expect(dispatch.getCall(1).args[0].type).toBe(SAVE_DASHBOARD_STARTED);
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
        mockState.dashboardLayout.present[DASHBOARD_GRID_ID].parents =
          mockParentsList;
      });

      // call saveDashboardRequest, it should post dashboard data with updated
      // layout object (with parents attribute)
      const thunk = saveDashboardRequest(newDashboardData, 1, 'save_dash');
      thunk(dispatch, getState);
      expect(postStub.callCount).toBe(1);
      const { jsonPayload } = postStub.getCall(0).args[0];
      const parsedJsonMetadata = JSON.parse(jsonPayload.json_metadata);
      expect(
        parsedJsonMetadata.positions[DASHBOARD_GRID_ID].parents,
      ).toStrictEqual(mockParentsList);
    });

    describe('FeatureFlag.CONFIRM_DASHBOARD_DIFF', () => {
      beforeEach(() => {
        isFeatureEnabled.mockImplementation(
          feature => feature === 'CONFIRM_DASHBOARD_DIFF',
        );
      });

      afterEach(() => {
        isFeatureEnabled.mockRestore();
      });

      it('dispatches SET_OVERRIDE_CONFIRM when an inspect value has diff', async () => {
        const id = 192;
        const { getState, dispatch } = setup();
        const thunk = saveDashboardRequest(
          newDashboardData,
          id,
          SAVE_TYPE_OVERWRITE,
        );
        thunk(dispatch, getState);
        expect(getStub.callCount).toBe(1);
        expect(postStub.callCount).toBe(0);
        await waitFor(() =>
          expect(dispatch.getCall(2).args[0].type).toBe(SET_OVERRIDE_CONFIRM),
        );
        expect(
          dispatch.getCall(2).args[0].overwriteConfirmMetadata.dashboardId,
        ).toBe(id);
      });

      it('should post dashboard data with after confirm the overwrite values', async () => {
        const id = 192;
        const { getState, dispatch } = setup();
        const confirmedDashboardData = {
          ...newDashboardData,
          css: updatedCss,
        };
        const thunk = saveDashboardRequest(
          confirmedDashboardData,
          id,
          SAVE_TYPE_OVERWRITE_CONFIRMED,
        );
        thunk(dispatch, getState);
        expect(getStub.callCount).toBe(0);
        expect(postStub.callCount).toBe(0);
        await waitFor(() => expect(putStub.callCount).toBe(1));
        const { body } = putStub.getCall(0).args[0];
        expect(body).toBe(JSON.stringify(confirmedDashboardData));
      });
    });
  });
});
