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

/** How one part of a confirmed publish went. */
export type PublishPartOutcome =
  | { state: 'published'; notices: string[] }
  | { state: 'failed'; message: string };

/**
 * How a confirmed publish ended, when it ended with something for the person
 * to read: `published`, the canvas with it, when a part has notices; or
 * `stopped`, when parts went out and the canvas didn't, with why, and whether
 * publishing again from the review can help.
 */
export type PublishEnd =
  | { state: 'published' }
  | { state: 'stopped'; reason: string; retry: boolean };

/** What publishing a draft also publishes, while the person reviews it. */
export interface PublishReview {
  parts: canvasApi.CanvasPublishPart[];
  /** How each part's publish went, at its index; none for a part not reached. */
  outcomes: (PublishPartOutcome | undefined)[];
  /** How the publish ended, once it ended with something to read. */
  end?: PublishEnd;
  /**
   * Publish the parts, then the canvas. After a stop that publishing again can
   * help, publish the parts that didn't go out, then the canvas; after any
   * other end, close the review.
   */
  confirm: () => void;
  /** Close the review, publishing nothing more. */
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

interface Reviewed {
  parts: canvasApi.CanvasPublishPart[];
  /**
   * The draft's revision the review was read at: the publish names it, so a
   * draft that moved since is refused rather than published without what came
   * with the move.
   */
  revision: number;
  outcomes: (PublishPartOutcome | undefined)[];
  end?: PublishEnd;
}

const NO_WIDGETS: canvasApi.CanvasDraftWidget[] = [];

const failure = async (response: unknown) => {
  const error = await getClientErrorObject(
    response as Parameters<typeof getClientErrorObject>[0],
  );
  return {
    status: error.status,
    message: error.message || error.error || t('Something went wrong'),
  };
};

// Only a request that never got an answer, or a server that failed, may
// succeed as it is; any other refusal stands until the draft changes.
const retryable = (status: number | undefined) =>
  status === undefined || status >= 500;

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
 * that a part that fails leaves the canvas unpublished. What went out stays
 * out, so a publish that stops after it says so, and publishing again goes on
 * from the part that stopped it.
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
  const [reviewed, setReviewed] = useState<Reviewed>();
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
      const { status, message } = await failure(response);
      log(LOG_ACTIONS_CANVAS_ERROR, {
        scope: 'draft',
        outcome,
        status,
        has_err: true,
      });
      addDangerToast(message);
    },
    [addDangerToast, log],
  );

  const closed = useCallback(
    (outcome: Outcome, at: number) => {
      // The close of the draft funnel. An abandoned draft is the absence of
      // this event, which is why the outcome is a field rather than two
      // separate names.
      log(LOG_ACTIONS_CANVAS_DRAFT_END, { outcome, revision: at });
      if (canvasId !== undefined && token) {
        fireDraftEvent({
          kind: outcome === 'commit' ? 'committed' : 'discarded',
          canvasId,
          token,
          steppedWidgetIds: [],
        });
      }
      onClosed();
    },
    [canvasId, log, onClosed, token],
  );

  const run = useCallback(
    async (action: () => Promise<unknown>, done: string, outcome: Outcome) => {
      holding(true);
      try {
        await action();
        addSuccessToast(done);
        closed(outcome, revision);
      } catch (response) {
        await fail(response, outcome);
      } finally {
        setReviewed(undefined);
        holding(false);
      }
    },
    [addSuccessToast, closed, fail, holding, revision],
  );

  const headers = { [DRAFT_TOKEN_HEADER]: token ?? '' };

  const commit = (at: number = revision) =>
    SupersetClient.post({
      endpoint: '/api/v1/canvas/draft/commit',
      headers,
      jsonPayload: { revision: at },
    });

  // Why the draft can't be published as the person reviewed it, if it
  // can't. The parts publish before the canvas, which a commit that is then
  // refused would leave published alone: what refuses a commit is checked
  // first.
  const outdated = async (at: number): Promise<string | undefined> => {
    const { json } = await SupersetClient.get({
      endpoint: '/api/v1/canvas/draft',
      headers,
    });
    const current = json?.result ?? {};
    if (current.revision !== at) {
      return t(
        'The draft changed since you reviewed it. Check it, then publish.',
      );
    }
    if (current.canvasChanged) {
      return t(
        'The canvas changed since this draft started; start a new draft.',
      );
    }
    return undefined;
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
      setReviewed({ parts: found, revision, outcomes: [] });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, revision, token, canvasId, widgets, holding, fail],
  );

  const confirm = useCallback(
    () => {
      if (!reviewed || busy) return;
      const { end, parts, revision: at } = reviewed;
      if (end && (end.state === 'published' || !end.retry)) {
        setReviewed(undefined);
        return;
      }
      const outcomes = [...reviewed.outcomes];
      const show = (ended?: PublishEnd) =>
        setReviewed(
          current =>
            current && { ...current, outcomes: [...outcomes], end: ended },
        );
      // `alone` is what the person is told when nothing went out, which a
      // toast says alone, as for a publish that had no parts.
      const stop = (
        reason: string,
        retry: boolean,
        status?: number,
        alone: string = reason,
      ) => {
        const published = outcomes.filter(
          outcome => outcome?.state === 'published',
        ).length;
        log(LOG_ACTIONS_CANVAS_ERROR, {
          scope: 'draft',
          outcome: 'commit',
          status,
          has_err: true,
          parts_published: published,
        });
        if (published > 0) {
          show({ state: 'stopped', reason, retry });
          return;
        }
        // Nothing went out, so the draft is as it was and publishing again
        // is a publish like the first.
        setReviewed(undefined);
        addDangerToast(alone);
      };
      const publishAll = async () => {
        try {
          const refusal = await outdated(at);
          if (refusal !== undefined) {
            stop(refusal, false);
            return;
          }
        } catch (response) {
          const { status, message } = await failure(response);
          stop(message, retryable(status), status);
          return;
        }
        for (const [index, part] of parts.entries()) {
          // One at a time, in the order listed: the first that fails stops
          // the rest, and the canvas with them. One that went out in an
          // earlier try stays out, and isn't published twice.
          if (outcomes[index]?.state !== 'published') {
            try {
              // eslint-disable-next-line no-await-in-loop
              const result = await part.publish();
              outcomes[index] = {
                state: 'published',
                notices: result?.notices ?? [],
              };
            } catch (error) {
              // eslint-disable-next-line no-await-in-loop
              const { message } = await failure(error);
              outcomes[index] = { state: 'failed', message };
              stop(
                t(
                  "%s wasn't published, so the canvas wasn't either.",
                  part.title,
                ),
                true,
                undefined,
                message,
              );
              return;
            }
            show();
          }
        }
        try {
          await commit(at);
        } catch (response) {
          const { status, message } = await failure(response);
          stop(
            // As after a commit whose answer was lost, and then retried.
            status === 404
              ? t(
                  'This draft is no longer available: it was published, discarded or expired.',
                )
              : message,
            retryable(status),
            status,
          );
          return;
        }
        closed('commit', at);
        if (
          outcomes.some(
            outcome =>
              outcome?.state === 'published' && outcome.notices.length > 0,
          )
        ) {
          show({ state: 'published' });
        } else {
          setReviewed(undefined);
          addSuccessToast(t('Draft published'));
        }
      };
      holding(true);
      publishAll().finally(() => holding(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reviewed, busy, token, closed, holding, log],
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
    review: reviewed
      ? {
          parts: reviewed.parts,
          outcomes: reviewed.outcomes,
          end: reviewed.end,
          confirm,
          cancel,
        }
      : undefined,
  };
}
