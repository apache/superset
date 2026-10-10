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
import { t } from '@apache-superset/core/translation';
import { Modal } from '@superset-ui/core/components';
import type { VersionedEntityType } from './types';
import type { VersionActionTarget } from './useVersionActions';
import { formatVersionDateTime } from './display';

export interface RestoreConfirmModalProps {
  entityType: VersionedEntityType;
  target: VersionActionTarget | null;
  isRestoring: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function RestoreConfirmModal({
  entityType,
  target,
  isRestoring,
  onCancel,
  onConfirm,
}: RestoreConfirmModalProps) {
  if (!target) {
    return null;
  }
  const dateLabel = formatVersionDateTime(target.issuedAt);
  return (
    <Modal
      show
      onHide={onCancel}
      title={t('Restore this version?')}
      width="480px"
      responsive={false}
      primaryButtonName={t('Restore this version')}
      primaryButtonLoading={isRestoring}
      onHandledPrimaryAction={onConfirm}
      name="restore-version-modal"
    >
      <p>
        {entityType === 'chart'
          ? t('This chart will be restored to the following version:')
          : t('This dashboard will be restored to the following version:')}
      </p>
      <p data-test="restore-version-name">
        <strong>{target.headline}</strong>
        {dateLabel !== target.headline && <> · {dateLabel}</>}
      </p>
      <p>
        {t(
          'Restoring creates a new version. Your existing version history will not be lost.',
        )}
      </p>
    </Modal>
  );
}
