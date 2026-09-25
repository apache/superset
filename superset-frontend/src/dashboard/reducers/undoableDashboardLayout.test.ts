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
// eslint-disable-next-line import/named
import {
  ActionCreators as UndoActionCreators,
  StateWithHistory,
} from 'redux-undo';

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
const makeValidLayout = (
  title = '[ untitled dashboard ]',
): DashboardLayout => ({
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
    meta: { text: title },
  },
});

// The frontend locks redux-undo to 1.1.0, whose `clearHistory()` under
// `ignoreInitialState` resets `_latestUnfiltered` to null. That makes a rootless
// layout impossible to push onto `past` through normal layout actions, so the
// guard's corrupt-history precondition is seeded directly. `makeHistory` mirrors
// redux-undo's `StateWithHistory` shape — `past`/`present`/`future` is all that
// `undo()` needs to compute the previous state.
const makeHistory = (
  past: DashboardLayout[],
  present: DashboardLayout,
  future: DashboardLayout[] = [],
): StateWithHistory<DashboardLayout> => ({ past, present, future });

const hydrate = (present: DashboardLayout): AnyAction => ({
  type: HYDRATE_DASHBOARD,
  data: { dashboardLayout: { present } },
});

test('hydrating a dashboard leaves an empty, disabled undo history', () => {
  const initial = reducer(undefined, { type: '@@INIT' });
  const state = reducer(initial, hydrate(makeValidLayout()));

  expect(state.present[DASHBOARD_ROOT_ID]).toBeDefined();
  // Hydration is not a user edit, so Undo (past) and Redo (future) start empty.
  expect(state.past).toHaveLength(0);
  expect(state.future).toHaveLength(0);
});

test('a layout edit is applied through the wrapped reducer', () => {
  const hydrated = reducer(
    reducer(undefined, { type: '@@INIT' }),
    hydrate(makeValidLayout()),
  );

  const update: AnyAction = {
    type: UPDATE_COMPONENTS,
    payload: {
      nextComponents: {
        'CHART-1': { id: 'CHART-1', type: CHART_TYPE, children: [], meta: {} },
      },
    },
  };
  const state = reducer(hydrated, update);

  expect(state.present['CHART-1']).toBeDefined();
  expect(state.present[DASHBOARD_ROOT_ID]).toBeDefined();
});

test('re-hydrating a different dashboard clears the previous dashboard from the undo stack', () => {
  // Simulates SPA navigation: dashboard A already has undo history when B opens.
  const dashboardA = makeHistory(
    [makeValidLayout('A v1')],
    makeValidLayout('A v2'),
  );

  const state = reducer(dashboardA, hydrate(makeValidLayout('B')));

  expect(state.present[DASHBOARD_ROOT_ID]).toBeDefined();
  expect(state.past).toHaveLength(0);
  expect(state.future).toHaveLength(0);
});

test('undo never reverts the layout to an invalid (rootless) state', () => {
  // A rootless `{}` baseline sits at the head of `past`; a plain redux-undo
  // undo() here would move it into `present` and crash rendering with
  // `Cannot read properties of undefined (reading 'type')`.
  const corrupt = makeHistory([{}], makeValidLayout());
  const before = corrupt.present;

  const state = reducer(corrupt, UndoActionCreators.undo());

  // The guard rejects the transition: the valid layout is kept unchanged...
  expect(state.present[DASHBOARD_ROOT_ID]).toBeDefined();
  expect(state.present).toBe(before);
  // ...and history is left intact, so undoLayoutAction() won't misread an
  // emptied stack as a fully-reverted, clean dashboard.
  expect(state.past).toHaveLength(1);
});

test('the guard does not interfere with a normal undo between valid layouts', () => {
  const previous = makeValidLayout('previous');
  const current = makeValidLayout('current');

  const state = reducer(
    makeHistory([previous], current),
    UndoActionCreators.undo(),
  );

  // A valid -> valid undo proceeds normally.
  expect(state.present).toBe(previous);
  expect(state.past).toHaveLength(0);
  expect(state.future).toHaveLength(1);
});
