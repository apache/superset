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
  advanceMapResourceGeneration,
  hasFatalMapResourceError,
  hasUnrecoveredMapResourceError,
  MapRenderGenerationTracker,
  MapTileLifecycleTracker,
  recordMapResourceAbort,
  recordMapResourceData,
  recordMapResourceError,
  recordMapResourceIdle,
  recordMapResourceLoading,
  recordMapResourceSuccess,
} from './mapRenderStatus';

const createGeneration = (source: object = {}) => ({ render: {}, source });

test('tracks recoverable failures and successes for the same source', () => {
  const generation = createGeneration();
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

test('routes Mapbox source data errors to failure instead of tile success', () => {
  const generation = createGeneration();
  const state = recordMapResourceData(null, generation, {
    dataType: 'source',
    sourceDataType: 'error',
    sourceId: 'tiles',
    tile: {},
  });

  expect([...state.failedSourceIds]).toEqual(['tiles']);
  expect(state.successfulSourceIds.size).toBe(0);
  expect(hasUnrecoveredMapResourceError(state, generation)).toBe(true);
});

test('treats an unresolved tile request as a failed source at idle', () => {
  const generation = createGeneration();
  const tile = {};
  const loading = recordMapResourceLoading(null, generation, {
    dataType: 'source',
    sourceId: 'tiles',
    tile,
  });

  expect([...loading.pendingTileSourceIds]).toEqual([[tile, 'tiles']]);
  expect(
    recordMapResourceLoading(loading, generation, {
      dataType: 'source',
      sourceId: 'tiles',
      tile,
    }),
  ).toBe(loading);
  expect(hasUnrecoveredMapResourceError(loading, generation)).toBe(true);

  const settled = recordMapResourceIdle(loading, generation);
  expect([...settled.failedSourceIds]).toEqual(['tiles']);
  expect(settled.pendingTileSourceIds.size).toBe(0);
  expect(recordMapResourceIdle(settled, generation)).toBe(settled);
  expect(hasUnrecoveredMapResourceError(settled, generation)).toBe(true);

  const partial = recordMapResourceSuccess(loading, generation, {
    dataType: 'source',
    sourceId: 'tiles',
    tile: {},
  });
  expect(hasUnrecoveredMapResourceError(partial, generation)).toBe(false);
});

test('removes terminal and aborted tile requests by identity', () => {
  const generation = createGeneration();
  const successfulTile = {};
  const abortedTile = {};
  let state = recordMapResourceLoading(null, generation, {
    dataType: 'source',
    sourceId: 'tiles',
    tile: successfulTile,
  });
  state = recordMapResourceLoading(state, generation, {
    dataType: 'source',
    sourceId: 'aborted',
    tile: abortedTile,
  });
  state = recordMapResourceSuccess(state, generation, {
    dataType: 'source',
    sourceId: 'tiles',
    tile: successfulTile,
  });
  state = recordMapResourceAbort(state, generation, { tile: abortedTile });

  expect(state.pendingTileSourceIds.size).toBe(0);
  expect(hasUnrecoveredMapResourceError(state, generation)).toBe(false);
});

test('retains painted tile success when the same render loads another tile', () => {
  const generation = createGeneration();
  const successful = recordMapResourceSuccess(null, generation, {
    dataType: 'source',
    sourceId: 'tiles',
    tile: {},
  });
  const tile = {};
  const reloading = recordMapResourceLoading(successful, generation, {
    dataType: 'source',
    sourceId: 'tiles',
    tile,
  });

  expect([...reloading.successfulSourceIds]).toEqual(['tiles']);
  expect([...reloading.pendingTileSourceIds]).toEqual([[tile, 'tiles']]);
  expect(hasUnrecoveredMapResourceError(reloading, generation)).toBe(false);
});

test('does not revive a recovered failure when a later request aborts', () => {
  const generation = createGeneration();
  const failedTile = {};
  const successfulTile = {};
  let state = recordMapResourceError(null, generation, {
    sourceId: 'tiles',
    tile: failedTile,
  });
  state = recordMapResourceSuccess(state, generation, {
    dataType: 'source',
    sourceId: 'tiles',
    tile: successfulTile,
  });
  expect(hasUnrecoveredMapResourceError(state, generation)).toBe(false);

  const retryTile = {};
  state = recordMapResourceLoading(state, generation, {
    dataType: 'source',
    sourceId: 'tiles',
    tile: retryTile,
  });
  state = recordMapResourceAbort(state, generation, { tile: retryTile });

  expect(hasUnrecoveredMapResourceError(state, generation)).toBe(false);
});

test('preserves a fatal failure when loading restarts for the same source', () => {
  const generation = createGeneration();
  const fatal = recordMapResourceError(null, generation, {
    error: { status: 401 },
  });
  const tile = {};
  let state = recordMapResourceLoading(fatal, generation, {
    dataType: 'source',
    sourceId: 'tiles',
    tile,
  });
  state = recordMapResourceSuccess(state, generation, {
    dataType: 'source',
    sourceId: 'tiles',
    tile,
  });

  expect(hasFatalMapResourceError(state, generation)).toBe(true);
});

test.each([
  {},
  { dataType: 'style', sourceId: 'tiles', tile: {} },
  { dataType: 'source', tile: {} },
  { dataType: 'source', sourceId: 'tiles' },
])('ignores events that do not prove a tile request started: %p', event => {
  const generation = createGeneration();
  const initial = recordMapResourceLoading(null, generation, event);

  expect(initial.pendingTileSourceIds.size).toBe(0);
});

test('does not let success from another source mask a failed source', () => {
  const generation = createGeneration();
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
  const generation = createGeneration();
  const state = recordMapResourceError(null, generation, event);

  expect(hasFatalMapResourceError(state, generation)).toBe(true);
});

test('leaves an unscoped generic error recoverable after a fresh idle', () => {
  const generation = createGeneration();
  const initial = recordMapResourceSuccess(null, generation, {});

  expect(recordMapResourceError(initial, generation, {})).toBe(initial);
});

test.each([
  {},
  { dataType: 'style', sourceId: 'tiles', tile: {} },
  { dataType: 'source', sourceId: 'tiles' },
  { dataType: 'source', tile: {} },
])('ignores events that do not prove successful tile content: %p', event => {
  const generation = createGeneration();
  const initial = recordMapResourceSuccess(null, generation, event);

  expect(initial.successfulSourceIds.size).toBe(0);
});

test('carries failures across view renders but resets them for a new source', () => {
  const source = {};
  const oldGeneration = createGeneration(source);
  const movedGeneration = createGeneration(source);
  const newSourceGeneration = createGeneration();
  const oldState = recordMapResourceError(null, oldGeneration, {
    sourceId: 'tiles',
    tile: {},
  });

  expect(hasUnrecoveredMapResourceError(oldState, movedGeneration)).toBe(true);
  expect(hasFatalMapResourceError(oldState, movedGeneration)).toBe(false);
  expect(hasUnrecoveredMapResourceError(oldState, newSourceGeneration)).toBe(
    false,
  );

  const recoveredState = recordMapResourceSuccess(oldState, movedGeneration, {
    dataType: 'source',
    sourceId: 'tiles',
    tile: {},
  });

  expect(recoveredState.renderGeneration).toBe(movedGeneration.render);
  expect([...recoveredState.failedSourceIds]).toEqual(['tiles']);
  expect([...recoveredState.successfulSourceIds]).toEqual(['tiles']);
  expect(hasUnrecoveredMapResourceError(recoveredState, movedGeneration)).toBe(
    false,
  );

  const resetState = recordMapResourceSuccess(oldState, newSourceGeneration, {
    dataType: 'source',
    sourceId: 'tiles',
    tile: {},
  });
  expect(resetState.failedSourceIds.size).toBe(0);
  expect([...resetState.successfulSourceIds]).toEqual(['tiles']);
  expect(advanceMapResourceGeneration(null, newSourceGeneration)).toBeNull();
});

test('does not let prior-render success erase a carried failure', () => {
  const source = {};
  const movingGeneration = createGeneration(source);
  const finalGeneration = createGeneration(source);
  let state = recordMapResourceError(null, movingGeneration, {
    sourceId: 'tiles',
    tile: {},
  });
  state = recordMapResourceSuccess(state, movingGeneration, {
    dataType: 'source',
    sourceId: 'tiles',
    tile: {},
  });

  expect(hasUnrecoveredMapResourceError(state, movingGeneration)).toBe(false);
  expect(hasUnrecoveredMapResourceError(state, finalGeneration)).toBe(true);

  state = recordMapResourceSuccess(state, finalGeneration, {
    dataType: 'source',
    sourceId: 'tiles',
    tile: {},
  });
  expect(hasUnrecoveredMapResourceError(state, finalGeneration)).toBe(false);
});

test('carries fatal source failures until the map source changes', () => {
  const source = {};
  const generation = createGeneration(source);
  const fatal = recordMapResourceError(null, generation, {
    error: { status: 401 },
  });

  expect(hasFatalMapResourceError(fatal, createGeneration(source))).toBe(true);
  expect(hasFatalMapResourceError(fatal, createGeneration())).toBe(false);
});

test('matches native starts and terminals within the active generation', () => {
  const tracker = new MapTileLifecycleTracker();
  const oldGeneration = {};
  const newGeneration = {};
  const oldTile = {};
  const newTile = {};

  expect(tracker.start(oldGeneration, {})).toBe(false);
  expect(
    tracker.start(oldGeneration, {
      dataType: 'source',
      sourceId: 'tiles',
      tile: oldTile,
    }),
  ).toBe(true);
  expect(tracker.finish(newGeneration, { tile: oldTile })).toBe(false);
  expect(
    tracker.start(newGeneration, {
      dataType: 'source',
      sourceId: 'tiles',
      tile: newTile,
    }),
  ).toBe(true);
  expect(tracker.finish(newGeneration, { tile: oldTile })).toBe(false);
  expect(tracker.finish(newGeneration, { tile: newTile })).toBe(true);
  expect(tracker.finish(newGeneration, {})).toBe(true);

  tracker.reset();
  expect(tracker.finish(newGeneration, { tile: newTile })).toBe(false);
});

test('keeps a synchronously advanced generation for the ensuing render', () => {
  const tracker = new MapRenderGenerationTracker();
  const scope = {};
  const firstInput = {};
  const firstGeneration = tracker.current(firstInput, scope);
  expect(tracker.current(firstInput, scope)).toBe(firstGeneration);

  const advancedInput = {};
  const advancedGeneration = tracker.advance(advancedInput);
  expect(advancedGeneration).not.toBe(firstGeneration);
  expect(tracker.current(advancedInput, scope)).toBe(advancedGeneration);

  expect(tracker.current({}, scope)).not.toBe(advancedGeneration);
});

test('retains one generation across movement frames but not scope changes', () => {
  const tracker = new MapRenderGenerationTracker();
  const scope = {};
  const firstGeneration = tracker.current({}, scope);
  const secondFrame = {};
  tracker.retainForInput(secondFrame);
  expect(tracker.current(secondFrame, scope)).toBe(firstGeneration);

  const thirdFrame = {};
  tracker.retainForInput(thirdFrame);
  expect(tracker.current(thirdFrame, scope)).toBe(firstGeneration);
  expect(tracker.current(thirdFrame, {})).not.toBe(firstGeneration);
});

test('tracks raw tile identities for renderers without source IDs', () => {
  const tracker = new MapTileLifecycleTracker();
  const generation = {};
  const tile = {};

  expect(tracker.startTile(generation, tile)).toBe(true);
  expect(tracker.finishTile({}, tile)).toBe(false);
  expect(tracker.finishTile(generation, tile)).toBe(true);
  expect(tracker.startTile(generation, undefined)).toBe(false);
  expect(tracker.finishTile(generation, undefined)).toBe(true);
});

test('distinguishes pending tiles carried into a final map render', () => {
  const tracker = new MapTileLifecycleTracker();
  const movingGeneration = {};
  const finalGeneration = {};
  const carriedTile = {};
  const finalTile = {};

  tracker.startTile(movingGeneration, carriedTile);
  tracker.rebase(finalGeneration);
  tracker.startTile(finalGeneration, finalTile);

  expect(tracker.complete(finalGeneration, { tile: carriedTile })).toBe(
    'rebased',
  );
  expect(tracker.completeTile(finalGeneration, finalTile)).toBe('current');
  expect(tracker.completeTile(finalGeneration, finalTile)).toBeNull();
});
