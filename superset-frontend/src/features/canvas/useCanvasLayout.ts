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
import { t } from '@apache-superset/core/translation';
import type {
  ApplyOperationsResult,
  CanvasDefinitionResult,
  GridPlacement,
} from './types';

/** The newest layout this client knows of, and the revision it belongs to. */
interface AppliedLayout {
  revision: number;
  placements: Record<string, GridPlacement>;
}

export interface CanvasLayout {
  /** Placements to render: the newest local ones, else the server's. */
  placements: Record<string, GridPlacement>;
  /** Persist a node's new placement. A no-op when the user can't edit. */
  place: (nodeId: string, placement: GridPlacement) => void;
  /** Why the last write failed, for a dismissable notice. */
  error?: string;
  dismissError: () => void;
}

/**
 * Persists drag and resize as `place` operations.
 *
 * The moved widget appears where it was dropped straight away, then takes the
 * placements the server resolved — which may differ, since the server pushes
 * overlapping widgets down.
 *
 * Each write is based on the newest revision the server has *confirmed*, taken
 * from the previous write's response rather than from the definition. The
 * definition's revision only advances when a refetch lands, and that refetch
 * is driven by a realtime nudge; without one (no realtime service, a dropped
 * socket) it would stay put and every drag after the first would collide with
 * the user's own previous drag.
 *
 * A write while another is still in flight is queued rather than sent with a
 * revision the server hasn't reached yet, so dragging quickly coalesces into
 * one follow-up request instead of conflicting.
 */
export function useCanvasLayout(
  canvasId: number,
  result: CanvasDefinitionResult,
  reload: () => void,
): CanvasLayout {
  const [applied, setApplied] = useState<AppliedLayout>();
  const [error, setError] = useState<string>();
  const { revision, canEdit } = result;

  // Last revision the server acknowledged. Never an optimistic guess, so a
  // write is never based on a revision the server hasn't reached.
  const confirmed = useRef<number>();
  // The definition's own revision, for the write that hasn't had a response
  // yet (first drag after a load or a refetch).
  const fetched = useRef(revision);
  const writing = useRef(false);
  // Newest intent per node while a write is in flight; sent as one batch.
  const queued = useRef(new Map<string, GridPlacement>());
  // The definition's placements, for an optimistic view that has no newer
  // local layout to build on.
  const fetchedPlacements = useRef(result.placements);

  useEffect(() => {
    fetched.current = revision;
    fetchedPlacements.current = result.placements;
  }, [revision, result.placements]);

  useEffect(() => {
    // A different canvas shares none of this state.
    confirmed.current = undefined;
    writing.current = false;
    queued.current.clear();
    setApplied(undefined);
    setError(undefined);
  }, [canvasId]);

  const send = useCallback(
    (ops: Map<string, GridPlacement>) => {
      writing.current = true;
      const base = Math.max(fetched.current, confirmed.current ?? 0);
      SupersetClient.request({
        endpoint: `/api/v1/canvas/${canvasId}/definition`,
        method: 'PATCH',
        jsonPayload: {
          base_revision: base,
          ops: [...ops].map(([id, layout]) => ({ op: 'place', id, layout })),
        },
      })
        .then(({ json }) => {
          const written = json?.result as ApplyOperationsResult | undefined;
          if (!written) return;
          confirmed.current = written.revision;
          // Gestures queued while this write was in flight are newer than the
          // placements it resolved, so they stay on top -- otherwise the
          // widget would snap back until the follow-up request returned. The
          // view is tagged a revision ahead, which is what the follow-up will
          // produce, so a refetch of this revision doesn't drop them either.
          const waiting = [...queued.current];
          setApplied({
            revision: written.revision + (waiting.length > 0 ? 1 : 0),
            placements:
              waiting.length > 0
                ? { ...written.placements, ...Object.fromEntries(waiting) }
                : written.placements,
          });
        })
        .catch(async response => {
          queued.current.clear();
          setApplied(undefined);
          const { status } = response ?? {};
          if (status === 409) {
            setError(
              t(
                'This canvas changed while you were editing, so your change was undone.',
              ),
            );
            reload();
            return;
          }
          const { message } = await getClientErrorObject(response);
          setError(
            status === 403
              ? t('You do not have permission to change this layout.')
              : message || t('That change could not be saved.'),
          );
        })
        .finally(() => {
          writing.current = false;
          if (queued.current.size > 0) {
            const next = new Map(queued.current);
            queued.current.clear();
            send(next);
          }
        });
    },
    [canvasId, reload],
  );

  const place = useCallback(
    (nodeId: string, placement: GridPlacement) => {
      if (!canEdit) return;
      setError(undefined);
      // Show the drop straight away, built on the newest layout so an earlier
      // gesture isn't undone -- including one from this same batch, which a
      // ref read wouldn't see since refs only advance on render.
      setApplied(current => ({
        revision: Math.max(fetched.current, confirmed.current ?? 0) + 1,
        placements: {
          ...(current && current.revision > fetched.current
            ? current.placements
            : fetchedPlacements.current),
          [nodeId]: placement,
        },
      }));
      if (writing.current) {
        queued.current.set(nodeId, placement);
        return;
      }
      send(new Map([[nodeId, placement]]));
    },
    [canEdit, send],
  );

  const dismissError = useCallback(() => setError(undefined), []);

  // The definition wins once a fetch catches up to what was applied locally.
  const placements =
    applied && applied.revision > revision
      ? applied.placements
      : result.placements;

  return { placements, place, error, dismissError };
}
