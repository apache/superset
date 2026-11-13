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
import { t } from '@apache-superset/core/translation';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { DRAFT_TOKEN_HEADER } from './useCanvasDefinition';

export interface DraftActions {
  /** Replay the draft onto the canvas, making it everyone's. */
  publish: () => Promise<void>;
  /** Throw the draft away. */
  discard: () => Promise<void>;
  /** Whether either is running. */
  busy: boolean;
}

/**
 * Publishing and discarding a draft.
 *
 * Both end the draft, so both report `busy` while they run: a commit names a
 * revision and then deletes the draft, and a change accepted after it read
 * that revision is replayed by nothing while the publish still says it
 * worked.
 */
export function useDraftActions(
  token: string | undefined,
  revision: number,
  onClosed: () => void,
  onBusyChange?: (busy: boolean) => void,
): DraftActions {
  const { addSuccessToast, addDangerToast } = useToasts();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (action: () => Promise<unknown>, done: string) => {
      setBusy(true);
      onBusyChange?.(true);
      try {
        await action();
        addSuccessToast(done);
        onClosed();
      } catch (response) {
        const error = await getClientErrorObject(response);
        addDangerToast(
          error.message || error.error || t('Something went wrong'),
        );
      } finally {
        setBusy(false);
        onBusyChange?.(false);
      }
    },
    [addSuccessToast, addDangerToast, onClosed, onBusyChange],
  );

  const headers = { [DRAFT_TOKEN_HEADER]: token ?? '' };

  const publish = useCallback(
    () =>
      run(
        () =>
          SupersetClient.post({
            endpoint: '/api/v1/canvas/draft/commit',
            headers,
            jsonPayload: { revision },
          }),
        t('Draft published'),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, revision, token],
  );

  const discard = useCallback(
    () =>
      run(
        () =>
          SupersetClient.delete({ endpoint: '/api/v1/canvas/draft', headers }),
        t('Draft discarded'),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, token],
  );

  return { publish, discard, busy };
}
