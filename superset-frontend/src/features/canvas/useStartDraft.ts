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
import { t } from '@apache-superset/core/translation';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  LOG_ACTIONS_CANVAS_DRAFT_START,
  LOG_ACTIONS_CANVAS_ERROR,
} from 'src/logger/LogUtils';
import { useCanvasLogger } from './useCanvasLogger';

/**
 * Starting a draft on a canvas.
 *
 * The draft is only ever opened on the canvas that asked for it: if the user
 * has moved on, or left the page, the token belongs to a canvas that is no
 * longer shown, and opening it there would show another canvas's draft and
 * publish to it.
 */
export function useStartDraft(
  canvasId: number,
  onStarted: (token: string) => void,
) {
  const { addDangerToast } = useToasts();
  const [starting, setStarting] = useState(false);
  const current = useRef<number | undefined>(canvasId);

  const log = useCanvasLogger(canvasId);

  useEffect(() => {
    current.current = canvasId;
    return () => {
      current.current = undefined;
    };
  }, [canvasId]);

  const start = useCallback(async () => {
    const startedFor = canvasId;
    setStarting(true);
    try {
      const { json } = await SupersetClient.post({
        endpoint: `/api/v1/canvas/${canvasId}/draft`,
      });
      if (current.current !== startedFor) return;
      const token = json?.result?.token;
      if (typeof token === 'string') {
        // Opens the draft funnel that `canvas_draft_end` closes. The token
        // itself is never recorded.
        log(LOG_ACTIONS_CANVAS_DRAFT_START);
        onStarted(token);
      } else {
        log(LOG_ACTIONS_CANVAS_ERROR, { scope: 'draft_start', has_err: true });
        addDangerToast(t('That draft could not be started.'));
      }
    } catch (response) {
      if (current.current !== startedFor) return;
      const { message, error, status } = await getClientErrorObject(response);
      log(LOG_ACTIONS_CANVAS_ERROR, {
        scope: 'draft_start',
        status,
        has_err: true,
      });
      addDangerToast(message || error || t('That draft could not be started.'));
    } finally {
      setStarting(false);
    }
  }, [canvasId, log, onStarted, addDangerToast]);

  return { start, starting };
}
