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
import undoable from 'redux-undo';
import { UNDO_LIMIT } from '../util/constants';
import {
  UPDATE_COMPONENTS,
  DELETE_COMPONENT,
  CREATE_COMPONENT,
  CREATE_TOP_LEVEL_TABS,
  DELETE_TOP_LEVEL_TABS,
  RESIZE_COMPONENT,
  MOVE_COMPONENT,
  HANDLE_COMPONENT_DROP,
} from '../actions/dashboardLayout';

import { HYDRATE_DASHBOARD } from '../actions/hydrate';

import dashboardLayout from './dashboardLayout';

// List of actions that should trigger undo history
const TRACKED_ACTIONS = [
  HYDRATE_DASHBOARD,
  UPDATE_COMPONENTS,
  DELETE_COMPONENT,
  CREATE_COMPONENT,
  CREATE_TOP_LEVEL_TABS,
  DELETE_TOP_LEVEL_TABS,
  RESIZE_COMPONENT,
  MOVE_COMPONENT,
  HANDLE_COMPONENT_DROP,
];

/*
 * WORKAROUND FOR REDUX-UNDO FILTER BUG
 *
 * PROBLEM:
 * Redux-undo's filter functionality is broken in multiple versions. Users report that
 * actions are either incorrectly filtered out or incorrectly included in undo history,
 * making undo/redo buttons not work when they should.
 *
 * AFFECTED VERSIONS:
 * - Beta versions (like 1.0.0-beta9-9-7 currently used by Superset)
 * - Stable versions up to 1.1.0
 * Both includeAction/excludeAction helpers AND custom filter functions fail.
 *
 * WHY FILTERING MATTERS:
 * Without filtering, ALL Redux actions (API calls, toasts, theme changes, etc.) would
 * create undo history entries, making undo/redo confusing and inefficient. We only want
 * dashboard layout changes to be undoable.
 *
 * SOLUTION:
 * Instead of using redux-undo's broken filter system, we filter at the reducer level
 * by wrapping the base dashboardLayout reducer. This approach:
 * 1. Prevents non-layout actions from reaching the reducer (so no state changes)
 * 2. Allows redux-undo to work without any filtering (which works fine)
 * 3. Results in only layout actions being tracked in undo history
 * 4. Provides the same filtering result without hitting the redux-undo bug
 *
 * WHEN TO REMOVE:
 * This can be reverted when redux-undo fixes their filter functionality by:
 * 1. Removing the layoutOnlyReducer wrapper
 * 2. Using the base dashboardLayout reducer directly
 * 3. Adding back: filter: includeAction(TRACKED_ACTIONS)
 *
 * BUG REPORT:
 * - https://github.com/omnidan/redux-undo/issues/306
 */

// Wrapper reducer that filters actions before they reach the dashboardLayout reducer
const layoutOnlyReducer = (state, action) => {
  // Only allow layout-related actions to reach the dashboardLayout reducer
  if (!TRACKED_ACTIONS.includes(action.type)) return state;

  // For layout actions, proceed with normal dashboardLayout reduction
  return dashboardLayout(state, action);
};

const undoableReducer = undoable(layoutOnlyReducer, {
  // +1 because length of history seems max out at limit - 1
  // +1 again so we can detect if we've exceeded the limit
  limit: UNDO_LIMIT + 2,
  ignoreInitialState: true,
});

export default undoableReducer;
