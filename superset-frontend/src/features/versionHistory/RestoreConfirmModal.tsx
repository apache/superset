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
import { t, tn } from '@apache-superset/core/translation';
import { Modal } from '@superset-ui/core/components';
import type { VersionedEntityType } from './types';
import type { VersionActionTarget } from './useVersionActions';
import { formatVersionDateTime } from './display';
import { fetchDashboardRestoreRemovalCount } from './api';

export interface RestoreConfirmModalProps {
  entityType: VersionedEntityType;
  entityUuid?: string;
  target: VersionActionTarget | null;
  isRestoring: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function RestoreConfirmModal({
  entityType,
  entityUuid,
  target,
  isRestoring,
  onCancel,
  onConfirm,
}: RestoreConfirmModalProps) {
  const versionUuid = target?.versionUuid;
  const requestKey = `${entityUuid}/${versionUuid}`;
  const [impact, setImpact] = useState<{
    key: string;
    count: number | null;
  } | null>(null);
  const needsImpact =
    entityType === 'dashboard' && !!entityUuid && !!versionUuid;
  const isChecking = needsImpact && impact?.key !== requestKey;
  useEffect(() => {
    if (!needsImpact || !entityUuid || !versionUuid) {
      setImpact(null);
      return undefined;
    }
    let active = true;
    fetchDashboardRestoreRemovalCount(entityUuid, versionUuid).then(
      count => {
        if (active) setImpact({ key: requestKey, count });
      },
      () => {
        if (active) setImpact({ key: requestKey, count: null });
      },
    );
    return () => {
      active = false;
    };
  }, [entityUuid, versionUuid, needsImpact, requestKey]);
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
      disablePrimaryButton={isChecking}
      onHandledPrimaryAction={onConfirm}
      name="restore-version-modal"
    >
      <p>
        {entityType === 'chart'
          ? t('This chart will be restored to the following version:')
          : t('This dashboard will be restored to the following version:')}
      </p>
      {isChecking && <p>{t('Checking which charts will be removed…')}</p>}
      {needsImpact && !isChecking && impact?.count === null && (
        <p role="alert">
          {t(
            'Could not check which charts will be removed. Restoring may remove charts added after this version.',
          )}
        </p>
      )}
      {needsImpact &&
        !isChecking &&
        impact?.count != null &&
        impact.count > 0 && (
          <p role="alert">
            {tn(
              'Restoring will remove %s chart added after this version from this dashboard. The chart itself will not be deleted.',
              'Restoring will remove %s charts added after this version from this dashboard. The charts themselves will not be deleted.',
              impact.count,
              impact.count,
            )}
          </p>
        )}
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
