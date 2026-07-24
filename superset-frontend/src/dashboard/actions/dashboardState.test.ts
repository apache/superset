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
  saveDashboardRequest,
  fetchCharts,
  onRefresh,
  ON_REFRESH,
} from 'src/dashboard/actions/dashboardState';
import { refreshChart } from 'src/components/Chart/chartAction';
import {
  useDashboardLayoutStore,
  useDashboardStateStore,
  useDashboardInfoStore,
} from 'src/dashboard/stores';
import type { DashboardInfo } from 'src/dashboard/types';
import {
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
import { queryClient } from 'src/queries/queryClient';
import { dashboardKeys } from 'src/dashboard/queries/keys';
import { navigateTo, navigateWithState } from 'src/utils/navigationUtils';

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
const mockNavigateWithState = navigateWithState as jest.Mock;

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
    useDashboardInfoStore.setState({
      dashboardInfo: (state.dashboardInfo || {}) as DashboardInfo,
    });
    const getState = jest.fn(() => state) as unknown as () => any;
    const dispatch = jest.fn();
    return { getState, dispatch, state };
  }

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('saveDashboardRequest', () => {
    test('starts the save by flagging the dashboard as saving', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      useDashboardStateStore.setState({ dashboardIsSaving: false });
      const thunk = saveDashboardRequest(newDashboardData, 1, 'save_dash');
      thunk(dispatch, getState);
      expect(useDashboardStateStore.getState().dashboardIsSaving).toBe(true);
    });

    test('posts dashboard data with serialized positions on save', () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: false },
      });
      useDashboardLayoutStore
        .getState()
        .setLayout(newDashboardData.positions as any);

      const thunk = saveDashboardRequest(newDashboardData, 1, 'save_dash');
      thunk(dispatch, getState);
      expect(postStub.mock.calls.length).toBe(1);
      const { jsonPayload } = postStub.mock.calls[0][0];
      const parsedJsonMetadata = JSON.parse(jsonPayload.json_metadata);
      // The whole positions tree must round-trip through save: every component
      // (incl. its parents, children, and meta) lands in json_metadata.positions.
      expect(parsedJsonMetadata.positions).toEqual(newDashboardData.positions);
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
        useDashboardStateStore.setState({
          overwriteConfirmMetadata: undefined,
        });
        thunk(dispatch, getState);
        expect(getStub.mock.calls.length).toBe(1);
        expect(postStub.mock.calls.length).toBe(0);
        await waitFor(() =>
          expect(
            useDashboardStateStore.getState().overwriteConfirmMetadata,
          ).toBeDefined(),
        );
        expect(
          useDashboardStateStore.getState().overwriteConfirmMetadata
            ?.dashboardId,
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

    test('rejects when the PUT fails so callers can detect save failure', async () => {
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: true },
      });
      putStub.mockRestore();
      putStub = jest
        .spyOn(SupersetClient, 'put')
        .mockRejectedValue(
          new Response('500', { status: 500 }) as unknown as Response,
        );

      const thunk = saveDashboardRequest(
        newDashboardData,
        1,
        SAVE_TYPE_OVERWRITE_CONFIRMED,
      );
      await expect(thunk(dispatch, getState)).rejects.toBeDefined();
      expect(putStub.mock.calls.length).toBe(1);
    });

    test('invalidates the detail cache on a successful in-place save', async () => {
      // In-place saves run through this thunk, so detail invalidation lives here
      // rather than in useSaveDashboard — that keeps OverwriteConfirmModal's
      // direct dispatch consistent with the mutation wrapper.
      const id = 192;
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: true },
      });
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      await saveDashboardRequest(
        newDashboardData,
        id,
        SAVE_TYPE_OVERWRITE_CONFIRMED,
      )(dispatch, getState);

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: dashboardKeys.detail(id),
      });
      invalidateSpy.mockRestore();
    });

    test('rebaselines the discard snapshot to the saved state on an in-place save', async () => {
      // After a save the live stores hold the saved state, so the snapshot is
      // rebaselined to it (not dropped) and a later discard stays in-place.
      const id = 192;
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: true },
      });
      queryClient.setQueryData(dashboardKeys.hydrationPayload(id), {
        dashboardLayout: { present: { OLD: { id: 'OLD' } } },
        sliceEntities: { slices: {} },
        zustandStateSeed: { hasUnsavedChanges: true },
      });
      // The live (saved) layout the rebaseline should capture.
      useDashboardLayoutStore.setState({
        layout: { NEW: { id: 'NEW' } },
      } as never);

      await saveDashboardRequest(
        newDashboardData,
        id,
        SAVE_TYPE_OVERWRITE_CONFIRMED,
      )(dispatch, getState);

      const snapshot = queryClient.getQueryData(
        dashboardKeys.hydrationPayload(id),
      ) as { dashboardLayout: { present: Record<string, unknown> } };
      // Snapshot is rebaselined in place, not dropped, and reflects the saved layout.
      expect(snapshot).toBeDefined();
      expect(snapshot.dashboardLayout.present).toEqual({ NEW: { id: 'NEW' } });
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
        `/dashboard/${newDashboardId}/`,
      );
    });

    // `navigateWithState` regression for the
    // dashboard-properties-changed save path. Two assertions in one shape:
    //   (a) the emitted path is router-relative (`/dashboard/<id>/`), not
    //       the pre-migration `/superset/dashboard/<id>/` literal that under
    //       subdirectory deployment would double-prefix to
    //       `/superset/superset/dashboard/<id>/`;
    //   (b) the `event: 'dashboard_properties_changed'` history-state arg is
    //       preserved verbatim. A previous attempt to swap `navigateWithState`
    //       for a plain `navigateTo` would silently drop this state object and
    //       the dashboard would lose its post-save UX cue.
    test('saves dashboard properties via navigateWithState with state preserved', async () => {
      const updatedId = 777;
      const { getState, dispatch } = setup({
        dashboardState: { hasUnsavedChanges: true },
      });

      mockNavigateWithState.mockClear();
      putStub.mockRestore();
      putStub = jest.spyOn(SupersetClient, 'put').mockResolvedValue({
        json: {
          result: { ...mockDashboardData, id: updatedId, slug: null },
          last_modified_time: 0,
        },
      } as any);

      const thunk = saveDashboardRequest(
        newDashboardData,
        updatedId,
        SAVE_TYPE_OVERWRITE,
      );
      await thunk(dispatch, getState);

      await waitFor(() => expect(putStub.mock.calls.length).toBe(1));
      await waitFor(() => expect(mockNavigateWithState).toHaveBeenCalled());

      expect(mockNavigateWithState).toHaveBeenCalledWith(
        `/dashboard/${updatedId}/`,
        { event: 'dashboard_properties_changed' },
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
    const promise = fetchCharts(chartIds, false, 0, 10)(dispatch);
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
    const promise = fetchCharts(chartIds, false, 1000, 10)(dispatch);

    jest.runAllTimers();
    await promise;
    jest.useRealTimers();

    expect(refreshChart).toHaveBeenCalledTimes(chartIds.length);
  });

  test('fetchCharts fires each chart at evenly spaced staggered offsets', async () => {
    jest.useFakeTimers();
    (refreshChart as jest.Mock).mockClear();
    const { getState } = setup({
      dashboardInfo: {
        metadata: { stagger_time: 4000, stagger_refresh: true },
        common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
      },
    });
    const dispatch = (action: unknown): unknown => {
      if (typeof action === 'function') {
        return (action as Function)(dispatch, getState);
      }
      return action;
    };
    // refreshTime = max(interval, stagger_time) = 4000;
    // delay between charts = 4000 / (3 - 1) = 2000.
    const chartIds = [1, 2, 3];
    const promise = fetchCharts(chartIds, false, 4000, 10)(dispatch);

    // First chart fires immediately (offset = delay * 0 = 0).
    jest.advanceTimersByTime(0);
    expect(refreshChart).toHaveBeenCalledTimes(1);
    expect((refreshChart as jest.Mock).mock.calls[0][0]).toBe(1);

    // Second chart fires one window later, at t = 2000.
    jest.advanceTimersByTime(2000);
    expect(refreshChart).toHaveBeenCalledTimes(2);
    expect((refreshChart as jest.Mock).mock.calls[1][0]).toBe(2);

    // Nothing fires in between windows.
    jest.advanceTimersByTime(1999);
    expect(refreshChart).toHaveBeenCalledTimes(2);

    // Last chart fires at t = refreshTime = 4000.
    jest.advanceTimersByTime(1);
    expect(refreshChart).toHaveBeenCalledTimes(3);
    expect((refreshChart as jest.Mock).mock.calls[2][0]).toBe(3);

    jest.runAllTimers();
    await promise;
    jest.useRealTimers();
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
    const promise = fetchCharts(chartIds, false, 1000, 10)(dispatch);

    jest.runAllTimers();
    await expect(promise).rejects.toThrow('refresh failed');
    jest.useRealTimers();
    (refreshChart as jest.Mock).mockImplementation(
      () => () => Promise.resolve(),
    );
  });

  test('onRefresh marks refresh complete and triggers filters refresh by default', async () => {
    const { getState } = setup({
      dashboardInfo: {
        metadata: {},
        common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
      },
    });
    useDashboardStateStore.setState({ isFiltersRefreshing: false });
    const dispatched: { type: string }[] = [];
    const dispatch = (action: unknown): unknown => {
      if (typeof action === 'function') {
        return (action as Function)(dispatch, getState);
      }
      dispatched.push(action as { type: string });
      return action;
    };

    await onRefresh([1], true, 0, 10)(dispatch as never);

    expect(dispatched.map(action => action.type)).toContain(ON_REFRESH);
    expect(useDashboardStateStore.getState().isRefreshing).toBe(false);
    expect(useDashboardStateStore.getState().isFiltersRefreshing).toBe(true);
  });

  test('onRefresh skips filter refresh when requested', async () => {
    const { getState } = setup({
      dashboardInfo: {
        metadata: {},
        common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
      },
    });
    useDashboardStateStore.setState({ isFiltersRefreshing: false });
    const dispatched: { type: string }[] = [];
    const dispatch = (action: unknown): unknown => {
      if (typeof action === 'function') {
        return (action as Function)(dispatch, getState);
      }
      dispatched.push(action as { type: string });
      return action;
    };

    await onRefresh([1], true, 0, 10, true)(dispatch as never);

    expect(dispatched.map(action => action.type)).toContain(ON_REFRESH);
    expect(useDashboardStateStore.getState().isRefreshing).toBe(false);
    expect(useDashboardStateStore.getState().isFiltersRefreshing).toBe(false);
  });

  test('onRefresh skips ON_REFRESH and filters refresh for lazy-loaded tabs', async () => {
    const { getState } = setup({
      dashboardInfo: {
        metadata: {},
        common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
      },
    });
    useDashboardStateStore.setState({ isFiltersRefreshing: false });
    const dispatched: { type: string }[] = [];
    const dispatch = (action: unknown): unknown => {
      if (typeof action === 'function') {
        return (action as Function)(dispatch, getState);
      }
      dispatched.push(action as { type: string });
      return action;
    };

    await onRefresh([1], true, 0, 10, false, true)(dispatch as never);

    expect(dispatched.map(action => action.type)).not.toContain(ON_REFRESH);
    expect(useDashboardStateStore.getState().isRefreshing).toBe(false);
    expect(useDashboardStateStore.getState().isFiltersRefreshing).toBe(false);
  });
});
