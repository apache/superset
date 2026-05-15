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
import { setComponentThemeId } from './setComponentThemeId';
import { UPDATE_COMPONENTS } from './dashboardLayout';

const componentFixture = {
  id: 'CHART-abc',
  type: 'CHART',
  children: [],
  parents: ['ROOT_ID', 'ROW-1'],
  meta: {
    chartId: 42,
    sliceName: 'My Chart',
    width: 4,
    height: 30,
  },
};

const buildState = () =>
  ({
    dashboardLayout: {
      present: {
        'CHART-abc': componentFixture,
      },
    },
    // The thunk wrapper (`setUnsavedChangesAfterAction`) reads this.
    dashboardState: { hasUnsavedChanges: false },
  }) as unknown as ReturnType<
    Parameters<ReturnType<typeof setComponentThemeId>>[1]
  >;

// `updateComponents` is wrapped by `setUnsavedChangesAfterAction`, which
// returns a thunk. The outer dispatch receives the thunk; we recursively
// execute it to capture the actual UPDATE_COMPONENTS action object.
const dispatchedActions = (
  outer: (dispatch: any, getState: any) => void,
  getState: any,
): any[] => {
  const actions: any[] = [];
  const dispatch = (action: any) => {
    if (typeof action === 'function') {
      action(dispatch, getState);
    } else {
      actions.push(action);
    }
  };
  outer(dispatch, getState);
  return actions;
};

test('dispatches an UPDATE_COMPONENTS that preserves existing meta and sets themeId', () => {
  const actions = dispatchedActions(setComponentThemeId('CHART-abc', 7), () =>
    buildState(),
  );
  const action = actions.find(a => a.type === UPDATE_COMPONENTS);
  expect(action).toBeDefined();
  expect(action.payload.nextComponents['CHART-abc'].meta).toEqual({
    chartId: 42,
    sliceName: 'My Chart',
    width: 4,
    height: 30,
    themeId: 7,
  });
});

test('clearing the override stores explicit null (not undefined)', () => {
  const actions = dispatchedActions(
    setComponentThemeId('CHART-abc', null),
    () => buildState(),
  );
  const action = actions.find(a => a.type === UPDATE_COMPONENTS);
  expect(action.payload.nextComponents['CHART-abc'].meta.themeId).toBeNull();
});

test('no-op when the component is missing from layout', () => {
  const actions = dispatchedActions(
    setComponentThemeId('CHART-missing', 7),
    () => buildState(),
  );
  expect(actions).toEqual([]);
});
