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

import type { common } from '@apache-superset/core';
import { createExtensionContext } from './ExtensionContext';

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({ user: { userId: 1 } })),
}));

// `src/views/store` pulls in the full dashboard/explore/chart reducer tree,
// which assumes bootstrap data is already hydrated (true by the time real
// extension code runs in a browser, not true in this unit test). Mocked
// here rather than deep-mocking that whole chain.
const mockDispatch = jest.fn();
jest.mock('src/views/store', () => ({
  store: { dispatch: (...args: unknown[]) => mockDispatch(...args) },
}));

const createMockExtension = (id: string): common.Extension =>
  ({
    id,
    name: `test-${id}`,
    publisher: 'test',
  }) as unknown as common.Extension;

test('createExtensionContext creates context with extension metadata', () => {
  const extension = createMockExtension('test.ext');
  const ctx = createExtensionContext(extension);

  expect(ctx.extension).toBe(extension);
  expect(ctx.extension.id).toBe('test.ext');
});

test('createExtensionContext creates context with lazy storage', () => {
  const extension = createMockExtension('test.ext');
  const ctx = createExtensionContext(extension);

  expect(ctx.storage).toBeDefined();
  expect(ctx.storage.local).toBeDefined();
  expect(ctx.storage.session).toBeDefined();
  expect(ctx.storage.ephemeral).toBeDefined();
});

test('ctx.window dispatches an info toast', () => {
  const ctx = createExtensionContext(createMockExtension('test.ext'));
  mockDispatch.mockClear();

  ctx.window.showInformationMessage('hello');

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

test('ctx.window dispatches a warning toast', () => {
  const ctx = createExtensionContext(createMockExtension('test.ext'));
  mockDispatch.mockClear();

  ctx.window.showWarningMessage('careful');

  expect(mockDispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        text: 'careful',
        toastType: 'WARNING_TOAST',
      }),
    }),
  );
});

test('ctx.window dispatches an error toast', () => {
  const ctx = createExtensionContext(createMockExtension('test.ext'));
  mockDispatch.mockClear();

  ctx.window.showErrorMessage('broken');

  expect(mockDispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        text: 'broken',
        toastType: 'DANGER_TOAST',
      }),
    }),
  );
});

test('ctx.window is lazily created once per context', () => {
  const ctx = createExtensionContext(createMockExtension('test.ext'));

  expect(ctx.window).toBe(ctx.window);
});

test('different extensions get different contexts', () => {
  const ctx1 = createExtensionContext(createMockExtension('org1.ext1'));
  const ctx2 = createExtensionContext(createMockExtension('org2.ext2'));

  expect(ctx1.extension.id).toBe('org1.ext1');
  expect(ctx2.extension.id).toBe('org2.ext2');
  expect(ctx1).not.toBe(ctx2);
});
