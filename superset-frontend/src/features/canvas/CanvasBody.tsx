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
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ScopeKind } from 'src/core/canvas/types';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { Button, EmptyState } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import CanvasGrid, { EventValues, ScopeValues } from './CanvasGrid';
import DraftBanner from './DraftBanner';
import CanvasToolbar from './CanvasToolbar';
import { useDraftActions } from './useDraftActions';
import { useDraftHistory } from './useDraftHistory';
import { usePublishActiveCanvas } from './useActiveCanvas';
import { useStartDraft } from './useStartDraft';
import { useCanvasLayout } from './useCanvasLayout';
import {
  CanvasSelectionContext,
  useCanvasSelectionState,
} from './useCanvasSelection';
import { CanvasDefinitionResult } from './types';

interface CanvasBodyProps {
  canvasId: number;
  result: CanvasDefinitionResult;
  reload: () => void;
  values: ScopeValues;
  onValueChange: (kind: ScopeKind, nodeId: string, value: unknown) => void;
  /** Values published under kinds other than the three scope kinds. */
  events?: EventValues;
  /** Records a value a widget published, for the nodes its scope reaches. */
  onPublish?: (kind: string, nodeId: string, value: unknown) => void;
  refreshKeys: Record<string, number>;
  /** Set while a draft is open; layout writes then go to the draft. */
  draftToken?: string;
  /**
   * The open draft ended elsewhere -- published by an agent through the same
   * token, committed or discarded in another tab -- or expired.
   */
  draftGone?: boolean;
  /** The version being previewed; widgets read their data from it. */
  versionUuid?: string;
  /** Starts a draft and shows it. */
  onDraftOpened: (token: string) => void;
  /** Leaves the draft, returning to the published canvas. */
  onDraftClosed: () => void;
  /** True when the canvas holds no widgets yet. */
  isEmpty: boolean;
  /**
   * Where to put the toolbar, when the page has a place for it.
   *
   * The controls belong on the title row, but what they do -- the draft's
   * revision, whether a write is in flight -- is only known here. Rather than
   * lift all of that into the page, the page lends this a node in its header.
   */
  toolbarSlot?: HTMLElement | null;
  /**
   * What the page knows about the canvas, for telling extensions which one is
   * open. Left out while the page has nothing current to say.
   */
  active?: {
    title?: string;
    /** Revision of the definition the page has loaded. */
    revision: number;
    /**
     * Whether `draftToken`'s own definition has loaded, and the draft has not
     * since turned out to be gone.
     */
    draftLoaded: boolean;
    /** Whether the last refresh of the draft failed. */
    draftRefreshFailed: boolean;
    /** The saved version rendered in place of the canvas, if any. */
    previewedVersion?: { uuid: string; number: number };
  };
}

/**
 * The canvas itself, once its definition has loaded. Drag and resize persist
 * from here; a write that doesn't land says so and leaves the layout where the
 * server still has it.
 */
export default function CanvasBody({
  canvasId,
  result,
  reload,
  values,
  onValueChange,
  events,
  onPublish,
  refreshKeys,
  draftToken,
  draftGone = false,
  versionUuid,
  onDraftOpened,
  onDraftClosed,
  isEmpty,
  toolbarSlot,
  active,
}: CanvasBodyProps) {
  const layout = useCanvasLayout(canvasId, result, reload, draftToken);
  const { addDangerToast } = useToasts();
  // A write that doesn't land is said once, where the user is looking. A
  // notice above the canvas is off-screen on anything taller than the window,
  // which is most of them, so a drag would snap back saying nothing.
  const { error, dismissError } = layout;
  useEffect(() => {
    if (!error) return;
    addDangerToast(error);
    dismissError();
  }, [error, addDangerToast, dismissError]);
  // True while the draft is being published or discarded.
  const [committing, setCommitting] = useState(false);
  const actions = useDraftActions(
    draftToken,
    // The revision the layout writes have reached, not the one the definition
    // was fetched at: a commit must name the draft's current revision, and
    // dragging moves it on well before the next poll.
    layout.revision,
    onDraftClosed,
    setCommitting,
    canvasId,
  );
  // A step moves the draft on before the refetch shows it, so a gesture made
  // meanwhile is based on the step's revision rather than conflicting.
  const history = useDraftHistory(
    draftToken,
    layout.revision,
    result,
    reload,
    layout.adopt,
  );
  // Here rather than in the page: whether a change to the draft is in flight,
  // and the revision it has reached, are only known here.
  usePublishActiveCanvas(
    active?.title === undefined
      ? undefined
      : {
          id: canvasId,
          title: active.title,
          revision: active.revision,
          draftToken,
          draftLoaded: active.draftLoaded && !versionUuid,
          draftRevision: layout.revision,
          draftPending:
            active.draftRefreshFailed ||
            layout.saving ||
            committing ||
            history.busy ||
            Boolean(history.settling),
          previewedVersion: versionUuid ? active.previewedVersion : undefined,
        },
  );
  const { start, starting } = useStartDraft(canvasId, onDraftOpened);
  // Changes are made in a plan; the published canvas is read-only even for
  // someone who may edit it. Editing also stops once a publish starts: the
  // commit names a revision and then deletes the draft, so a change accepted
  // after that read would be replayed by nothing. The single place this
  // policy is decided.
  const editable =
    result.canEdit && Boolean(draftToken) && !draftGone && !committing;
  // Held here rather than in the grid: `editable` and the placements are
  // already here, and this is above the toolbar as well as the canvas, so an
  // action on the selected widget has somewhere to live later.
  const selection = useCanvasSelectionState({
    editable,
    placements: layout.placements,
  });
  // A rejected write is shown at the placement its issue points at.
  const { errorAt } = layout;
  const { select } = selection;
  useEffect(() => {
    if (errorAt) select(errorAt);
  }, [errorAt, select]);
  const toolbar = (
    <CanvasToolbar
      canEdit={result.canEdit}
      // Undo, redo and their shortcuts go with a draft that is gone.
      draftToken={draftGone ? undefined : draftToken}
      onEnter={start}
      // Held while a drag or resize is still in flight or queued: a commit
      // then would publish the older revision and delete the draft,
      // silently dropping the move the user just made.
      saving={layout.saving}
      history={history}
      actions={actions}
      starting={starting}
    />
  );
  return (
    <CanvasSelectionContext.Provider value={selection}>
      {toolbarSlot ? createPortal(toolbar, toolbarSlot) : toolbar}
      {/* What the draft holds comes from the layout, which every write
          updates, rather than from the fetched definition, which does not
          catch up until the next poll. */}
      {draftToken && draftGone && (
        <Alert
          type="info"
          showIcon
          closable={false}
          message={t(
            'This draft was published, discarded or expired elsewhere.',
          )}
          action={
            <Button
              buttonStyle="primary"
              buttonSize="small"
              onClick={onDraftClosed}
              data-test="canvas-draft-gone-leave"
            >
              {t('Show the published canvas')}
            </Button>
          }
        />
      )}
      {draftToken && !draftGone && (
        <DraftBanner
          history={history}
          actions={actions}
          saving={layout.saving}
          changes={layout.changes ?? result.changes}
          empty={layout.empty ?? result.empty}
          titles={result.titles}
        />
      )}
      {isEmpty ? (
        <EmptyState
          size="medium"
          title={t('This canvas is empty')}
          description={t('Ask the chat to add widgets to it.')}
        />
      ) : (
        <CanvasGrid
          canvasId={canvasId}
          result={result}
          values={values}
          onValueChange={onValueChange}
          events={events}
          onPublish={onPublish}
          refreshKeys={refreshKeys}
          layout={layout}
          editable={editable}
          // Widgets read their data from the draft while one is open.
          draftToken={draftToken}
          versionUuid={versionUuid}
        />
      )}
    </CanvasSelectionContext.Provider>
  );
}
