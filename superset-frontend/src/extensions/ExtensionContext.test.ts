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
import {
  createExtensionContext,
  createBoundGetContext,
} from './ExtensionContext';

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({ user: { userId: 1 } })),
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

test('createBoundGetContext returns function that always returns same context', () => {
  const extension = createMockExtension('test.ext');
  const ctx = createExtensionContext(extension);
  const getContext = createBoundGetContext(ctx);

  expect(getContext()).toBe(ctx);
  expect(getContext()).toBe(ctx);
});

test('createBoundGetContext works in async code', async () => {
  const extension = createMockExtension('test.ext');
  const ctx = createExtensionContext(extension);
  const getContext = createBoundGetContext(ctx);

  const result = await Promise.resolve().then(() => getContext());

  expect(result).toBe(ctx);
});

test('different extensions get different bound contexts', () => {
  const ext1 = createMockExtension('org1.ext1');
  const ext2 = createMockExtension('org2.ext2');

  const ctx1 = createExtensionContext(ext1);
  const ctx2 = createExtensionContext(ext2);

  const getContext1 = createBoundGetContext(ctx1);
  const getContext2 = createBoundGetContext(ctx2);

  expect(getContext1().extension.id).toBe('org1.ext1');
  expect(getContext2().extension.id).toBe('org2.ext2');
});
