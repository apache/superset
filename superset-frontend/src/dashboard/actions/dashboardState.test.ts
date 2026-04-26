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
import { SupersetClient, isFeatureEnabled } from '@superset-ui/core';
import { waitFor } from 'spec/helpers/testing-library';

import {
  SAVE_DASHBOARD_STARTED,
  saveDashboardRequest,
  SET_OVERRIDE_CONFIRM,
  fetchCharts,
  onRefresh,
  ON_FILTERS_REFRESH,
  ON_REFRESH,
  ON_REFRESH_SUCCESS,
} from 'src/dashboard/actions/dashboardState';
import { refreshChart } from 'src/components/Chart/chartAction';
import { UPDATE_COMPONENTS_PARENTS_LIST } from 'src/dashboard/actions/dashboardLayout';
import {
  DASHBOARD_GRID_ID,
  SAVE_TYPE_OVERWRITE,
  SAVE_TYPE_OVERWRITE_CONFIRMED,
  SAVE_TYPE_NEWDASHBOARD,
} from 'src/dashboard/util/constants';
import {
  filterId,
  sliceEntitiesForDashboard as sliceEntities,
} from 'spec/fixtures/mockSliceEntities';
import { emptyFilters } from 'spec/fixtures/mockDashboardFilters';
import mockDashboardData from 'spec/fixtures/mockDashboardData';
import { navigateTo } from 'src/utils/navigationUtils';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('src/components/Chart/chartAction', () => ({
  refreshChart: jest.fn(() => () => Promise.resolve()),
}));

jest.mock('src/utils/navigationUtils', () => ({
  navigateTo: jest.fn(),
  navigateWithState: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;
const mockNavigateTo = navigateTo as jest.Mock;

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
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

  let postStub: jest.SpyInstance;
  let getStub: jest.SpyInstance;
  let putStub: jest.SpyInstance;
  const updatedCss = '.updated_css_value {\n  color: black;\n}';

  beforeEach(() => {
    postStub = jest
      .spyOn(SupersetClient, 'post')
      .mockResolvedValue('the value you want to return' as any);
    getStub = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
      json: {
        result: {
          ...mockDashboardData,
          css: updatedCss,
        },
      },
    } as any);
    putStub = jest.spyOn(SupersetClient, 'put').mockResolvedValue({
      json: {
        result: mockDashboardData,
      },
    } as any);
  });
  afterEach(() => {
    postStub.mockRestore();
    getStub.mockRestore();
    putStub.mockRestore();
  });

  function setup(stateOverrides: Record<string, unknown> = {}) {
    const state = { ...mockState, ...stateOverrides };
    const getState = jest.fn(() => state) as unknown as () => any;
    const dispatch = jest.fn();
    return { getState, dispatch, state };
  }

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('saveDashboardRequest', () => {
    test('should dispatch UPDATE_COMPONENTS_PARENTS_LIST action', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      const thunk = saveDashboardRequest(newDashboardData, 1, 'save_dash');
      thunk(dispatch, getState);
      expect(dispatch.mock.calls.length).toBe(2);
      expect(dispatch.mock.calls[0][0].type).toBe(
        UPDATE_COMPONENTS_PARENTS_LIST,
      );
      expect(dispatch.mock.calls[1][0].type).toBe(SAVE_DASHBOARD_STARTED);
    });

    test('should post dashboard data with updated redux state', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });

      // start with mockDashboardData, it didn't have parents attr
      expect(
        (newDashboardData.positions[DASHBOARD_GRID_ID] as any).parents,
      ).not.toBeDefined();

      // mock redux work: dispatch an event, cause modify redux state
      const mockParentsList = ['ROOT_ID'];
      dispatch.mockImplementation(() => {
        (mockState.dashboardLayout.present[DASHBOARD_GRID_ID] as any).parents =
          mockParentsList;
      });

      // call saveDashboardRequest, it should post dashboard data with updated
      // layout object (with parents attribute)
      const thunk = saveDashboardRequest(newDashboardData, 1, 'save_dash');
      thunk(dispatch, getState);
      expect(postStub.mock.calls.length).toBe(1);
      const { jsonPayload } = postStub.mock.calls[0][0];
      const parsedJsonMetadata = JSON.parse(jsonPayload.json_metadata);
      expect(
        parsedJsonMetadata.positions[DASHBOARD_GRID_ID].parents,
      ).toStrictEqual(mockParentsList);
    });

    // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
    describe('FeatureFlag.CONFIRM_DASHBOARD_DIFF', () => {
      beforeEach(() => {
        mockIsFeatureEnabled.mockImplementation(
          (feature: string) => feature === 'CONFIRM_DASHBOARD_DIFF',
        );
      });

      afterEach(() => {
        mockIsFeatureEnabled.mockRestore();
      });

      test('dispatches SET_OVERRIDE_CONFIRM when an inspect value has diff', async () => {
        const id = 192;
        const { getState, dispatch } = setup();
        const thunk = saveDashboardRequest(
          newDashboardData,
          id,
          SAVE_TYPE_OVERWRITE,
        );
        thunk(dispatch, getState);
        expect(getStub.mock.calls.length).toBe(1);
        expect(postStub.mock.calls.length).toBe(0);
        await waitFor(() =>
          expect(dispatch.mock.calls[2][0].type).toBe(SET_OVERRIDE_CONFIRM),
        );
        expect(
          dispatch.mock.calls[2][0].overwriteConfirmMetadata.dashboardId,
        ).toBe(id);
      });

      test('should post dashboard data with after confirm the overwrite values', async () => {
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
        expect(getStub.mock.calls.length).toBe(0);
        expect(postStub.mock.calls.length).toBe(0);
        await waitFor(() => expect(putStub.mock.calls.length).toBe(1));
        const { body } = putStub.mock.calls[0][0];
        expect(body).toBe(JSON.stringify(confirmedDashboardData));
      });
    });

    test('should navigate to the new dashboard after Save As', async () => {
      const newDashboardId = 999;
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: true },
      });

      postStub.mockRestore();
      postStub = jest.spyOn(SupersetClient, 'post').mockResolvedValue({
        json: {
          result: {
            ...mockDashboardData,
            id: newDashboardId,
          },
        },
      } as any);

      const thunk = saveDashboardRequest(
        newDashboardData,
        null as unknown as number,
        SAVE_TYPE_NEWDASHBOARD,
      );
      await thunk(dispatch, getState);

      await waitFor(() => expect(postStub.mock.calls.length).toBe(1));
      expect(mockNavigateTo).toHaveBeenCalledWith(
        `/superset/dashboard/${newDashboardId}/`,
      );
    });
  });

  test('fetchCharts returns a Promise that resolves after all refreshes', async () => {
    (refreshChart as jest.Mock).mockClear();
    const { getState } = setup({
      dashboardInfo: {
        metadata: {},
        common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
      },
    });
    const dispatch = (action: unknown): unknown => {
      if (typeof action === 'function') {
        return (action as Function)(dispatch, getState);
      }
      return action;
    };
    const chartIds = [1, 2];
    const promise = fetchCharts(chartIds, false, 0, 10)(dispatch, getState);
    await promise;

    expect(refreshChart).toHaveBeenCalledTimes(chartIds.length);
  });

  test('fetchCharts resolves for staggered refreshes', async () => {
    jest.useFakeTimers();
    (refreshChart as jest.Mock).mockClear();
    const { getState } = setup({
      dashboardInfo: {
        metadata: { stagger_time: 1000, stagger_refresh: true },
        common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
      },
    });
    const dispatch = (action: unknown): unknown => {
      if (typeof action === 'function') {
        return (action as Function)(dispatch, getState);
      }
      return action;
    };
    const chartIds = [1, 2, 3];
    const promise = fetchCharts(chartIds, false, 1000, 10)(dispatch, getState);

    jest.runAllTimers();
    await promise;
    jest.useRealTimers();

    expect(refreshChart).toHaveBeenCalledTimes(chartIds.length);
  });

  test('fetchCharts rejects for staggered refreshes when any chart refresh fails', async () => {
    jest.useFakeTimers();
    (refreshChart as jest.Mock).mockClear();
    (refreshChart as jest.Mock).mockImplementation(
      (chartKey: number) => () =>
        chartKey === 2
          ? Promise.reject(new Error('refresh failed'))
          : Promise.resolve(),
    );
    const { getState } = setup({
      dashboardInfo: {
        metadata: { stagger_time: 1000, stagger_refresh: true },
        common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
      },
    });
    const dispatch = (action: unknown): unknown => {
      if (typeof action === 'function') {
        return (action as Function)(dispatch, getState);
      }
      return action;
    };
    const chartIds = [1, 2, 3];
    const promise = fetchCharts(chartIds, false, 1000, 10)(dispatch, getState);

    jest.runAllTimers();
    await expect(promise).rejects.toThrow('refresh failed');
    jest.useRealTimers();
    (refreshChart as jest.Mock).mockImplementation(
      () => () => Promise.resolve(),
    );
  });

  test('onRefresh dispatches success and filters refresh by default', async () => {
    const { getState } = setup({
      dashboardInfo: {
        metadata: {},
        common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
      },
    });
    const dispatched: { type: string }[] = [];
    const dispatch = (action: unknown): unknown => {
      if (typeof action === 'function') {
        return (action as Function)(dispatch, getState);
      }
      dispatched.push(action as { type: string });
      return action;
    };

    await onRefresh([1], true, 0, 10)(dispatch as never);

    expect(dispatched.map(action => action.type)).toEqual(
      expect.arrayContaining([
        ON_REFRESH,
        ON_REFRESH_SUCCESS,
        ON_FILTERS_REFRESH,
      ]),
    );
  });

  test('onRefresh skips filter refresh when requested', async () => {
    const { getState } = setup({
      dashboardInfo: {
        metadata: {},
        common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
      },
    });
    const dispatched: { type: string }[] = [];
    const dispatch = (action: unknown): unknown => {
      if (typeof action === 'function') {
        return (action as Function)(dispatch, getState);
      }
      dispatched.push(action as { type: string });
      return action;
    };

    await onRefresh([1], true, 0, 10, true)(dispatch as never);

    const dispatchedTypes = dispatched.map(action => action.type);
    expect(dispatchedTypes).toEqual(
      expect.arrayContaining([ON_REFRESH, ON_REFRESH_SUCCESS]),
    );
    expect(dispatchedTypes).not.toContain(ON_FILTERS_REFRESH);
  });

  test('onRefresh skips ON_REFRESH and filters refresh for lazy-loaded tabs', async () => {
    const { getState } = setup({
      dashboardInfo: {
        metadata: {},
        common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
      },
    });
    const dispatched: { type: string }[] = [];
    const dispatch = (action: unknown): unknown => {
      if (typeof action === 'function') {
        return (action as Function)(dispatch, getState);
      }
      dispatched.push(action as { type: string });
      return action;
    };

    await onRefresh([1], true, 0, 10, false, true)(dispatch as never);

    const dispatchedTypes = dispatched.map(action => action.type);
    expect(dispatchedTypes).toContain(ON_REFRESH_SUCCESS);
    expect(dispatchedTypes).not.toContain(ON_REFRESH);
    expect(dispatchedTypes).not.toContain(ON_FILTERS_REFRESH);
  });
});
