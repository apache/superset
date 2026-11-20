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

/**
 * @fileoverview Raising canvas events, with the canvas's own context attached.
 *
 * Deliberately not `useLogAction`: that hook nests its fields under a
 * `payload` key, which would hide `canvas_id` from both the beacon's
 * query-parameter lift and the per-record fallback the DB event logger uses to
 * fill `logs.canvas_id`.
 *
 * What may be recorded: ids, types, counts, durations and booleans. What may
 * not: filter values, widget data, canvas or widget titles, a draft token, or
 * a full URL -- a draft's URL ends in `#draft=<token>`.
 */

import { useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { logEvent } from 'src/logger/actions';

/** Scalars only, so content cannot be dropped into a log row wholesale. */
export type CanvasEventData = Record<
  string,
  string | number | boolean | null | undefined
>;

export interface CanvasLogContext {
  /** Whether the change is happening in a draft rather than on the canvas. */
  isDraft?: boolean;
  /** Set while a published version is being previewed. */
  versionUuid?: string;
}

export type CanvasLogger = (name: string, data?: CanvasEventData) => void;

/**
 * Returns a function that raises a canvas event.
 *
 * `canvas_id` is included in the event body as well as being derived by the
 * logger middleware from the open canvas. The middleware fills the beacon's
 * query parameters from the batch's *first* event only, so a batch spanning a
 * navigation would otherwise label the rest with the wrong id.
 */
export function useCanvasLogger(
  canvasId: number | undefined,
  context: CanvasLogContext = {},
): CanvasLogger {
  const dispatch = useDispatch();
  const { isDraft, versionUuid } = context;

  const shared = useMemo(
    () => ({
      canvas_id: canvasId,
      is_draft: Boolean(isDraft),
      ...(versionUuid ? { version_uuid: versionUuid } : {}),
    }),
    [canvasId, isDraft, versionUuid],
  );

  return useCallback(
    (name: string, data: CanvasEventData = {}) => {
      if (canvasId === undefined) return;
      dispatch(logEvent(name, { ...shared, ...data }));
    },
    [canvasId, dispatch, shared],
  );
}

export default useCanvasLogger;
