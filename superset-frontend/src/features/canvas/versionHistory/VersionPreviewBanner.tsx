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
import { t, tn } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { getClientErrorObject } from '@superset-ui/core';
import { Button, Modal, Space } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { formatVersionDateTime } from 'src/features/versionHistory/display';
import type { VersionMeta } from 'src/features/versionHistory/types';
import { describeCanvasVersion, versionLabel } from './describeVersion';
import type { RestoreResult } from './api';

interface VersionPreviewBannerProps {
  version: VersionMeta;
  onRestore: (versionUuid: string) => Promise<RestoreResult>;
  onClose: () => void;
}

/** Marks the canvas on screen as an earlier version, and offers to restore it. */
export default function VersionPreviewBanner({
  version,
  onRestore,
  onClose,
}: VersionPreviewBannerProps) {
  const { addSuccessToast, addDangerToast, addWarningToast } = useToasts();
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const label = `${versionLabel(version)} · ${formatVersionDateTime(
    version.issued_at,
  )}`;

  const restore = async () => {
    setRestoring(true);
    try {
      const { skippedPlacements } = await onRestore(version.version_uuid);
      if (skippedPlacements.length) {
        addWarningToast(
          tn(
            'Restored %s; %s widget no longer exists or is no longer yours to place, so it was left out.',
            'Restored %s; %s widgets no longer exist or are no longer yours to place, so they were left out.',
            skippedPlacements.length,
            versionLabel(version),
            skippedPlacements.length,
          ),
        );
      } else {
        addSuccessToast(t('Restored %s', versionLabel(version)));
      }
      setConfirming(false);
    } catch (response) {
      const error = await getClientErrorObject(response);
      addDangerToast(error.message || error.error || t('Something went wrong'));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <Alert
        type="info"
        showIcon
        data-test="canvas-version-preview"
        message={t('Viewing %s', label)}
        description={describeCanvasVersion(version)}
        action={
          <Space>
            <Button
              buttonStyle="primary"
              buttonSize="small"
              onClick={() => setConfirming(true)}
            >
              {t('Restore this version')}
            </Button>
            <Button buttonSize="small" onClick={onClose}>
              {t('Back to current')}
            </Button>
          </Space>
        }
      />
      {confirming && (
        <Modal
          show
          onHide={() => setConfirming(false)}
          title={t('Restore this version?')}
          width="480px"
          responsive={false}
          primaryButtonName={t('Restore this version')}
          primaryButtonLoading={restoring}
          onHandledPrimaryAction={restore}
          name="restore-canvas-version-modal"
        >
          <p>{t('The canvas will be restored to %s.', label)}</p>
          <p>
            {t(
              'Restoring saves a new version, so no history is lost. Drafts started before the restore can no longer be published.',
            )}
          </p>
        </Modal>
      )}
    </>
  );
}
