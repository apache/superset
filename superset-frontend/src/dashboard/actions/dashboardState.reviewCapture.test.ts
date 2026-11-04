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
 * @fileoverview Telling the banner that a dashboard save became a draft.
 *
 * Leaving edit mode only reveals the review banner; it does not make it
 * current. The change request the save produced did not exist when the
 * banner loaded, so the author was left looking at the live version with no
 * Request review beside it until they reloaded the page (R4-07) -- and
 * after a reviewer had sent the change back, at a banner still saying so
 * with no way to send the fix on (QA-14).
 *
 * Every other captured save path announces the capture. This one did not.
 */
import { SupersetClient } from '@superset-ui/core';
import mockDashboardData from 'spec/fixtures/mockDashboardData';
import { emptyFilters } from 'spec/fixtures/mockDashboardFilters';
import { CHANGE_CAPTURED_EVENT } from 'src/features/changeManagement/events';
import { saveDashboardRequest } from './dashboardState';
import { SAVE_TYPE_OVERWRITE } from '../util/constants';

jest.mock('src/utils/navigationUtils', () => ({
  navigateTo: jest.fn(),
  navigateWithState: jest.fn(),
}));

const CAPTURED = {
  id: 12,
  asset_id: 1,
  asset_type: 'dashboard',
  review_required: true,
  message: 'Changes saved. Viewers still see the live version.',
};

const state = {
  dashboardState: { sliceIds: [], hasUnsavedChanges: true },
  dashboardInfo: { id: 1, metadata: { color_scheme: 'supersetColors' } },
  sliceEntities: { slices: {} },
  dashboardFilters: emptyFilters,
  dashboardLayout: { past: [], present: mockDashboardData.positions, future: {} },
  charts: {},
};

const save = async (body: Record<string, unknown>) => {
  // Loosely typed on purpose: this stands in for a thunk-aware dispatch,
  // which receives both plain actions and functions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatch = jest.fn((action: any) => {
    if (action?.type) dispatched.push(action.type);
    return action;
  });
  jest.spyOn(SupersetClient, 'put').mockResolvedValue({ json: body } as any);
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [] },
  } as any);
  await saveDashboardRequest(
    mockDashboardData,
    1,
    SAVE_TYPE_OVERWRITE,
  )(dispatch, (() => state) as any);
  return dispatch;
};

let announced: number;
/**
 * What had already been dispatched when the announcement went out.
 *
 * Captured inside the listener because that is the only moment the
 * question has an answer: a listener reads the store as it is *then*, not
 * as it ends up.
 */
let announcedAfter: { editModeSet: boolean; unsavedCleared: boolean } | null;
let dispatched: string[];
const count = () => {
  announced += 1;
  announcedAfter = {
    editModeSet: dispatched.includes('SET_EDIT_MODE'),
    unsavedCleared: dispatched.includes('SET_UNSAVED_CHANGES'),
  };
};

beforeEach(() => {
  announced = 0;
  announcedAfter = null;
  dispatched = [];
  window.addEventListener(CHANGE_CAPTURED_EVENT, count);
});

afterEach(() => {
  window.removeEventListener(CHANGE_CAPTURED_EVENT, count);
  jest.restoreAllMocks();
});

test('a captured save tells the banner to re-read', async () => {
  await save(CAPTURED);

  expect(announced).toBe(1);
});

test('a captured save still leaves edit mode and says what happened', async () => {
  const dispatch = await save(CAPTURED);

  const types = dispatch.mock.calls.map(([action]) => action.type);
  expect(types).toContain('SET_EDIT_MODE');
  const toasts = dispatch.mock.calls.filter(
    ([action]) => action.type === 'ADD_TOAST',
  );
  expect(toasts).toHaveLength(1);
  expect(toasts[0][0].payload.text).toContain(CAPTURED.message);
});

test('the toast reaches the queue the draft is now sitting in', async () => {
  // The banner is the author's next step on this page, but the save may
  // have left them nowhere else to find it.
  const dispatch = await save(CAPTURED);

  const toast = dispatch.mock.calls.find(
    ([action]) => action.type === 'ADD_TOAST',
  )!;
  expect(toast[0].payload.text).toContain('/approvals/submitted-by-me');
});

test('an ordinary save announces nothing', async () => {
  await save({ result: mockDashboardData, last_modified_time: 0 });

  expect(announced).toBe(0);
});

test('the capture is announced only once the state it publishes is settled', async () => {
  /**
   * This announcement is read, not just counted.
   *
   * A listener puts the live asset back on screen when a save turns out to
   * have been captured, and it decides by reading the store: it must not
   * replace a canvas that still holds work nobody has sent anywhere. The
   * announcement used to go out from the middle of this sequence, with
   * edit mode already off but the unsaved flag not yet cleared, so the
   * listener saw what looked like work in progress and did nothing. The
   * author was left looking at the row they had just deleted, under a
   * banner saying they were seeing the live version, until they reloaded.
   *
   * Nothing about the dispatches themselves was wrong, which is why
   * counting them did not catch it. The order was.
   */
  const dispatch = await save(CAPTURED);

  const types = dispatch.mock.calls.map(([action]) => action.type);
  const clearedUnsaved = types.indexOf('SET_UNSAVED_CHANGES');
  const leftEditMode = types.indexOf('SET_EDIT_MODE');

  expect(clearedUnsaved).toBeGreaterThan(-1);
  expect(leftEditMode).toBeGreaterThan(-1);
  // Both have to be in the store before anybody is told to look at it.
  expect(announcedAfter).toEqual({ editModeSet: true, unsavedCleared: true });
});
