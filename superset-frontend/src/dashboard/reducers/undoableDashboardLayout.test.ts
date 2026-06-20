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
import type { AnyAction } from 'redux';
import { ActionCreators } from 'redux-undo';

import undoableLayoutReducer from 'src/dashboard/reducers/undoableDashboardLayout';
import { UPDATE_COMPONENTS } from 'src/dashboard/actions/dashboardLayout';
import { HYDRATE_DASHBOARD } from 'src/dashboard/actions/hydrate';
import type { DashboardLayout } from 'src/dashboard/types';
import {
  DASHBOARD_ROOT_ID,
  DASHBOARD_GRID_ID,
  DASHBOARD_HEADER_ID,
} from 'src/dashboard/util/constants';
import {
  DASHBOARD_ROOT_TYPE,
  DASHBOARD_GRID_TYPE,
  DASHBOARD_HEADER_TYPE,
  CHART_TYPE,
} from 'src/dashboard/util/componentTypes';

const reducer = undoableLayoutReducer;

// A minimal but valid dashboard layout always contains the root component.
const makeValidLayout = (): DashboardLayout => ({
  [DASHBOARD_ROOT_ID]: {
    id: DASHBOARD_ROOT_ID,
    type: DASHBOARD_ROOT_TYPE,
    children: [DASHBOARD_GRID_ID],
    meta: {},
  },
  [DASHBOARD_GRID_ID]: {
    id: DASHBOARD_GRID_ID,
    type: DASHBOARD_GRID_TYPE,
    parents: [DASHBOARD_ROOT_ID],
    children: [],
    meta: {},
  },
  [DASHBOARD_HEADER_ID]: {
    id: DASHBOARD_HEADER_ID,
    type: DASHBOARD_HEADER_TYPE,
    children: [],
    meta: { text: '[ untitled dashboard ]' },
  },
});

const chartComponent = (): DashboardLayout => ({
  'CHART-abc': { id: 'CHART-abc', type: CHART_TYPE, children: [], meta: {} },
});

const hydrate = (present: DashboardLayout): AnyAction => ({
  type: HYDRATE_DASHBOARD,
  data: { dashboardLayout: { present } },
});

const updateComponents = (nextComponents: DashboardLayout): AnyAction => ({
  type: UPDATE_COMPONENTS,
  payload: { nextComponents },
});

const init = () => reducer(undefined, { type: '@@INIT' });

test('hydrating a dashboard leaves an empty, disabled undo history', () => {
  const state = reducer(init(), hydrate(makeValidLayout()));

  expect(state.present[DASHBOARD_ROOT_ID]).toBeDefined();
  // Hydration is not a user edit, so Undo (past) and Redo (future) start empty
  expect(state.past).toHaveLength(0);
  expect(state.future).toHaveLength(0);
});

test('a stale/empty baseline left by a premature clearHistory does not survive hydration', () => {
  // Reproduces the issue: clearing history while the layout is still the
  // pre-hydration `{}` arms redux-undo to capture that empty layout on the next
  // tracked action (it resets `_latestUnfiltered` to the current, empty present).
  let state = init();
  state = reducer(state, ActionCreators.clearHistory());

  // Without the fix, HYDRATE_DASHBOARD would now push the empty `{}` into `past`,
  // enabling an Undo that reverts to an empty layout and crashes the dashboard.
  state = reducer(state, hydrate(makeValidLayout()));

  expect(state.present[DASHBOARD_ROOT_ID]).toBeDefined();
  expect(state.past).toHaveLength(0);
});

test('re-hydrating with a new dashboard drops the previous dashboard from the undo stack', () => {
  // Simulates SPA navigation between dashboards without a full reload.
  let state = reducer(init(), hydrate(makeValidLayout()));

  // A genuine edit on the first dashboard creates real undo history.
  state = reducer(state, updateComponents(chartComponent()));
  expect(state.past.length).toBeGreaterThan(0);

  // Opening another dashboard re-hydrates and must reset the history so the
  // previous dashboard's layout is no longer undoable.
  state = reducer(state, hydrate(makeValidLayout()));

  expect(state.present[DASHBOARD_ROOT_ID]).toBeDefined();
  expect(state.past).toHaveLength(0);
  expect(state.future).toHaveLength(0);
});

test('undo never reverts the layout to an invalid state', () => {
  // Build a corrupt history (valid present, empty baseline in `past`) the same
  // way it arises in the wild, then exercise Undo.
  let state = init();
  state = reducer(state, ActionCreators.clearHistory()); // arms the empty baseline
  // A tracked action other than hydrate captures the empty `{}` into `past`.
  state = reducer(state, updateComponents(makeValidLayout()));
  expect(state.present[DASHBOARD_ROOT_ID]).toBeDefined();
  expect(state.past).toHaveLength(1); // the corrupt, empty baseline

  const before = state.present;
  state = reducer(state, ActionCreators.undo());

  // The undo is rejected: the valid layout is kept instead of exposing the
  // empty one, so rendering can't throw `undefined.type`.
  expect(state.present[DASHBOARD_ROOT_ID]).toBeDefined();
  expect(state.present).toBe(before);
  // History is left untouched, so undoLayoutAction() won't read an emptied
  // stack as a fully-reverted, clean dashboard.
  expect(state.past).toHaveLength(1);
});

test('undo still reverts a genuine layout edit', () => {
  let state = reducer(init(), hydrate(makeValidLayout()));

  state = reducer(state, updateComponents(chartComponent()));
  expect(state.present['CHART-abc']).toBeDefined();
  expect(state.past).toHaveLength(1);

  state = reducer(state, ActionCreators.undo());

  // The added chart is undone, and the layout is still valid.
  expect(state.present['CHART-abc']).toBeUndefined();
  expect(state.present[DASHBOARD_ROOT_ID]).toBeDefined();
  expect(state.past).toHaveLength(0);
});
