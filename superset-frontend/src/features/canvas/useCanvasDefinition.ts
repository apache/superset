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
import {
  Logger,
  LOG_ACTIONS_CANVAS_ERROR,
  LOG_ACTIONS_CANVAS_LOAD_DEFINITION,
} from 'src/logger/LogUtils';
import { CanvasDefinitionResult } from './types';
import { useCanvasLogger } from './useCanvasLogger';

/** Draft tokens travel in this header, never in a URL. */
export const DRAFT_TOKEN_HEADER = 'X-Canvas-Draft';
/** Reads placement data as a version saved it. */
export const VERSION_HEADER = 'X-Canvas-Version';

export const REFETCH_DEBOUNCE_MS = 300;

export type CanvasDefinitionState =
  | { status: 'loading' }
  | { status: 'error'; error: ClientErrorObject }
  | {
      status: 'complete';
      result: CanvasDefinitionResult;
      /** The draft `result` was read from, if any. */
      draftToken?: string;
    };

const definitionEndpoint = (canvasId: number) =>
  `/api/v1/canvas/${canvasId}/definition`;

const draftPollSeconds = (): number =>
  Number(getBootstrapData().common?.conf?.CANVAS_DRAFT_POLL_INTERVAL ?? 0);

/**
 * Loads a canvas definition, or the caller's draft of it, and keeps it current.
 *
 * A published canvas refetches on its `entity.changed` nudge, or after a
 * reconnect since nudges are not replayed. A draft is private and gets no
 * nudges: it refetches when the tab regains focus and, while visible, every
 * `CANVAS_DRAFT_POLL_INTERVAL` seconds, so changes an agent makes in the same
 * draft show up.
 */
export function useCanvasDefinition(canvasId: number, draftToken?: string) {
  const [state, setState] = useState<CanvasDefinitionState>({
    status: 'loading',
  });
  const revision = useRef<number>();
  const loadedCanvas = useRef<number>();
  // The source a complete result was last loaded for, so a failed refresh can
  // tell itself apart from a failed first open without reading state, and so
  // a repeated poll of the same source is not reported twice.
  const loaded = useRef<string>();
  // The source whose failure has already been reported, cleared on recovery.
  const reported = useRef<string>();
  // Drops a response for a source the page has since moved off.
  const source = useRef<string>();
  source.current = `${canvasId}:${draftToken ?? ''}`;

  const log = useCanvasLogger(canvasId, { isDraft: Boolean(draftToken) });

  const load = useCallback(async () => {
    const requested = `${canvasId}:${draftToken ?? ''}`;
    const startedAt = Logger.getTimestamp();
    try {
      const { json } = await SupersetClient.get(
        draftToken
          ? {
              endpoint: '/api/v1/canvas/draft',
              headers: { [DRAFT_TOKEN_HEADER]: draftToken },
            }
          : { endpoint: definitionEndpoint(canvasId) },
      );
      if (source.current !== requested) return;
      revision.current = json.result.revision;
      // Only the first load of a source is reported. This runs again on every
      // draft poll (CANVAS_DRAFT_POLL_INTERVAL, 5s) and on every window focus,
      // so logging each one would write a row every few seconds per open tab
      // and say nothing new.
      const first = loaded.current !== requested;
      loaded.current = requested;
      reported.current = undefined;
      setState({ status: 'complete', result: json.result, draftToken });
      if (first) {
        log(LOG_ACTIONS_CANVAS_LOAD_DEFINITION, {
          revision: json.result.revision,
          definition_version: json.result.definition?.version,
          widget_count: Object.keys(json.result.definition?.nodes ?? {}).length,
          duration: Logger.getTimestamp() - startedAt,
        });
      }
    } catch (response) {
      const error = await getClientErrorObject(response);
      if (source.current !== requested) return;
      // Keep showing the last good definition if a refresh of the same
      // source fails; a draft that fails to open is an error. Read from a ref
      // rather than from `state`, which would put `state` in this callback's
      // dependencies and make every load schedule the next one.
      const silent = loaded.current === requested;
      setState(previous =>
        previous.status === 'complete' && previous.draftToken === draftToken
          ? previous
          : { status: 'error', error },
      );
      // Once per source, for the same reason as the success event: an
      // expired draft keeps polling, and reporting each failure would write a
      // row every few seconds for a single broken state.
      if (reported.current === requested) return;
      reported.current = requested;
      // `is_silent` marks the refresh case above, which shows the user
      // nothing at all. This event is the only signal it ever produces.
      log(LOG_ACTIONS_CANVAS_ERROR, {
        scope: 'definition_load',
        status: error.status,
        // The typed error, where the server classified one. Never
        // `error.message`: it is server-authored prose that can quote SQL,
        // column names or row values.
        error_type: error.errors?.[0]?.error_type,
        has_err: true,
        is_silent: silent,
      });
    }
  }, [canvasId, draftToken, log]);

  useEffect(() => {
    revision.current = undefined;
    // Entering or leaving a draft keeps the current definition on screen
    // until the other one arrives, so the page doesn't unmount and refetch.
    if (loadedCanvas.current !== canvasId) {
      loadedCanvas.current = canvasId;
      setState({ status: 'loading' });
    }
    load();
  }, [canvasId, load]);

  useEffect(() => {
    if (!draftToken) return undefined;
    const reloadIfVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    const seconds = draftPollSeconds();
    const timer =
      seconds > 0 ? setInterval(reloadIfVisible, seconds * 1000) : undefined;
    window.addEventListener('focus', reloadIfVisible);
    return () => {
      if (timer !== undefined) clearInterval(timer);
      window.removeEventListener('focus', reloadIfVisible);
    };
  }, [draftToken, load]);

  useEffect(() => {
    if (draftToken) return undefined;
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

    return () => {
      unsubscribe();
      unsubscribeOpen();
      if (debounce !== undefined) clearTimeout(debounce);
    };
  }, [canvasId, draftToken, load]);

  return { state, reload: load };
}
