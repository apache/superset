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
  GridLayout,
  GridPlacement,
  SpanConstraints,
  DraftChange,
} from './types';

/**
 * A pending write for one node.
 *
 * A drag within a grid replaces the node's layout; a drag into another grid
 * reparents it as well, which the server takes as a different operation.
 * Either way the node ends up somewhere, so both queue and coalesce the same.
 */
export type LayoutWrite =
  | { kind: 'place'; layout: GridPlacement }
  | { kind: 'move'; parent: string; index: number; layout: GridPlacement }
  | {
      kind: 'swap';
      partner: string;
      layout: GridPlacement;
      /**
       * Where the partner is shown going. Not sent -- the server works both
       * sides out from the exchange -- but the drop has to hold still while
       * the write is in flight, and this is what was already on screen.
       */
      partnerLayout: GridPlacement;
    }
  | { kind: 'remove' };

const asOperation = (id: string, write: LayoutWrite) => {
  if (write.kind === 'remove') return { op: 'remove', id };
  // One operation, not two places: the grid is resolved after every
  // operation, so sent apart the second would be decided against the grid the
  // first left behind -- which is not the grid either was chosen against.
  if (write.kind === 'swap') return { op: 'swap', id, partner: write.partner };
  return write.kind === 'place'
    ? { op: 'place', id, layout: write.layout }
    : {
        op: 'move',
        id,
        parent: write.parent,
        index: write.index,
        layout: write.layout,
      };
};

/** The same map without the nodes a write takes away. */
const without = <T>(
  entries: Record<string, T>,
  gone: ReadonlySet<string>,
): Record<string, T> =>
  gone.size === 0
    ? entries
    : Object.fromEntries(
        Object.entries(entries).filter(([nodeId]) => !gone.has(nodeId)),
      );

/** Nothing removed: one frozen instance, so an idle render keeps its identity. */
const NONE_REMOVED: ReadonlySet<string> = new Set();

/** The newest layout this client knows of, and the revision it belongs to. */
interface AppliedLayout {
  revision: number;
  placements: Record<string, GridPlacement>;
  /** The stored layouts behind `placements`; see `CanvasLayout.layouts`. */
  layouts: Record<string, GridLayout>;
  /** Reading order per grid; see `CanvasLayout.childOrder`. */
  childOrder: Record<string, string[]>;
  /** Span limits per node; see `CanvasLayout.layoutConstraints`. */
  layoutConstraints: Record<string, SpanConstraints>;
  /**
   * Which nodes each filter, cross-filter and customization drives.
   *
   * A scope follows the tree: a chart dragged from one group into another is
   * driven by the second group's filters, not the first's. The write returns
   * the resolved maps, and without them the chart renders in its new place
   * while still querying with its old group's filter -- until a refetch,
   * which a canvas with polling off never makes.
   */
  scopes: Scopes;
}

/** The scope maps a definition resolves, by response key. */
interface Scopes {
  filterScopes: Record<string, string[]>;
  crossFilterScopes: Record<string, string[]>;
  customizationScopes: Record<string, string[]>;
  eventScopes: Record<string, string[]>;
}

const scopesOf = (source: Scopes): Scopes => ({
  filterScopes: source.filterScopes,
  crossFilterScopes: source.crossFilterScopes,
  customizationScopes: source.customizationScopes,
  eventScopes: source.eventScopes,
});

export interface CanvasLayout {
  /** Placements to render: the newest local ones, else the server's. */
  placements: Record<string, GridPlacement>;
  /**
   * The stored layouts behind those placements, which is what the server
   * resolves from. Kept in step with every write rather than read from the
   * fetched definition: a write can change a node's stored layout without
   * being asked to, since a collided sibling is pushed down and its new `row`
   * written back. A drag preview resolving from the fetched layouts would
   * then disagree with the server until the next refetch.
   */
  layouts: Record<string, GridLayout>;
  /**
   * Each grid's children in reading order, kept in step with every write for
   * the same reason as `layouts`: a `place` reorders the parent's children so
   * the dropped widget wins the spot it landed on. A preview resolving against
   * the fetched order would put the neighbours somewhere the server does not,
   * and they would jump on release.
   */
  childOrder: Record<string, string[]>;
  /**
   * Each node's span limits, kept in step with every write for the same
   * reason as `layouts` and `childOrder`. A container's row minimum comes
   * from the rows its children occupy, so it moves whenever they do: a child
   * grown from four rows to eight raises its container's minimum, and a
   * client still clamping to four would send a span the server replaces.
   */
  layoutConstraints: Record<string, SpanConstraints>;
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
  /**
   * Exchange two widgets' places, in one operation. A drop landing squarely
   * on one widget takes its slot and gives up its own; the server decides
   * where each ends up, so the two cannot disagree.
   */
  swap: (
    nodeId: string,
    placement: GridPlacement,
    partnerId: string,
    partnerPlacement: GridPlacement,
  ) => void;
  /**
   * Persist a node moving into another container, at `index` in its reading
   * order and `placement` in its grid. A no-op when the user can't edit.
   */
  /** Takes a widget off the canvas. Undo in the draft puts it back. */
  remove: (nodeId: string) => void;
  /** Removed here, but still in the definition the grid renders from. */
  removed: ReadonlySet<string>;
  move: (
    nodeId: string,
    parent: string,
    index: number,
    placement: GridPlacement,
  ) => void;
  /**
   * Which nodes each filter, cross-filter, customization and event drives,
   * kept in step with every write for the same reason as `childOrder`: a
   * reparented widget is driven by its new container's filters, and a scope
   * read from the fetched definition would keep it on its old one's.
   *
   * All four, not three: events were left reading the fetched definition, so
   * a widget dragged into a group went on listening to the group it came
   * from until a refetch -- which a canvas with polling off never makes.
   */
  filterScopes: Record<string, string[]>;
  crossFilterScopes: Record<string, string[]>;
  customizationScopes: Record<string, string[]>;
  eventScopes: Record<string, string[]>;
  /**
   * What the draft lists as changed, and whether it holds anything at all.
   *
   * From the last write rather than the fetched definition, which does not
   * catch up until the next poll: a widget would otherwise wear the tag of
   * whatever was last done to it for seconds after being changed.
   */
  changes?: DraftChange[];
  empty?: boolean;
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
  // Removed here but still in the fetched definition, which is what the grid
  // renders its children from. Without this the widget stays on screen, and
  // with no placement left it lands wherever auto-flow puts it.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(NONE_REMOVED);
  // The definition caught up, so the set has done its job. Comparing against
  // the fetched nodes rather than clearing on any change: a poll that arrives
  // before the write lands would otherwise bring the widget back.
  useEffect(() => {
    setRemoved(current => {
      if (current.size === 0) return current;
      const left = [...current].filter(nodeId => nodeId in result.placements);
      return left.length === current.size ? current : new Set(left);
    });
  }, [result.placements]);

  const { revision, canEdit } = result;

  // Last revision the server acknowledged. Never an optimistic guess, so a
  // write is never based on a revision the server hasn't reached.
  const confirmed = useRef<number>();
  // The definition's own revision, for the write that hasn't had a response
  // yet (first drag after a load or a refetch).
  const fetched = useRef(revision);
  const writing = useRef(false);
  // Newest intent per node while a write is in flight; sent as one batch.
  const queued = useRef(new Map<string, LayoutWrite>());
  // The definition's placements, for an optimistic view that has no newer
  // local layout to build on.
  const fetchedPlacements = useRef(result.placements);
  const fetchedLayouts = useRef(result.layouts);
  const fetchedOrder = useRef(result.childOrder);
  const fetchedConstraints = useRef(result.layoutConstraints);
  const fetchedScopes = useRef(scopesOf(result));
  /**
   * What the last write said about the draft as a whole, rather than about
   * any one node: what it now lists as changed, and whether it holds anything
   * at all.
   *
   * Kept here because a write is the only thing that changes them and the
   * fetched definition does not catch up until the next poll -- five seconds
   * by default. Left to that, a widget wore the tag of whatever was done to
   * it last time for several seconds after being resized, and Save stayed
   * dark for the same stretch after the first change of a session.
   *
   * Deliberately not optimistic: only the server knows how it summarised an
   * operation, so these wait for the response rather than guessing, which
   * costs a round trip instead of a poll.
   */
  const [told, setTold] = useState<{
    revision: number;
    changes?: DraftChange[];
    empty?: boolean;
  }>();

  // The last layout the server acknowledged, without any optimistic overlay.
  // A failed write falls back to this rather than to the fetched definition,
  // which may be several acknowledged drags behind.
  const acknowledged = useRef<AppliedLayout>();

  useEffect(() => {
    fetched.current = revision;
    fetchedPlacements.current = result.placements;
    fetchedLayouts.current = result.layouts;
    fetchedOrder.current = result.childOrder;
    fetchedConstraints.current = result.layoutConstraints;
    fetchedScopes.current = scopesOf(result);
  }, [
    revision,
    result.placements,
    result.layouts,
    result.childOrder,
    result.layoutConstraints,
    result.filterScopes,
    result.crossFilterScopes,
    result.customizationScopes,
    result.eventScopes,
  ]);

  // Which surface this state belongs to. A request already in flight when the
  // surface changes still returns, and its response has to be dropped rather
  // than written over the new surface's.
  const generation = useRef(0);

  useEffect(() => {
    // A different canvas, or switching between a draft and the published
    // canvas, shares none of this state -- a draft counts its own revisions
    // from zero, so a revision confirmed on one surface means nothing on the
    // other.
    generation.current += 1;
    confirmed.current = undefined;
    acknowledged.current = undefined;
    writing.current = false;
    queued.current.clear();
    setApplied(undefined);
    setError(undefined);
    setSaving(false);
  }, [canvasId, draftToken]);

  const send = useCallback(
    (ops: Map<string, LayoutWrite>) => {
      writing.current = true;
      setSaving(true);
      // The surface this write belongs to, as of now. Everything below runs
      // after the response, by which time the user may have published or
      // discarded the plan, or navigated to another canvas.
      const era = generation.current;
      const base = Math.max(fetched.current, confirmed.current ?? 0);
      const placeOps = [...ops].map(([id, write]) => asOperation(id, write));
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
          // A response that outlived its surface. Letting it through would put
          // the old surface's revision in `confirmed`, and the new surface's
          // next write would be based on a revision it never had -- a draft
          // counts from zero, so that is a 409 or the wrong layout.
          if (era !== generation.current) return;
          const written = json?.result as ApplyOperationsResult | undefined;
          if (!written) return;
          confirmed.current = written.revision;
          setTold({
            revision: written.revision,
            changes: written.changes,
            empty: written.empty,
          });
          acknowledged.current = {
            revision: written.revision,
            placements: written.placements,
            layouts: written.layouts,
            childOrder: written.childOrder,
            layoutConstraints: written.layoutConstraints,
            scopes: scopesOf(written),
          };
          // Gestures queued while this write was in flight are newer than the
          // placements it resolved, so they stay on top -- otherwise the
          // widget would snap back until the follow-up request returned. The
          // view is tagged a revision ahead, which is what the follow-up will
          // produce, so a refetch of this revision doesn't drop them either.
          // A queued removal carries no placement of its own; it is still
          // sent as an operation, and the response settles what is left.
          const waiting = [...queued.current].flatMap(([id, write]) =>
            write.kind === 'remove' ? [] : [[id, write.layout] as const],
          );
          setApplied({
            revision: written.revision + (waiting.length > 0 ? 1 : 0),
            placements:
              waiting.length > 0
                ? { ...written.placements, ...Object.fromEntries(waiting) }
                : written.placements,
            layouts:
              waiting.length > 0
                ? { ...written.layouts, ...Object.fromEntries(waiting) }
                : written.layouts,
            // Not merged with the queued gestures: how they affect reading
            // order is the server's to decide, and the follow-up returns it.
            childOrder: written.childOrder,
            layoutConstraints: written.layoutConstraints,
            // The tree and its scopes advance together: a reparented chart
            // that kept its old group's filter would query with it.
            scopes: scopesOf(written),
          });
        })
        .catch(async response => {
          if (era !== generation.current) return;
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
          if (era !== generation.current) return;
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

  const write = useCallback(
    (entries: [string, LayoutWrite][]) => {
      if (!canEdit || entries.length === 0) return;
      setError(undefined);
      // Show the drop straight away, built on the newest layout so an earlier
      // gesture isn't undone -- including one from this same batch, which a
      // ref read wouldn't see since refs only advance on render.
      const moved = Object.fromEntries(
        entries.flatMap(([id, entry]) => {
          if (entry.kind === 'remove') return [];
          // One operation, but two widgets move; both have to hold still
          // until it returns.
          if (entry.kind === 'swap') {
            return [
              [id, entry.layout] as const,
              [entry.partner, entry.partnerLayout] as const,
            ];
          }
          return [[id, entry.layout] as const];
        }),
      );
      // A removed node has no placement to show; it leaves the layout here and
      // the definition when the write returns and the fetch catches up.
      const gone = new Set(
        entries
          .filter(([, entry]) => entry.kind === 'remove')
          .map(([id]) => id),
      );
      if (gone.size > 0) setRemoved(current => new Set([...current, ...gone]));
      setApplied(current => {
        const newer =
          current && current.revision > fetched.current ? current : undefined;
        return {
          revision: Math.max(fetched.current, confirmed.current ?? 0) + 1,
          placements: without(
            {
              ...(newer?.placements ?? fetchedPlacements.current),
              ...moved,
            },
            gone,
          ),
          // The op sends this placement as the node's layout, so that is
          // exactly what the server will store for it. The siblings it pushes
          // keep their old stored layout until the response lands.
          layouts: without(
            {
              ...(newer?.layouts ?? fetchedLayouts.current),
              ...moved,
            },
            gone,
          ),
          // Left as it stands until the write returns the server's. The
          // reorder depends on where the drop landed relative to every
          // sibling, and the response settles it within a round trip.
          childOrder: newer?.childOrder ?? fetchedOrder.current,
          layoutConstraints:
            newer?.layoutConstraints ?? fetchedConstraints.current,
          // Resolved from the tree, which only the server rebuilds; left as
          // it stands until the write returns the new one.
          scopes: newer?.scopes ?? fetchedScopes.current,
        };
      });
      if (writing.current) {
        // Deleted before being set: `Map.set` on a key it already holds keeps
        // that key's original position, and this queue is sent as ordered
        // operations. The server lets a later one win a contested cell, so a
        // node moved twice while a write was in flight has to end up last or
        // its newest drop loses to a sibling it was dropped on top of.
        entries.forEach(([id, entry]) => {
          queued.current.delete(id);
          queued.current.set(id, entry);
        });
        return;
      }
      send(new Map(entries));
    },
    [canEdit, send],
  );

  const place = useCallback(
    (nodeId: string, placement: GridPlacement) =>
      write([[nodeId, { kind: 'place', layout: placement }]]),
    [write],
  );

  const swap = useCallback(
    (
      nodeId: string,
      placement: GridPlacement,
      partnerId: string,
      partnerPlacement: GridPlacement,
    ) =>
      write([
        [
          nodeId,
          {
            kind: 'swap',
            partner: partnerId,
            layout: placement,
            partnerLayout: partnerPlacement,
          },
        ],
      ]),
    [write],
  );

  const move = useCallback(
    (nodeId: string, parent: string, index: number, placement: GridPlacement) =>
      write([[nodeId, { kind: 'move', parent, index, layout: placement }]]),
    [write],
  );

  const remove = useCallback(
    (nodeId: string) => write([[nodeId, { kind: 'remove' }]]),
    [write],
  );

  const dismissError = useCallback(() => setError(undefined), []);

  // The definition wins once a fetch catches up to what was applied locally.
  const newer = applied && applied.revision > revision ? applied : undefined;
  const latest = told && told.revision > revision ? told : undefined;

  return {
    placements: newer?.placements ?? result.placements,
    layouts: newer?.layouts ?? result.layouts,
    childOrder: newer?.childOrder ?? result.childOrder,
    layoutConstraints: newer?.layoutConstraints ?? result.layoutConstraints,
    filterScopes: newer?.scopes.filterScopes ?? result.filterScopes,
    crossFilterScopes:
      newer?.scopes.crossFilterScopes ?? result.crossFilterScopes,
    customizationScopes:
      newer?.scopes.customizationScopes ?? result.customizationScopes,
    eventScopes: newer?.scopes.eventScopes ?? result.eventScopes,
    changes: latest?.changes ?? result.changes,
    empty: latest?.empty ?? result.empty,
    revision: Math.max(revision, confirmed.current ?? 0),
    saving,
    place,
    move,
    swap,
    remove,
    removed,
    error,
    dismissError,
  };
}
