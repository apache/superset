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
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { Button, Space } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { DRAFT_TOKEN_HEADER } from './useCanvasDefinition';

interface DraftBannerProps {
  token: string;
  revision: number;
  onClose: () => void;
  /**
   * Whether a change to the draft is still being saved. Both actions wait on
   * it. Publishing names a revision, so committing mid-save would publish the
   * draft as it was before those changes landed and then delete it, losing
   * them. Discarding deletes the draft, and a save that is mid-flight writes
   * the draft back to the cache afterwards -- recreating what was just
   * discarded, under a token the user was told no longer works.
   */
  saving?: boolean;
  /**
   * Reports whether a publish or discard is running, so the caller can stop
   * accepting edits: a commit names a revision and then deletes the draft, so
   * a change accepted after it read that revision is replayed by nothing and
   * lost while the publish still reports success.
   */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * Marks a draft as unpublished and offers to publish or discard it. Publishing
 * is rejected if the canvas changed since the draft started.
 */
export default function DraftBanner({
  token,
  revision,
  onClose,
  saving = false,
  onBusyChange,
}: DraftBannerProps) {
  const { addSuccessToast, addDangerToast } = useToasts();
  const [busy, setBusy] = useState(false);
  const headers = { [DRAFT_TOKEN_HEADER]: token };

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    onBusyChange?.(true);
    try {
      await action();
      addSuccessToast(done);
      onClose();
    } catch (response) {
      const error = await getClientErrorObject(response);
      addDangerToast(error.message || error.error || t('Something went wrong'));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  const publish = () =>
    run(
      () =>
        SupersetClient.post({
          endpoint: '/api/v1/canvas/draft/commit',
          headers,
          jsonPayload: { revision },
        }),
      t('Draft published'),
    );
  const discard = () =>
    run(
      () =>
        SupersetClient.delete({ endpoint: '/api/v1/canvas/draft', headers }),
      t('Draft discarded'),
    );

  return (
    <Alert
      type="info"
      showIcon
      message={t('Draft')}
      description={t('Only you can see these changes until you publish them.')}
      action={
        <Space>
          <Button
            buttonStyle="primary"
            buttonSize="small"
            loading={busy || saving}
            disabled={saving}
            onClick={publish}
            tooltip={saving ? t('Saving your changes…') : undefined}
            data-test="canvas-draft-publish"
          >
            {t('Publish')}
          </Button>
          <Button
            buttonSize="small"
            disabled={busy || saving}
            onClick={discard}
            tooltip={saving ? t('Saving your changes…') : undefined}
            data-test="canvas-draft-discard"
          >
            {t('Discard')}
          </Button>
        </Space>
      }
    />
  );
}
