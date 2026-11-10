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
 * @fileoverview Saying that a dashboard save was accepted and not applied.
 *
 * A `202` leaves the live dashboard untouched, and nothing on the page knows
 * it: whatever surface is holding the write was drawn before this save
 * existed, so without an announcement the author was left looking at the
 * asset as it stood when the page loaded until they reloaded it (R4-07,
 * QA-14).
 *
 * Every other deferred save path announces. This one did not.
 */
import { SupersetClient } from '@superset-ui/core';
import mockDashboardData from 'spec/fixtures/mockDashboardData';
import { emptyFilters } from 'spec/fixtures/mockDashboardFilters';
import { onDeferred } from 'src/core/deferredWrites';
import { saveDashboardRequest } from './dashboardState';
import { SAVE_TYPE_OVERWRITE } from '../util/constants';

jest.mock('src/utils/navigationUtils', () => ({
  navigateTo: jest.fn(),
  navigateWithState: jest.fn(),
}));

const DEFERRED = {
  id: 12,
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

let announced: { message: string; reference?: { id: number | string } }[];
/**
 * What had already been dispatched when the announcement went out.
 *
 * Captured inside the listener because that is the only moment the
 * question has an answer: a listener reads the store as it is *then*, not
 * as it ends up.
 */
let announcedAfter: { editModeSet: boolean; unsavedCleared: boolean } | null;
let dispatched: string[];
let subscription: { dispose: () => void };

const save = async (body: Record<string, unknown>) => {
  // Loosely typed on purpose: this stands in for a thunk-aware dispatch,
  // which receives both plain actions and functions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatch = jest.fn((action: any) => {
    if (action?.type) dispatched.push(action.type);
    return action;
  });
  jest.spyOn(SupersetClient, 'put').mockResolvedValue({
    json: body,
    response: { status: body === DEFERRED ? 202 : 200 },
  } as any);
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

beforeEach(() => {
  announced = [];
  announcedAfter = null;
  dispatched = [];
  subscription = onDeferred(write => {
    announced.push(write);
    announcedAfter = {
      editModeSet: dispatched.includes('SET_EDIT_MODE'),
      unsavedCleared: dispatched.includes('SET_UNSAVED_CHANGES'),
    };
  });
});

afterEach(() => {
  subscription.dispose();
  jest.restoreAllMocks();
});

test('a deferred save says so, and says what the server said', async () => {
  // The host does not word this itself: only whoever held the write knows
  // what happens next, so the server's own sentence is carried through and
  // the reference it gave is passed on with it.
  await save(DEFERRED);

  expect(announced).toEqual([
    { message: DEFERRED.message, reference: { id: 12 } },
  ]);
});

test('a deferred save keeps the author in edit mode and says what happened', async () => {
  // It used to throw them out on every save. Whatever is holding the write
  // renders in edit mode too, so that bought nothing and cost them their
  // session: each re-entry reopened the canvas seeded from the live asset
  // rather than from the version they had just saved.
  const dispatch = await save(DEFERRED);

  const types = dispatch.mock.calls.map(([action]) => action.type);
  expect(types).not.toContain('SET_EDIT_MODE');
  const toasts = dispatch.mock.calls.filter(
    ([action]) => action.type === 'ADD_TOAST',
  );
  expect(toasts).toHaveLength(1);
  expect(toasts[0][0].payload.text).toBe(DEFERRED.message);
});

test('an ordinary save announces nothing', async () => {
  await save({ result: mockDashboardData, last_modified_time: 0 });

  expect(announced).toEqual([]);
});

test('the deferral is announced only once the state it publishes is settled', async () => {
  /**
   * This announcement is read, not just counted.
   *
   * A listener puts the live asset back on screen when a save turns out to
   * have been deferred, and it decides by reading the store: it must not
   * replace a canvas that still holds work nobody has sent anywhere. The
   * announcement used to go out from the middle of this sequence, with
   * edit mode already off but the unsaved flag not yet cleared, so the
   * listener saw what looked like work in progress and did nothing. The
   * author was left looking at the row they had just deleted until they
   * reloaded.
   *
   * Nothing about the dispatches themselves was wrong, which is why
   * counting them did not catch it. The order was.
   */
  const dispatch = await save(DEFERRED);

  const types = dispatch.mock.calls.map(([action]) => action.type);
  expect(types).toContain('SET_UNSAVED_CHANGES');
  // The flag has to be in the store before anybody is told to look at it.
  expect(announcedAfter).toEqual({ editModeSet: false, unsavedCleared: true });
});
