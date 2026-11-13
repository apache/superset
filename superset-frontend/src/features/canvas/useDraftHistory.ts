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

  const step = useCallback(
    async (direction: 'undo' | 'redo') => {
      if (!token) return;
      setBusy(true);
      try {
        const { json } = await SupersetClient.post({
          endpoint: `/api/v1/canvas/draft/${direction}`,
          headers: { [DRAFT_TOKEN_HEADER]: token },
          jsonPayload: { revision },
        });
        const result = json?.result ?? {};
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
    [token, revision, reload, addDangerToast],
  );

  return {
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    undo: useCallback(() => step('undo'), [step]),
    redo: useCallback(() => step('redo'), [step]),
    busy,
  };
}
