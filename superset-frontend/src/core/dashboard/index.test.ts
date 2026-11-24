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
import { configureStore } from '@reduxjs/toolkit';
import dashboardStateReducer from 'src/dashboard/reducers/dashboardState';
import {
  SET_UNSAVED_CHANGES,
  SET_REFRESH_FREQUENCY,
} from 'src/dashboard/actions/dashboardState';

let mockStore = makeStore();

function makeStore() {
  return configureStore({
    reducer: { dashboardState: dashboardStateReducer as any },
    preloadedState: { dashboardState: { hasUnsavedChanges: false } as any },
  });
}

jest.mock('src/views/store', () => ({
  get store() {
    return mockStore;
  },
  setupStore: jest.fn(),
}));

// Module under test — imported after mocks
// eslint-disable-next-line import/first
import { dashboard, registerDashboardSaveHandle } from '.';

const setUnsaved = (hasUnsavedChanges: boolean) =>
  mockStore.dispatch({
    type: SET_UNSAVED_CHANGES,
    payload: { hasUnsavedChanges },
  });

beforeEach(() => {
  mockStore = makeStore();
});

describe('hasUnsavedChanges', () => {
  test('is false when the dashboard has no unsaved edits', () => {
    expect(dashboard.hasUnsavedChanges()).toBe(false);
  });

  test('reports what the store holds', () => {
    setUnsaved(true);
    expect(dashboard.hasUnsavedChanges()).toBe(true);
    setUnsaved(false);
    expect(dashboard.hasUnsavedChanges()).toBe(false);
  });

  test('is false rather than undefined before a dashboard is hydrated', () => {
    mockStore = configureStore({
      reducer: { dashboardState: dashboardStateReducer as any },
      preloadedState: { dashboardState: {} as any },
    });
    expect(dashboard.hasUnsavedChanges()).toBe(false);
  });
});

describe('onDidChangeUnsavedChanges', () => {
  test('fires with the new answer when it changes', () => {
    const listener = jest.fn();
    const sub = dashboard.onDidChangeUnsavedChanges(listener);

    setUnsaved(true);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(true);
    sub.dispose();
  });

  test('does not fire when the answer is unchanged', () => {
    setUnsaved(true);
    const listener = jest.fn();
    const sub = dashboard.onDidChangeUnsavedChanges(listener);

    // Same value written again: the store updates, the answer does not.
    setUnsaved(true);

    expect(listener).not.toHaveBeenCalled();
    sub.dispose();
  });

  test('fires for a change made by an action other than SET_UNSAVED_CHANGES', () => {
    // The guarantee a single action listener could not give. Making a refresh
    // frequency persistent raises the flag through its own action, and a
    // surface whose appearance depends on the flag has to see that.
    const listener = jest.fn();
    const sub = dashboard.onDidChangeUnsavedChanges(listener);

    mockStore.dispatch({
      type: SET_REFRESH_FREQUENCY,
      refreshFrequency: 60,
      isPersistent: true,
    });

    expect(listener).toHaveBeenCalledWith(true);
    sub.dispose();
  });

  test('stops delivering once disposed', () => {
    const listener = jest.fn();
    const sub = dashboard.onDidChangeUnsavedChanges(listener);
    sub.dispose();

    setUnsaved(true);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('save', () => {
  test('performs the save the header lent to the namespace', async () => {
    const handle = jest.fn();
    const registration = registerDashboardSaveHandle(handle);

    await dashboard.save();

    expect(handle).toHaveBeenCalledTimes(1);
    registration.dispose();
  });

  test('resolves without effect when no dashboard is being edited', async () => {
    await expect(dashboard.save()).resolves.toBeUndefined();
  });

  test('does nothing once the header has withdrawn its save', async () => {
    const handle = jest.fn();
    registerDashboardSaveHandle(handle).dispose();

    await dashboard.save();

    expect(handle).not.toHaveBeenCalled();
  });

  test('keeps the newest save when a stale registration is disposed', async () => {
    // The header re-registers whenever its save callback identity changes,
    // and React runs the previous effect's cleanup after the new effect has
    // run. Without the identity guard that cleanup would withdraw the handle
    // that had just replaced it, leaving the namespace unable to save.
    const stale = jest.fn();
    const current = jest.fn();
    const staleRegistration = registerDashboardSaveHandle(stale);
    const currentRegistration = registerDashboardSaveHandle(current);

    staleRegistration.dispose();
    await dashboard.save();

    expect(current).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
    currentRegistration.dispose();
  });
});
