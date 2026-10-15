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
import { DRAFT_TOKEN_HEADER } from './useCanvasDefinition';
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
  /**
   * The newest revision the server is known to hold — the one the last write
   * returned, else the one the definition was fetched at. Never an optimistic
   * guess, so it is safe to send back as the revision a request is based on
   * (a draft commit, say, which requires an exact match).
   */
  revision: number;
  /**
   * Whether a layout write is in flight or queued, so `revision` is about to
   * move. A caller that sends `revision` to the server — publishing a draft —
   * must wait for this to clear, or it names a revision that is already stale
   * and loses the writes that had not landed.
   */
  saving: boolean;
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
  draftToken?: string,
): CanvasLayout {
  const [applied, setApplied] = useState<AppliedLayout>();
  const [error, setError] = useState<string>();
  // Mirrors `writing`/`queued` as state, since callers render against it.
  const [saving, setSaving] = useState(false);
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
  // The last layout the server acknowledged, without any optimistic overlay.
  // A failed write falls back to this rather than to the fetched definition,
  // which may be several acknowledged drags behind.
  const acknowledged = useRef<AppliedLayout>();

  useEffect(() => {
    fetched.current = revision;
    fetchedPlacements.current = result.placements;
  }, [revision, result.placements]);

  useEffect(() => {
    // A different canvas, or switching between a draft and the published
    // canvas, shares none of this state -- a draft counts its own revisions
    // from zero, so a revision confirmed on one surface means nothing on the
    // other.
    confirmed.current = undefined;
    acknowledged.current = undefined;
    writing.current = false;
    queued.current.clear();
    setApplied(undefined);
    setError(undefined);
    setSaving(false);
  }, [canvasId, draftToken]);

  const send = useCallback(
    (ops: Map<string, GridPlacement>) => {
      writing.current = true;
      setSaving(true);
      const base = Math.max(fetched.current, confirmed.current ?? 0);
      const placeOps = [...ops].map(([id, layout]) => ({
        op: 'place',
        id,
        layout,
      }));
      // While a draft is open the layout belongs to the draft, not the
      // published canvas: same operations, but its own route, its own
      // revision field, and the token that authorizes it.
      const target = draftToken
        ? {
            endpoint: '/api/v1/canvas/draft',
            headers: { [DRAFT_TOKEN_HEADER]: draftToken },
            jsonPayload: { revision: base, ops: placeOps },
          }
        : {
            endpoint: `/api/v1/canvas/${canvasId}/definition`,
            jsonPayload: { base_revision: base, ops: placeOps },
          };
      SupersetClient.request({ ...target, method: 'PATCH' })
        .then(({ json }) => {
          const written = json?.result as ApplyOperationsResult | undefined;
          if (!written) return;
          confirmed.current = written.revision;
          acknowledged.current = {
            revision: written.revision,
            placements: written.placements,
          };
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
          // Back to the last layout the server acknowledged, not to the
          // fetched definition: dropping to the latter would make an earlier
          // acknowledged drag vanish from the screen until the next poll,
          // even though the server has it.
          setApplied(acknowledged.current);
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
            // Still saving: the follow-up sets the flag again straight away.
            send(next);
          } else {
            setSaving(false);
          }
        });
    },
    [canvasId, draftToken, reload],
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

  return {
    placements,
    revision: Math.max(revision, confirmed.current ?? 0),
    saving,
    place,
    error,
    dismissError,
  };
}
