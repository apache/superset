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
import { isFeatureEnabled } from '@superset-ui/core';
import { versionSessionLogMiddleware } from './sessionLogMiddleware';
import {
  APPEND_VERSION_SESSION_LOG,
  CLEAR_VERSION_SESSION_LOG,
} from './reducer';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const buildStore = (state: object = {}) => ({
  getState: jest.fn(() => state),
  dispatch: jest.fn(),
});

const run = (store: ReturnType<typeof buildStore>, action: object) => {
  const next = jest.fn(value => value);
  versionSessionLogMiddleware(store)(next)(action);
  return next;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedIsFeatureEnabled.mockReturnValue(true);
});

test('logs a session entry with the control label on SET_FIELD_VALUE', () => {
  const store = buildStore({
    user: { firstName: 'Ada', lastName: 'Lovelace' },
    explore: { controls: { metrics: { label: 'Metrics' } } },
  });
  run(store, { type: 'SET_FIELD_VALUE', controlName: 'metrics', value: [] });
  expect(store.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: APPEND_VERSION_SESSION_LOG,
      entry: expect.objectContaining({
        label: "Changed 'Metrics'",
        controlName: 'metrics',
        user: 'Ada Lovelace',
      }),
    }),
  );
});

test('falls back to a humanized control name when no label exists', () => {
  const store = buildStore({ explore: { controls: {} } });
  run(store, { type: 'SET_FIELD_VALUE', controlName: 'row_limit', value: 10 });
  expect(store.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      entry: expect.objectContaining({
        label: "Changed 'row limit'",
        user: null,
      }),
    }),
  );
});

test('clears the session log when the explore page hydrates', () => {
  const store = buildStore();
  run(store, { type: 'HYDRATE_EXPLORE', data: {} });
  expect(store.dispatch).toHaveBeenCalledWith({
    type: CLEAR_VERSION_SESSION_LOG,
  });
});

test('does nothing when the feature flag is disabled', () => {
  mockedIsFeatureEnabled.mockReturnValue(false);
  const store = buildStore();
  run(store, { type: 'SET_FIELD_VALUE', controlName: 'metrics', value: [] });
  expect(store.dispatch).not.toHaveBeenCalled();
});

test('passes every action through to the next middleware', () => {
  const store = buildStore();
  const action = { type: 'UNRELATED' };
  const next = run(store, action);
  expect(next).toHaveBeenCalledWith(action);
  expect(store.dispatch).not.toHaveBeenCalled();
});
