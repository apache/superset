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
import { ReactElement, useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { VersionedEntityType } from './types';
import {
  createChartFromSnapshot,
  createDashboardFromSnapshot,
  fetchVersionSnapshot,
  restoreVersion,
} from './api';
import { clearVersionPreview, versionRestored } from './reducer';
import { formatVersionMonthDay } from './display';
import RestoreConfirmModal from './RestoreConfirmModal';

/** The version a restore / open-as-new action operates on. */
export interface VersionActionTarget {
  versionUuid: string;
  headline: string;
  issuedAt: string;
}

export interface UseVersionActionsResult {
  /** Opens the restore confirmation modal for the given version. */
  requestRestore: (target: VersionActionTarget) => void;
  /** Forks the given version into a new chart/dashboard in a new tab. */
  openAsNew: (target: VersionActionTarget) => void;
  /** Render this alongside the calling component. */
  restoreModal: ReactElement | null;
}

/**
 * Restore and open-as-new flows shared by the panel kebabs and the
 * preview banner. Restore success is broadcast via the redux
 * `restoreCount` so page-level hooks can rehydrate and refresh activity.
 */
export function useVersionActions(
  entityType: VersionedEntityType,
  uuid: string | undefined,
): UseVersionActionsResult {
  const dispatch = useDispatch();
  const { addSuccessToast, addDangerToast } = useToasts();
  const [restoreTarget, setRestoreTarget] =
    useState<VersionActionTarget | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const requestRestore = useCallback((target: VersionActionTarget) => {
    setRestoreTarget(target);
  }, []);

  const cancelRestore = useCallback(() => {
    setRestoreTarget(null);
  }, []);

  const confirmRestore = useCallback(async () => {
    if (!restoreTarget || !uuid || isRestoring) {
      return;
    }
    setIsRestoring(true);
    try {
      await restoreVersion(entityType, uuid, restoreTarget.versionUuid);
      addSuccessToast(t("Restored to '%s' version", restoreTarget.headline));
      setRestoreTarget(null);
      dispatch(clearVersionPreview());
      dispatch(versionRestored());
    } catch {
      addDangerToast(t('Failed to restore %s', restoreTarget.headline));
    } finally {
      setIsRestoring(false);
    }
  }, [
    addDangerToast,
    addSuccessToast,
    dispatch,
    entityType,
    isRestoring,
    restoreTarget,
    uuid,
  ]);

  const openAsNew = useCallback(
    async (target: VersionActionTarget) => {
      if (!uuid) {
        return;
      }
      const copyDate = formatVersionMonthDay(target.issuedAt);
      try {
        if (entityType === 'chart') {
          const snapshot = await fetchVersionSnapshot(
            'chart',
            uuid,
            target.versionUuid,
          );
          const id = await createChartFromSnapshot(
            snapshot,
            t('%s (copy from %s)', snapshot.slice_name, copyDate),
          );
          window.open(`/explore/?slice_id=${id}`, '_blank', 'noopener');
        } else {
          const snapshot = await fetchVersionSnapshot(
            'dashboard',
            uuid,
            target.versionUuid,
          );
          const id = await createDashboardFromSnapshot(
            snapshot,
            t('%s (copy from %s)', snapshot.dashboard_title, copyDate),
          );
          window.open(`/superset/dashboard/${id}/`, '_blank', 'noopener');
        }
        addSuccessToast(t('Created from version: %s', target.headline));
      } catch {
        addDangerToast(
          entityType === 'chart'
            ? t('Failed to create a new chart from this version')
            : t('Failed to create a new dashboard from this version'),
        );
      }
    },
    [addDangerToast, addSuccessToast, entityType, uuid],
  );

  const restoreModal = (
    <RestoreConfirmModal
      entityType={entityType}
      target={restoreTarget}
      isRestoring={isRestoring}
      onCancel={cancelRestore}
      onConfirm={confirmRestore}
    />
  );

  return { requestRestore, openAsNew, restoreModal };
}
