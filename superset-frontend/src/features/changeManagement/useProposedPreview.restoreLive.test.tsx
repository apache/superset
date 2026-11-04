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

/**
 * The page lied about what it was showing.
 *
 * An author deleted a row, pressed Save, and landed in view mode looking at
 * a dashboard with the row gone -- under a banner reading "you and viewers
 * are both seeing the live version", with Show changes switched off. The
 * save had been captured, so the live asset still had the row; only the
 * screen said otherwise, and only until a reload. An author in front of
 * that believes they have deleted live content.
 *
 * The cause is that a captured save is the one save that does not become
 * the asset, and nothing put the asset back.
 */
import { act, renderHook } from '@testing-library/react';
import { createWrapper } from 'spec/helpers/testing-library';
import { useProposedPreview } from './useProposedPreview';
import type { ChangeRequest } from './types';

jest.mock('src/features/versionHistory/api', () => ({
  fetchDashboardHydrationData: jest.fn(async () => ({
    dashboard: {
      id: 5,
      dashboard_title: 'Live title',
      position_data: { ROW: { id: 'ROW' } },
      metadata: {},
    },
    charts: [{ id: 11 }],
  })),
}));

jest.mock('src/dashboard/actions/hydrate', () => ({
  hydrateDashboard: jest.fn(params => ({ type: 'TEST_HYDRATE', params })),
}));

const { fetchDashboardHydrationData } = jest.requireMock(
  'src/features/versionHistory/api',
);
const { hydrateDashboard } = jest.requireMock('src/dashboard/actions/hydrate');

const request = {
  id: 1,
  asset_type: 'dashboard',
  asset_id: 5,
  status: 'draft',
  operation: 'update',
  command: null,
  proposed: { dashboard_title: 'Mine' },
} as unknown as ChangeRequest;

const setup = (
  dashboardState: Record<string, unknown> = {},
  overrides: Partial<ChangeRequest> = {},
) =>
  renderHook(() => useProposedPreview({ ...request, ...overrides }), {
    wrapper: createWrapper({
      useRedux: true,
      useRouter: true,
      initialState: { dashboardState },
    }),
  });

beforeEach(() => {
  jest.clearAllMocks();
});

test('a captured save puts the live dashboard back on screen', async () => {
  // Save has already left edit mode and cleared the unsaved flag by the
  // time it announces, which is the state this arrives in.
  const { result } = setup({ editMode: false, hasUnsavedChanges: false });

  await act(async () => {
    await result.current.restoreLive();
  });

  expect(fetchDashboardHydrationData).toHaveBeenCalledWith(5);
  expect(hydrateDashboard).toHaveBeenCalledTimes(1);
  const { dashboard, charts, editMode } = hydrateDashboard.mock.calls[0][0];
  // The live asset, not the proposal: the proposed title is what the author
  // was shown before, and showing it again is the bug.
  expect(dashboard.dashboard_title).toBe('Live title');
  // The layout and the charts come from one fetch of one asset. Hydrating a
  // layout against charts resolved for a different one crashed the page on
  // an unguarded read in `SliceHeader`, which is how an earlier attempt at
  // this was found.
  expect(charts).toEqual([{ id: 11 }]);
  // Hydration otherwise reads edit mode off the `edit` URL parameter, which
  // outlives the navigation that set it.
  expect(editMode).toBe(false);
});

test('it leaves the page alone while the author is still editing', async () => {
  // The Properties and Embed modals announce the same captured-write event
  // without leaving edit mode. An author who renames a dashboard in the
  // middle of a layout edit would otherwise have the canvas replaced with
  // the live layout and be dropped out of edit mode, losing work the server
  // has never seen -- a worse fault than the one above.
  const { result } = setup({ editMode: true, hasUnsavedChanges: true });

  await act(async () => {
    await result.current.restoreLive();
  });

  expect(fetchDashboardHydrationData).not.toHaveBeenCalled();
  expect(hydrateDashboard).not.toHaveBeenCalled();
});

test('it leaves the page alone when there are unsent edits in view mode', async () => {
  const { result } = setup({ editMode: false, hasUnsavedChanges: true });

  await act(async () => {
    await result.current.restoreLive();
  });

  expect(hydrateDashboard).not.toHaveBeenCalled();
});

test('a chart has no canvas to put back', async () => {
  // Explore re-renders from its own controls, and there is no dashboard
  // hydration to do. Fetching one would be a request for an asset of the
  // wrong type.
  const { result } = setup(
    { editMode: false, hasUnsavedChanges: false },
    { asset_type: 'chart' },
  );

  await act(async () => {
    await result.current.restoreLive();
  });

  expect(fetchDashboardHydrationData).not.toHaveBeenCalled();
});

test('a failed fetch leaves the page as it was', async () => {
  // The author's own work is on screen. Replacing it with nothing, or
  // raising a second toast after a save that succeeded, would both be
  // worse than a banner that is wrong until the next reload.
  fetchDashboardHydrationData.mockRejectedValueOnce(new Error('no'));
  const { result } = setup({ editMode: false, hasUnsavedChanges: false });

  await act(async () => {
    await result.current.restoreLive();
  });

  expect(hydrateDashboard).not.toHaveBeenCalled();
});
