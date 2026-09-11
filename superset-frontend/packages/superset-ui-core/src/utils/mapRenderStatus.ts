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

export type MapResourceState = {
  failedSourceIds: ReadonlySet<string>;
  fatal: boolean;
  generation: object;
  successfulSourceIds: ReadonlySet<string>;
};

const stateForGeneration = (
  state: MapResourceState | null,
  generation: object,
): MapResourceState =>
  state?.generation === generation
    ? state
    : {
        failedSourceIds: new Set(),
        fatal: false,
        generation,
        successfulSourceIds: new Set(),
      };

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;

const getSourceId = (event: MapResourceEvent) => {
  const sourceId = event.sourceId || asRecord(event.source)?.id;
  return typeof sourceId === 'string' ? sourceId : undefined;
};

/** Record map tile/source failures without permanently latching transient errors. */
export const recordMapResourceError = (
  state: MapResourceState | null,
  generation: object,
  event: MapResourceEvent,
): MapResourceState => {
  const current = stateForGeneration(state, generation);
  const sourceId = getSourceId(event);
  const error = asRecord(event.error);
  const status = error?.status ?? error?.statusCode;
  const fatal =
    current.fatal ||
    status === 401 ||
    status === 403 ||
    (sourceId !== undefined && event.tile === undefined) ||
    (sourceId === undefined && event.tile !== undefined);

  if (!sourceId) {
    return fatal === current.fatal ? current : { ...current, fatal };
  }

  return {
    ...current,
    failedSourceIds: new Set(current.failedSourceIds).add(sourceId),
    fatal,
  };
};

/** Record successful tile content for the source that emitted it. */
export const recordMapResourceSuccess = (
  state: MapResourceState | null,
  generation: object,
  event: MapResourceEvent,
): MapResourceState => {
  const current = stateForGeneration(state, generation);
  const sourceId = getSourceId(event);
  if (event.dataType !== 'source' || event.tile === undefined || !sourceId) {
    return current;
  }
  return {
    ...current,
    successfulSourceIds: new Set(current.successfulSourceIds).add(sourceId),
  };
};

export const hasFatalMapResourceError = (
  state: MapResourceState | null,
  generation: object,
) => state?.generation === generation && state.fatal;

export const hasUnrecoveredMapResourceError = (
  state: MapResourceState | null,
  generation: object,
) =>
  state?.generation === generation &&
  [...state.failedSourceIds].some(
    sourceId => !state.successfulSourceIds.has(sourceId),
  );
