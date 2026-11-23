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
import { useCallback, useState } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { fireDraftEvent, preparePublish } from 'src/core';
import {
  LOG_ACTIONS_CANVAS_DRAFT_END,
  LOG_ACTIONS_CANVAS_ERROR,
} from 'src/logger/LogUtils';
import { DRAFT_TOKEN_HEADER } from './useCanvasDefinition';
import { useCanvasLogger } from './useCanvasLogger';

/** What publishing a draft also publishes, while the person reviews it. */
export interface PublishReview {
  parts: canvasApi.CanvasPublishPart[];
  /** Publish the parts, then the canvas. */
  confirm: () => void;
  /** Close the review, publishing nothing. */
  cancel: () => void;
}

export interface DraftActions {
  /**
   * Replay the draft onto the canvas, making it everyone's. When something is
   * published with it, this opens `review` instead, and `review.confirm`
   * publishes.
   */
  publish: () => Promise<void>;
  /** Throw the draft away. */
  discard: () => Promise<void>;
  /** Whether either is running. */
  busy: boolean;
  /** Set while the person reviews what is published with the canvas. */
  review?: PublishReview;
}

type Outcome = 'commit' | 'discard';

const NO_WIDGETS: canvasApi.CanvasDraftWidget[] = [];

/**
 * Publishing and discarding a draft.
 *
 * Both end the draft, so both report `busy` while they run: a commit names a
 * revision and then deletes the draft, and a change accepted after it read
 * that revision is replayed by nothing while the publish still says it
 * worked.
 *
 * What a publish participant publishes with the draft (`canvas.
 * registerPublishParticipant`) goes first, once the person confirmed it, so
 * that a part that fails leaves the canvas unpublished.
 */
export function useDraftActions(
  token: string | undefined,
  revision: number,
  onClosed: () => void,
  onBusyChange?: (busy: boolean) => void,
  canvasId?: number,
  /** The saved widgets the draft places, as participants are told them. */
  widgets: canvasApi.CanvasDraftWidget[] = NO_WIDGETS,
): DraftActions {
  const { addSuccessToast, addDangerToast } = useToasts();
  const [busy, setBusy] = useState(false);
  // What the person reviews, and the draft's revision it was read at: the
  // publish names that revision, so a draft that moved since is refused
  // rather than published without what came with the move.
  const [reviewed, setReviewed] = useState<{
    parts: canvasApi.CanvasPublishPart[];
    revision: number;
  }>();
  const log = useCanvasLogger(canvasId, { isDraft: true });

  const holding = useCallback(
    (held: boolean) => {
      setBusy(held);
      onBusyChange?.(held);
    },
    [onBusyChange],
  );

  const fail = useCallback(
    async (response: unknown, outcome: Outcome) => {
      const error = await getClientErrorObject(
        response as Parameters<typeof getClientErrorObject>[0],
      );
      log(LOG_ACTIONS_CANVAS_ERROR, {
        scope: 'draft',
        outcome,
        status: error.status,
        has_err: true,
      });
      addDangerToast(error.message || error.error || t('Something went wrong'));
    },
    [addDangerToast, log],
  );

  const run = useCallback(
    async (action: () => Promise<unknown>, done: string, outcome: Outcome) => {
      holding(true);
      try {
        await action();
        addSuccessToast(done);
        // The close of the draft funnel. An abandoned draft is the absence of
        // this event, which is why the outcome is a field rather than two
        // separate names.
        log(LOG_ACTIONS_CANVAS_DRAFT_END, { outcome, revision });
        if (canvasId !== undefined && token) {
          fireDraftEvent({
            kind: outcome === 'commit' ? 'committed' : 'discarded',
            canvasId,
            token,
            steppedWidgetIds: [],
          });
        }
        onClosed();
      } catch (response) {
        await fail(response, outcome);
      } finally {
        setReviewed(undefined);
        holding(false);
      }
    },
    [addSuccessToast, canvasId, fail, holding, log, onClosed, revision, token],
  );

  const headers = { [DRAFT_TOKEN_HEADER]: token ?? '' };

  const commit = (at: number = revision) =>
    SupersetClient.post({
      endpoint: '/api/v1/canvas/draft/commit',
      headers,
      jsonPayload: { revision: at },
    });

  // The parts publish before the canvas, which a commit that is then refused
  // would leave published alone: what refuses a commit is checked first.
  const checkCommit = async (at: number) => {
    const { json } = await SupersetClient.get({
      endpoint: '/api/v1/canvas/draft',
      headers,
    });
    const current = json?.result ?? {};
    if (current.revision !== at) {
      throw new Error(
        t('The draft changed since you reviewed it. Check it, then publish.'),
      );
    }
    if (current.canvasChanged) {
      throw new Error(
        t('The canvas changed since this draft started; start a new draft.'),
      );
    }
  };

  const publish = useCallback(
    async () => {
      if (canvasId === undefined || !token) {
        await run(() => commit(), t('Draft published'), 'commit');
        return;
      }
      holding(true);
      let found: canvasApi.CanvasPublishPart[];
      try {
        found = await preparePublish({ canvasId, token, widgets });
      } catch (response) {
        await fail(response, 'commit');
        holding(false);
        return;
      }
      if (found.length === 0) {
        await run(() => commit(), t('Draft published'), 'commit');
        return;
      }
      holding(false);
      setReviewed({ parts: found, revision });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, revision, token, canvasId, widgets, holding, fail],
  );

  const confirm = useCallback(
    () => {
      if (!reviewed || busy) return;
      run(
        async () => {
          await checkCommit(reviewed.revision);
          for (const part of reviewed.parts) {
            // One at a time, in the order listed: the first that fails
            // stops the rest, and the canvas with them.
            // eslint-disable-next-line no-await-in-loop
            await part.publish();
          }
          await commit(reviewed.revision);
        },
        t('Draft published'),
        'commit',
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reviewed, busy, run, token],
  );

  const cancel = useCallback(() => {
    if (!busy) setReviewed(undefined);
  }, [busy]);

  const discard = useCallback(
    () =>
      run(
        () =>
          SupersetClient.delete({ endpoint: '/api/v1/canvas/draft', headers }),
        t('Draft discarded'),
        'discard',
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, token],
  );

  return {
    publish,
    discard,
    busy,
    review: reviewed ? { parts: reviewed.parts, confirm, cancel } : undefined,
  };
}
