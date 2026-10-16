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
import { useState } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { EmptyState } from '@superset-ui/core/components';
import CanvasGrid, { ScopeValues } from './CanvasGrid';
import DraftBanner from './DraftBanner';
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
  /** Leaves the draft, returning to the published canvas. */
  onDraftClosed: () => void;
  /** True when the canvas holds no widgets yet. */
  isEmpty: boolean;
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
  onDraftClosed,
  isEmpty,
}: CanvasBodyProps) {
  const layout = useCanvasLayout(canvasId, result, reload, draftToken);
  // True while the draft is being published or discarded.
  const [committing, setCommitting] = useState(false);
  // Changes are made in a plan; the published canvas is read-only even for
  // someone who may edit it. Editing also stops once a publish starts: the
  // commit names a revision and then deletes the draft, so a change accepted
  // after that read would be replayed by nothing. The single place this
  // policy is decided.
  const editable = result.canEdit && Boolean(draftToken) && !committing;
  return (
    <>
      {draftToken && (
        <DraftBanner
          token={draftToken}
          // The revision the layout writes have reached, not the one the
          // definition was fetched at: a commit must name the draft's current
          // revision, and dragging moves it on well before the next poll.
          revision={layout.revision}
          // Held while a drag or resize is still in flight or queued: a
          // commit then would publish the older revision and delete the
          // draft, silently dropping the move the user just made.
          saving={layout.saving}
          onBusyChange={setCommitting}
          onClose={onDraftClosed}
        />
      )}
      {layout.error && (
        <Alert
          type="warning"
          closable
          showIcon
          message={layout.error}
          onClose={layout.dismissError}
          data-test="canvas-layout-error"
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
