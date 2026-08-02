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
import { Dispatch, useCallback, useEffect, useRef } from 'react';
import { translation } from '@apache-superset/core';
import { ChatApiError } from '../api/client';
import { ConversationAction, itemId } from '../state/conversation';
import type { ChatTurnResult } from '../types';

const { t } = translation;

type Perform = (signal: AbortSignal) => Promise<ChatTurnResult>;

export interface RequestRunner {
  /** Runs a turn, remembering it so `retry` can repeat it verbatim */
  run: (perform: Perform) => void;
  /** Re-runs the last request after clearing the error state */
  retry: () => void;
  /** Aborts the in-flight request; the server-side turn still completes */
  cancel: () => void;
}

/**
 * Owns the lifecycle of one in-flight gateway turn. Cancellation is
 * client-side only: the request is abandoned and its events discarded while
 * the gateway finishes the turn it started. Aborting on unmount avoids
 * dispatching into an unmounted reducer.
 */
export function useRequestRunner(
  dispatch: Dispatch<ConversationAction>,
): RequestRunner {
  const abortRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<Perform | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const run = useCallback(
    (perform: Perform) => {
      lastRequestRef.current = perform;
      const controller = new AbortController();
      abortRef.current = controller;
      perform(controller.signal)
        .then(result => {
          dispatch({ type: 'events', events: result.events });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            dispatch({
              type: 'cancelled',
              noteId: itemId('note'),
              note: t('Request cancelled.'),
            });
          } else {
            dispatch({
              type: 'request_error',
              message:
                error instanceof ChatApiError
                  ? error.message
                  : t('The request failed. Check your connection and retry.'),
            });
          }
        });
    },
    [dispatch],
  );

  const retry = useCallback(() => {
    dispatch({ type: 'clear_error' });
    const perform = lastRequestRef.current;
    if (perform) run(perform);
  }, [dispatch, run]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { run, retry, cancel };
}
