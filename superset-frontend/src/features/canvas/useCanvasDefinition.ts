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
import { useCallback, useEffect, useRef, useState } from 'react';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import type { ClientErrorObject } from '@superset-ui/core';
import {
  subscribeRealtime,
  subscribeRealtimeOpen,
} from 'src/middleware/realtime';
import getBootstrapData from 'src/utils/getBootstrapData';
import { CanvasDefinitionResult } from './types';

export const REFETCH_DEBOUNCE_MS = 300;
export const POLL_INTERVAL_MS = 5000;

export type CanvasDefinitionState =
  | { status: 'loading' }
  | { status: 'error'; error: ClientErrorObject }
  | { status: 'complete'; result: CanvasDefinitionResult };

const definitionEndpoint = (canvasId: number) =>
  `/api/v1/canvas/${canvasId}/definition`;

/**
 * Loads a canvas definition and keeps it current.
 *
 * Every write publishes an `entity.changed` nudge carrying only the canvas id;
 * on a nudge (or after a websocket reconnect, since nudges are not replayed)
 * the definition is fetched again. Without websockets, a cheap
 * `/definition/changes?since=<revision>` poll detects new revisions.
 */
export function useCanvasDefinition(canvasId: number) {
  const [state, setState] = useState<CanvasDefinitionState>({
    status: 'loading',
  });
  const revision = useRef<number>();

  const load = useCallback(async () => {
    try {
      const { json } = await SupersetClient.get({
        endpoint: definitionEndpoint(canvasId),
      });
      revision.current = json.result.revision;
      setState({ status: 'complete', result: json.result });
    } catch (response) {
      const error = await getClientErrorObject(response);
      // Keep showing the last good definition if a refresh fails.
      setState(previous =>
        previous.status === 'complete' ? previous : { status: 'error', error },
      );
    }
  }, [canvasId]);

  useEffect(() => {
    revision.current = undefined;
    setState({ status: 'loading' });
    load();
  }, [load]);

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const scheduleLoad = () => {
      if (debounce !== undefined) return;
      debounce = setTimeout(() => {
        debounce = undefined;
        load();
      }, REFETCH_DEBOUNCE_MS);
    };

    const unsubscribe = subscribeRealtime('entity.changed', payload => {
      if (!payload || typeof payload !== 'object') return;
      const { entity_type: entityType, id } = payload as {
        entity_type?: unknown;
        id?: unknown;
      };
      if (entityType === 'canvas' && String(id) === String(canvasId)) {
        scheduleLoad();
      }
    });
    const unsubscribeOpen = subscribeRealtimeOpen(reason => {
      if (reason === 'reconnect') scheduleLoad();
    });

    let poll: ReturnType<typeof setInterval> | undefined;
    if (!getBootstrapData()?.common?.conf?.WEBSOCKET_ENABLE) {
      poll = setInterval(async () => {
        if (revision.current === undefined) return;
        try {
          const { json } = await SupersetClient.get({
            endpoint: `${definitionEndpoint(canvasId)}/changes?since=${revision.current}`,
          });
          if (json.result.changes.length > 0) scheduleLoad();
        } catch {
          // A stale revision (409) or a transient error: reload the whole
          // definition.
          scheduleLoad();
        }
      }, POLL_INTERVAL_MS);
    }

    return () => {
      unsubscribe();
      unsubscribeOpen();
      if (debounce !== undefined) clearTimeout(debounce);
      if (poll !== undefined) clearInterval(poll);
    };
  }, [canvasId, load]);

  return { state, reload: load };
}
