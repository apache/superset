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

import undoableExploreReducer from './undoableExploreReducer';
import {
  setControlValue,
  updateChartTitle,
  undoExploreAction,
  redoExploreAction,
  clearExploreHistory,
} from '../actions/exploreActions';

const initialState = {
  past: [],
  present: {
    form_data: {
      viz_type: 'table',
      datasource: '1__table',
    },
    controls: {},
    sliceName: 'Test Chart',
  },
  future: [],
};

test('creates undo history for SET_FIELD_VALUE action', () => {
  // First action: initial state moves to past
  const state1 = undoableExploreReducer(
    initialState,
    setControlValue('metric', 'count', []),
  );

  expect(state1.past).toHaveLength(1);
  expect(state1.present.form_data.metric).toBe('count');
  expect(state1.future).toHaveLength(0);

  // Second action: previous present moves to past
  const state2 = undoableExploreReducer(
    state1,
    setControlValue('metric', 'sum', []),
  );

  expect(state2.past).toHaveLength(2);
  expect(state2.present.form_data.metric).toBe('sum');
  expect(state2.future).toHaveLength(0);
});

test('creates undo history for UPDATE_CHART_TITLE action', () => {
  // UPDATE_CHART_TITLE should create history, but only after a second action
  // This is because redux-undo's includeAction filter works differently for different action types
  const state1 = undoableExploreReducer(
    initialState,
    updateChartTitle('New Title'),
  );

  // First action doesn't add to past for UPDATE_CHART_TITLE
  expect(state1.past).toHaveLength(0);
  expect(state1.present.sliceName).toBe('New Title');
  expect(state1.future).toHaveLength(0);

  // Second action adds previous state to past
  const state2 = undoableExploreReducer(
    state1,
    updateChartTitle('Another Title'),
  );

  expect(state2.past).toHaveLength(1);
  expect(state2.present.sliceName).toBe('Another Title');
  expect(state2.future).toHaveLength(0);
});

test('undo restores previous state', () => {
  const state1 = undoableExploreReducer(
    initialState,
    setControlValue('metric', 'count', []),
  );
  const state2 = undoableExploreReducer(
    state1,
    setControlValue('metric', 'sum', []),
  );

  // After 2 SET_FIELD_VALUE actions: past = [state1]
  expect(state2.past).toHaveLength(1);

  const undoneState = undoableExploreReducer(state2, undoExploreAction());

  // After undo: past = [], present = state1, future = [state2]
  expect(undoneState.past).toHaveLength(0);
  expect(undoneState.present.form_data.metric).toBe('count');
  expect(undoneState.future).toHaveLength(1);
});

test('redo restores future state', () => {
  const state1 = undoableExploreReducer(
    initialState,
    setControlValue('metric', 'count', []),
  );
  const state2 = undoableExploreReducer(
    state1,
    setControlValue('metric', 'sum', []),
  );
  const undoneState = undoableExploreReducer(state2, undoExploreAction());
  const redoneState = undoableExploreReducer(undoneState, redoExploreAction());

  expect(redoneState.past).toHaveLength(1);
  expect(redoneState.present.form_data.metric).toBe('sum');
  expect(redoneState.future).toHaveLength(0);
});

test('multiple undo/redo operations work correctly', () => {
  let state = initialState;

  // Make 3 changes
  state = undoableExploreReducer(state, setControlValue('metric', 'count', []));
  state = undoableExploreReducer(state, setControlValue('metric', 'sum', []));
  state = undoableExploreReducer(state, setControlValue('metric', 'avg', []));

  expect(state.present.form_data.metric).toBe('avg');
  expect(state.past).toHaveLength(2);

  // Undo twice
  state = undoableExploreReducer(state, undoExploreAction());
  state = undoableExploreReducer(state, undoExploreAction());

  expect(state.present.form_data.metric).toBe('count');
  expect(state.past).toHaveLength(0);
  expect(state.future).toHaveLength(2);

  // Redo once
  state = undoableExploreReducer(state, redoExploreAction());

  expect(state.present.form_data.metric).toBe('sum');
  expect(state.past).toHaveLength(1);
  expect(state.future).toHaveLength(1);
});

test('clearHistory resets undo/redo history', () => {
  let state = initialState;

  state = undoableExploreReducer(state, setControlValue('metric', 'count', []));
  state = undoableExploreReducer(state, setControlValue('metric', 'sum', []));

  expect(state.past).toHaveLength(1);

  state = undoableExploreReducer(state, clearExploreHistory());

  expect(state.past).toHaveLength(0);
  expect(state.future).toHaveLength(0);
});

test('new action after undo clears future history', () => {
  let state = initialState;

  // Make 3 changes
  state = undoableExploreReducer(state, setControlValue('metric', 'count', []));
  state = undoableExploreReducer(state, setControlValue('metric', 'sum', []));
  state = undoableExploreReducer(state, setControlValue('metric', 'avg', []));

  // Undo twice
  state = undoableExploreReducer(state, undoExploreAction());
  state = undoableExploreReducer(state, undoExploreAction());

  expect(state.present.form_data.metric).toBe('count');
  expect(state.future).toHaveLength(2);

  // Make a new change - this should clear the future
  state = undoableExploreReducer(state, setControlValue('metric', 'max', []));

  expect(state.present.form_data.metric).toBe('max');
  expect(state.future).toHaveLength(0);
  expect(state.past).toHaveLength(1);
});

test('handles null values correctly (cleared fields)', () => {
  let state = initialState;

  // Set a value
  state = undoableExploreReducer(
    state,
    setControlValue('label_type', 'key_value', []),
  );
  expect(state.present.form_data.label_type).toBe('key_value');

  // Clear the value (set to null)
  state = undoableExploreReducer(
    state,
    setControlValue('label_type', null, []),
  );
  expect(state.present.form_data.label_type).toBe(null);

  // Undo should restore the previous value
  state = undoableExploreReducer(state, undoExploreAction());
  expect(state.present.form_data.label_type).toBe('key_value');

  // Redo should restore the null value
  state = undoableExploreReducer(state, redoExploreAction());
  expect(state.present.form_data.label_type).toBe(null);
});
