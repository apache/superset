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

import { window } from '.';

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({ user: { userId: 1 } })),
}));

// `src/views/store` pulls in the full dashboard/explore/chart reducer tree,
// which assumes bootstrap data is already hydrated (true by the time real
// extension code runs in a browser, not true in this unit test).
const mockDispatch = jest.fn();
jest.mock('src/views/store', () => ({
  store: { dispatch: (...args: unknown[]) => mockDispatch(...args) },
}));

test('window namespace dispatches an info toast', () => {
  mockDispatch.mockClear();

  window.showInformationMessage('hello');

  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockDispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'ADD_TOAST',
      payload: expect.objectContaining({
        text: 'hello',
        toastType: 'INFO_TOAST',
      }),
    }),
  );
});

test('window namespace dispatches a warning toast', () => {
  mockDispatch.mockClear();

  window.showWarningMessage('careful');

  expect(mockDispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        text: 'careful',
        toastType: 'WARNING_TOAST',
      }),
    }),
  );
});

test('window namespace dispatches an error toast', () => {
  mockDispatch.mockClear();

  window.showErrorMessage('broken');

  expect(mockDispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        text: 'broken',
        toastType: 'DANGER_TOAST',
      }),
    }),
  );
});

test('window namespace forwards a custom duration to the toast payload', () => {
  mockDispatch.mockClear();

  window.showInformationMessage('hello', { duration: 12000 });

  expect(mockDispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        text: 'hello',
        duration: 12000,
      }),
    }),
  );
});

test('window namespace ignores undefined duration and unknown options', () => {
  mockDispatch.mockClear();

  window.showInformationMessage('hello', {
    duration: undefined,
    allowHtml: true,
  } as never);

  const { payload } = mockDispatch.mock.calls[0][0];
  expect(payload.allowHtml).not.toBe(true);
  expect(payload.duration).toBe(4000);
});
