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

export type MapResourceEvent = {
  dataType?: string;
  error?: unknown;
  source?: unknown;
  sourceDataType?: string;
  sourceId?: string;
  tile?: unknown;
};

export type MapResourceGeneration = {
  render: object;
  source: object;
};

export type MapResourceState = {
  failedSourceIds: ReadonlySet<string>;
  fatal: boolean;
  pendingTileSourceIds: ReadonlyMap<unknown, string>;
  renderGeneration: object;
  sourceGeneration: object;
  successfulSourceIds: ReadonlySet<string>;
};

const unrecoveredSourceIds = (state: MapResourceState): Set<string> => {
  const sourceIds = new Set([
    ...state.failedSourceIds,
    ...state.pendingTileSourceIds.values(),
  ]);
  state.successfulSourceIds.forEach(sourceId => sourceIds.delete(sourceId));
  return sourceIds;
};

const stateForGeneration = (
  state: MapResourceState | null,
  generation: MapResourceGeneration,
): MapResourceState => {
  if (!state || state.sourceGeneration !== generation.source) {
    return {
      failedSourceIds: new Set(),
      fatal: false,
      pendingTileSourceIds: new Map(),
      renderGeneration: generation.render,
      sourceGeneration: generation.source,
      successfulSourceIds: new Set(),
    };
  }
  if (state.renderGeneration === generation.render) {
    return state;
  }

  return {
    failedSourceIds: new Set(state.failedSourceIds),
    fatal: state.fatal,
    pendingTileSourceIds: new Map(state.pendingTileSourceIds),
    renderGeneration: generation.render,
    sourceGeneration: generation.source,
    successfulSourceIds: new Set(),
  };
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;

const getSourceId = (event: MapResourceEvent) => {
  const sourceId = event.sourceId || asRecord(event.source)?.id;
  return typeof sourceId === 'string' ? sourceId : undefined;
};

const withoutPendingTile = (
  state: MapResourceState,
  event: MapResourceEvent,
): ReadonlyMap<unknown, string> => {
  if (event.tile === undefined || !state.pendingTileSourceIds.has(event.tile)) {
    return state.pendingTileSourceIds;
  }
  const pendingTileSourceIds = new Map(state.pendingTileSourceIds);
  pendingTileSourceIds.delete(event.tile);
  return pendingTileSourceIds;
};

/** Record a tile request that must have a terminal event before map idle. */
export const recordMapResourceLoading = (
  state: MapResourceState | null,
  generation: MapResourceGeneration,
  event: MapResourceEvent,
): MapResourceState => {
  const current = stateForGeneration(state, generation);
  const sourceId = getSourceId(event);
  if (event.dataType !== 'source' || event.tile === undefined || !sourceId) {
    return current;
  }
  if (current.pendingTileSourceIds.get(event.tile) === sourceId) {
    return current;
  }
  return {
    ...current,
    pendingTileSourceIds: new Map(current.pendingTileSourceIds).set(
      event.tile,
      sourceId,
    ),
  };
};

/** Remove a request that the map renderer explicitly aborted. */
export const recordMapResourceAbort = (
  state: MapResourceState | null,
  generation: MapResourceGeneration,
  event: MapResourceEvent,
): MapResourceState => {
  const current = stateForGeneration(state, generation);
  const pendingTileSourceIds = withoutPendingTile(current, event);
  return pendingTileSourceIds === current.pendingTileSourceIds
    ? current
    : { ...current, pendingTileSourceIds };
};

/** Record map tile/source failures without permanently latching transient errors. */
export const recordMapResourceError = (
  state: MapResourceState | null,
  generation: MapResourceGeneration,
  event: MapResourceEvent,
): MapResourceState => {
  const current = stateForGeneration(state, generation);
  const sourceId = getSourceId(event);
  const pendingTileSourceIds = withoutPendingTile(current, event);
  const error = asRecord(event.error);
  const status = error?.status ?? error?.statusCode;
  const fatal =
    current.fatal ||
    status === 401 ||
    status === 403 ||
    (sourceId !== undefined && event.tile === undefined) ||
    (sourceId === undefined && event.tile !== undefined);

  if (!sourceId) {
    return fatal === current.fatal &&
      pendingTileSourceIds === current.pendingTileSourceIds
      ? current
      : { ...current, fatal, pendingTileSourceIds };
  }

  return {
    ...current,
    failedSourceIds: new Set(current.failedSourceIds).add(sourceId),
    fatal,
    pendingTileSourceIds,
  };
};

/** Record successful tile content for the source that emitted it. */
export const recordMapResourceSuccess = (
  state: MapResourceState | null,
  generation: MapResourceGeneration,
  event: MapResourceEvent,
): MapResourceState => {
  const current = stateForGeneration(state, generation);
  const sourceId = getSourceId(event);
  if (
    event.dataType !== 'source' ||
    event.sourceDataType === 'error' ||
    event.tile === undefined ||
    !sourceId
  ) {
    return current;
  }
  return {
    ...current,
    pendingTileSourceIds: withoutPendingTile(current, event),
    successfulSourceIds: new Set(current.successfulSourceIds).add(sourceId),
  };
};

/** Record a Mapbox/MapLibre data event, including Mapbox tile error events. */
export const recordMapResourceData = (
  state: MapResourceState | null,
  generation: MapResourceGeneration,
  event: MapResourceEvent,
): MapResourceState =>
  event.sourceDataType === 'error'
    ? recordMapResourceError(state, generation, event)
    : recordMapResourceSuccess(state, generation, event);

export const hasFatalMapResourceError = (
  state: MapResourceState | null,
  generation: MapResourceGeneration,
) => state !== null && stateForGeneration(state, generation).fatal;

export const hasUnrecoveredMapResourceError = (
  state: MapResourceState | null,
  generation: MapResourceGeneration,
) =>
  state !== null &&
  unrecoveredSourceIds(stateForGeneration(state, generation)).size > 0;

export const advanceMapResourceGeneration = (
  state: MapResourceState | null,
  generation: MapResourceGeneration,
) => (state === null ? null : stateForGeneration(state, generation));

/** Convert requests still pending at idle into failures and release tile identities. */
export const recordMapResourceIdle = (
  state: MapResourceState | null,
  generation: MapResourceGeneration,
): MapResourceState => {
  const current = stateForGeneration(state, generation);
  if (current.pendingTileSourceIds.size === 0) {
    return current;
  }
  return {
    ...current,
    failedSourceIds: new Set([
      ...current.failedSourceIds,
      ...current.pendingTileSourceIds.values(),
    ]),
    pendingTileSourceIds: new Map(),
  };
};

/** Keep one render identity across a synchronous move event and React update. */
export class MapRenderGenerationTracker {
  private input: object | null = null;

  private scope: object | null = null;

  private generation: object = {};

  private expectedInput: object | null = null;

  current(input: object, scope: object = input): object {
    if (scope !== this.scope) {
      this.scope = scope;
      this.input = input;
      this.expectedInput = null;
      this.generation = {};
    } else if (input !== this.input) {
      this.input = input;
      if (input === this.expectedInput) {
        this.expectedInput = null;
      } else {
        this.generation = {};
      }
    }
    return this.generation;
  }

  retainForInput(input: object) {
    this.expectedInput = input;
  }

  advance(input: object): object {
    this.generation = {};
    this.expectedInput = input;
    return this.generation;
  }
}

/** Match native tile starts to terminal events within one map render. */
export class MapTileLifecycleTracker {
  private generation: object | null = null;

  private pendingTiles = new Set<unknown>();

  private rebasedTiles = new Set<unknown>();

  reset(generation: object | null = null) {
    this.generation = generation;
    this.pendingTiles.clear();
    this.rebasedTiles.clear();
  }

  rebase(generation: object) {
    this.generation = generation;
    this.rebasedTiles = new Set(this.pendingTiles);
  }

  startTile(generation: object, tile: unknown): boolean {
    if (tile === undefined) {
      return false;
    }
    if (this.generation !== generation) {
      this.reset(generation);
    }
    this.pendingTiles.add(tile);
    this.rebasedTiles.delete(tile);
    return true;
  }

  completeTile(
    generation: object,
    tile: unknown,
  ): 'current' | 'rebased' | 'untracked' | null {
    if (tile === undefined) {
      return 'untracked';
    }
    if (this.generation !== generation || !this.pendingTiles.delete(tile)) {
      return null;
    }
    return this.rebasedTiles.delete(tile) ? 'rebased' : 'current';
  }

  finishTile(generation: object, tile: unknown): boolean {
    return this.completeTile(generation, tile) !== null;
  }

  start(generation: object, event: MapResourceEvent): boolean {
    if (
      event.dataType !== 'source' ||
      event.tile === undefined ||
      !getSourceId(event)
    ) {
      return false;
    }
    return this.startTile(generation, event.tile);
  }

  finish(generation: object, event: MapResourceEvent): boolean {
    return this.finishTile(generation, event.tile);
  }

  complete(
    generation: object,
    event: MapResourceEvent,
  ): 'current' | 'rebased' | 'untracked' | null {
    return this.completeTile(generation, event.tile);
  }
}
