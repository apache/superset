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
import { DRAFT_TOKEN_HEADER } from './useCanvasDefinition';

export interface DraftHistory {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  /** Whether a step is in flight. */
  busy: boolean;
  /**
   * Whether a step has moved the draft past what is on screen, which catches
   * up once the refetch the step triggers lands. Neither step is offered
   * until then.
   */
  settling?: boolean;
}

/**
 * Stepping a draft back and forward through the requests that built it.
 *
 * The history belongs to the draft, not to this tab. A canvas is edited by
 * its agent as well as by hand -- both through the same draft -- so a stack
 * kept in the browser would be wrong the moment the agent moved something,
 * and gone on a reload. Each step is a request to the server, which rebuilds
 * the draft and answers with it.
 */
export function useDraftHistory(
  token: string | undefined,
  revision: number,
  /** What the draft reported when it was last fetched. */
  fetched: { canUndo?: boolean; canRedo?: boolean },
  reload: () => void,
): DraftHistory {
  const { addDangerToast } = useToasts();
  const [state, setState] = useState({
    canUndo: Boolean(fetched.canUndo),
    canRedo: Boolean(fetched.canRedo),
  });
  const [busy, setBusy] = useState(false);
  // The revision the last step produced, and the draft it was taken on: a
  // step that answers after the user moved to another draft says nothing
  // about that one, which counts its revisions from zero.
  const [stepped, setStepped] = useState<{ token: string; revision: number }>();
  const currentToken = useRef(token);
  currentToken.current = token;
  // The revision this state describes. A write moves the draft on, which
  // makes a step available and discards anything undone -- the server says
  // so too, but not until something asks it.
  const seen = useRef(revision);

  useEffect(() => {
    setState({
      canUndo: Boolean(fetched.canUndo),
      canRedo: Boolean(fetched.canRedo),
    });
    seen.current = revision;
    // Only when the draft itself changes: `fetched` is a fresh object every
    // render, and following it would undo the optimism below on each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, fetched.canUndo, fetched.canRedo]);

  useEffect(() => {
    if (revision === seen.current) return;
    seen.current = revision;
    setState({ canUndo: true, canRedo: false });
  }, [revision]);

  const settling =
    stepped !== undefined &&
    stepped.token === token &&
    revision < stepped.revision;

  const step = useCallback(
    async (direction: 'undo' | 'redo') => {
      // Until the last step is on screen, `revision` is the one it started
      // from, and a step naming that would be rejected as a conflict.
      if (!token || settling) return;
      setBusy(true);
      try {
        const { json } = await SupersetClient.post({
          endpoint: `/api/v1/canvas/draft/${direction}`,
          headers: { [DRAFT_TOKEN_HEADER]: token },
          jsonPayload: { revision },
        });
        // The user moved to another draft while the step was in flight: what
        // it answered describes the draft they left.
        if (currentToken.current !== token) return;
        const result = json?.result ?? {};
        // Before `busy` clears, so the draft is never taken as settled at
        // the revision the step started from.
        if (typeof result.revision === 'number') {
          setStepped({ token, revision: result.revision });
        }
        setState({
          canUndo: Boolean(result.canUndo),
          canRedo: Boolean(result.canRedo),
        });
        seen.current = result.revision ?? revision;
        // The step rebuilt the whole definition, which is more than the
        // layout write path carries, so the canvas is refetched rather than
        // patched in place.
        reload();
      } catch (response) {
        const { message, error } = await getClientErrorObject(response);
        addDangerToast(
          message || error || t('That change could not be undone.'),
        );
        reload();
      } finally {
        setBusy(false);
      }
    },
    [token, revision, settling, reload, addDangerToast],
  );

  return {
    canUndo: state.canUndo && !settling,
    canRedo: state.canRedo && !settling,
    undo: useCallback(() => step('undo'), [step]),
    redo: useCallback(() => step('redo'), [step]),
    busy,
    settling,
  };
}
