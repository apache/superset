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
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { EmptyState } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import CanvasGrid, { ScopeValues } from './CanvasGrid';
import DraftBanner from './DraftBanner';
import CanvasToolbar from './CanvasToolbar';
import { useDraftActions } from './useDraftActions';
import { useDraftHistory } from './useDraftHistory';
import { useStartDraft } from './useStartDraft';
import { useCanvasLayout } from './useCanvasLayout';
import { CanvasDefinitionResult } from './types';

interface CanvasBodyProps {
  canvasId: number;
  result: CanvasDefinitionResult;
  reload: () => void;
  values: ScopeValues;
  onValueChange: (
    kind: canvasApi.ScopeKind,
    nodeId: string,
    value: unknown,
  ) => void;
  refreshKeys: Record<string, number>;
  /** Set while a draft is open; layout writes then go to the draft. */
  draftToken?: string;
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
  refreshKeys,
  draftToken,
  onDraftOpened,
  onDraftClosed,
  isEmpty,
  toolbarSlot,
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
  );
  const history = useDraftHistory(draftToken, layout.revision, result, reload);
  const { start, starting } = useStartDraft(canvasId, onDraftOpened);
  // Changes are made in a plan; the published canvas is read-only even for
  // someone who may edit it. Editing also stops once a publish starts: the
  // commit names a revision and then deletes the draft, so a change accepted
  // after that read would be replayed by nothing. The single place this
  // policy is decided.
  const editable = result.canEdit && Boolean(draftToken) && !committing;
  const toolbar = (
    <CanvasToolbar
      canEdit={result.canEdit}
      draftToken={draftToken}
      // A draft that has been written to holds something to lose; one just
      // started does not, and leaving it needs no ceremony.
      unpublished={history.canUndo}
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
    <>
      {toolbarSlot ? createPortal(toolbar, toolbarSlot) : toolbar}
      {draftToken && <DraftBanner />}
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
          refreshKeys={refreshKeys}
          layout={layout}
          editable={editable}
          // Widgets read their data from the draft while one is open.
          draftToken={draftToken}
        />
      )}
    </>
  );
}
