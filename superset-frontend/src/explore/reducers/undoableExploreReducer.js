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
import { UNDO_LIMIT } from 'src/dashboard/util/constants';
import { SET_FIELD_VALUE, UPDATE_CHART_TITLE } from '../actions/exploreActions';
import { HYDRATE_EXPLORE } from '../actions/hydrateExplore';
import exploreReducer from './exploreReducer';

// List of actions that should trigger undo history
// These are user-initiated chart configuration changes
const TRACKED_ACTIONS = [
  HYDRATE_EXPLORE, // Initial chart load
  SET_FIELD_VALUE, // Control value changes (most important!)
  UPDATE_CHART_TITLE, // Chart title changes
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
 * Without filtering, ALL Redux actions (API calls, toasts, favorites, etc.) would
 * create undo history entries, making undo/redo confusing and inefficient. We only want
 * chart configuration changes to be undoable.
 *
 * SOLUTION:
 * Instead of using redux-undo's broken filter system, we filter at the reducer level
 * by wrapping the base exploreReducer. This approach:
 * 1. Prevents non-configuration actions from reaching the reducer (so no state changes)
 * 2. Allows redux-undo to work without any filtering (which works fine)
 * 3. Results in only configuration actions being tracked in undo history
 * 4. Provides the same filtering result without hitting the redux-undo bug
 *
 * WHEN TO REMOVE:
 * This can be reverted when redux-undo fixes their filter functionality by:
 * 1. Removing the exploreOnlyReducer wrapper
 * 2. Using the base exploreReducer directly
 * 3. Adding back: filter: includeAction(TRACKED_ACTIONS)
 *
 * BUG REPORT:
 * - https://github.com/omnidan/redux-undo/issues/306
 */

// Wrapper reducer that filters actions before they reach the exploreReducer
const exploreOnlyReducer = (state, action) => {
  // IMPORTANT: Always let the reducer handle the action if state is undefined
  // This ensures proper initialization on first load
  if (state === undefined) {
    return exploreReducer(state, action);
  }

  // Only allow tracked actions to reach the exploreReducer
  if (!TRACKED_ACTIONS.includes(action.type)) {
    return state;
  }

  // For tracked actions, proceed with normal exploreReducer reduction
  return exploreReducer(state, action);
};

const undoableReducer = undoable(exploreOnlyReducer, {
  // +1 because length of history seems max out at limit - 1
  // +1 again so we can detect if we've exceeded the limit
  limit: UNDO_LIMIT + 2,
  ignoreInitialState: true,
});

export default undoableReducer;
