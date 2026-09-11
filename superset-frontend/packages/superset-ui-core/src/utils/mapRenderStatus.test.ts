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

import {
  hasFatalMapResourceError,
  hasUnrecoveredMapResourceError,
  recordMapResourceError,
  recordMapResourceSuccess,
} from './mapRenderStatus';

test('tracks recoverable failures and successes for the same source', () => {
  const generation = {};
  const failed = recordMapResourceError(null, generation, {
    error: { status: 429 },
    sourceId: 'tiles',
    tile: {},
  });

  expect(hasFatalMapResourceError(failed, generation)).toBe(false);
  expect(hasUnrecoveredMapResourceError(failed, generation)).toBe(true);

  const recovered = recordMapResourceSuccess(failed, generation, {
    dataType: 'source',
    sourceId: 'tiles',
    tile: {},
  });

  expect(hasUnrecoveredMapResourceError(recovered, generation)).toBe(false);
});

test('does not let success from another source mask a failed source', () => {
  const generation = {};
  const failed = recordMapResourceError(null, generation, {
    sourceId: 'failed',
    tile: {},
  });
  const mixed = recordMapResourceSuccess(failed, generation, {
    dataType: 'source',
    source: { id: 'successful' },
    tile: {},
  });

  expect([...mixed.successfulSourceIds]).toEqual(['successful']);
  expect(hasUnrecoveredMapResourceError(mixed, generation)).toBe(true);
});

test.each([
  { error: { status: 401 }, sourceId: 'tiles', tile: {} },
  { error: { statusCode: 403 }, sourceId: 'tiles', tile: {} },
  { sourceId: 'source-level' },
  { tile: {} },
])('treats non-recoverable resource errors as fatal: %p', event => {
  const generation = {};
  const state = recordMapResourceError(null, generation, event);

  expect(hasFatalMapResourceError(state, generation)).toBe(true);
});

test('leaves an unscoped generic error recoverable after a fresh idle', () => {
  const generation = {};
  const initial = recordMapResourceSuccess(null, generation, {});

  expect(recordMapResourceError(initial, generation, {})).toBe(initial);
});

test.each([
  {},
  { dataType: 'style', sourceId: 'tiles', tile: {} },
  { dataType: 'source', sourceId: 'tiles' },
  { dataType: 'source', tile: {} },
])('ignores events that do not prove successful tile content: %p', event => {
  const generation = {};
  const initial = recordMapResourceSuccess(null, generation, event);

  expect(initial.successfulSourceIds.size).toBe(0);
});

test('isolates state between map generations', () => {
  const oldGeneration = {};
  const newGeneration = {};
  const oldState = recordMapResourceError(null, oldGeneration, {
    sourceId: 'tiles',
    tile: {},
  });

  expect(hasUnrecoveredMapResourceError(oldState, newGeneration)).toBe(false);
  expect(hasFatalMapResourceError(oldState, newGeneration)).toBe(false);

  const newState = recordMapResourceSuccess(oldState, newGeneration, {
    dataType: 'source',
    sourceId: 'tiles',
    tile: {},
  });

  expect(newState.generation).toBe(newGeneration);
  expect(newState.failedSourceIds.size).toBe(0);
  expect([...newState.successfulSourceIds]).toEqual(['tiles']);
});
