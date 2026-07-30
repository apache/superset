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
import { ReactElement, useCallback, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { getClientErrorObject } from '@superset-ui/core';
import {
  closeOpenedTab,
  navigateOpenedTab,
  openBlankTab,
} from 'src/utils/navigationUtils';
import type { VersionedEntityType } from './types';
import {
  createChartFromSnapshot,
  createDashboardFromSnapshot,
  fetchActivity,
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
  /** True while an openAsNew fork is in flight; disable its triggers. */
  isCreating: boolean;
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
  const { addSuccessToast, addInfoToast, addWarningToast, addDangerToast } =
    useToasts();
  const [restoreTarget, setRestoreTarget] =
    useState<VersionActionTarget | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  // The state flags drive rendering; these refs are the actual locks. Two
  // activations in one tick both read the pre-update state value, so a
  // guard on state alone lets the second through and forks a duplicate.
  const restoringRef = useRef(false);
  const creatingRef = useRef(false);

  const requestRestore = useCallback((target: VersionActionTarget) => {
    setRestoreTarget(target);
  }, []);

  const cancelRestore = useCallback(() => {
    setRestoreTarget(null);
  }, []);

  // The restore endpoint reports success but not whether a new version
  // transaction was created (restoring an already-matching state is a
  // server-side no-op); probe the newest self transaction to tell the
  // two apart in the toast. A save by another user landing between the
  // two probes can skew which toast variant shows — accepted, cosmetic.
  const latestTransactionId = useCallback(async (): Promise<number | null> => {
    if (!uuid) {
      return null;
    }
    try {
      const { result } = await fetchActivity(entityType, uuid, {
        include: 'self',
        page: 0,
        pageSize: 1,
      });
      return result[0]?.transaction_id ?? null;
    } catch {
      return null;
    }
  }, [entityType, uuid]);

  const confirmRestore = useCallback(async () => {
    if (!restoreTarget || !uuid || restoringRef.current) {
      return;
    }
    restoringRef.current = true;
    setIsRestoring(true);
    try {
      const beforeTransactionId = await latestTransactionId();
      const { message } = await restoreVersion(
        entityType,
        uuid,
        restoreTarget.versionUuid,
      );
      const afterTransactionId = await latestTransactionId();
      if (
        beforeTransactionId !== null &&
        afterTransactionId !== null &&
        beforeTransactionId === afterTransactionId
      ) {
        addInfoToast(t('Already at this version'));
      } else {
        addSuccessToast(t("Restored to '%s' version", restoreTarget.headline));
      }
      // A restore can succeed while dropping chart associations the snapshot
      // referenced but that no longer exist, and the endpoint says so in its
      // message rather than in a status code. Reporting only the success
      // would tell the user their dashboard came back whole when it did not.
      if (message && message !== 'OK') {
        addWarningToast(message);
      }
      setRestoreTarget(null);
      dispatch(clearVersionPreview());
      dispatch(versionRestored());
    } catch (error) {
      const { error: errMsg } = await getClientErrorObject(error);
      addDangerToast(
        errMsg
          ? t('Failed to restore %s: %s', restoreTarget.headline, errMsg)
          : t('Failed to restore %s', restoreTarget.headline),
      );
    } finally {
      restoringRef.current = false;
      setIsRestoring(false);
    }
  }, [
    addDangerToast,
    addInfoToast,
    addSuccessToast,
    addWarningToast,
    dispatch,
    entityType,
    latestTransactionId,
    restoreTarget,
    uuid,
  ]);

  const openAsNew = useCallback(
    async (target: VersionActionTarget) => {
      // The in-flight guard mirrors isRestoring: forking awaits several
      // requests, and a double activation would create two copies.
      if (!uuid || creatingRef.current) {
        return;
      }
      creatingRef.current = true;
      setIsCreating(true);
      const copyDate = formatVersionMonthDay(target.issuedAt);
      // Claim the tab now, while the click's transient activation is still
      // live; the fork below takes two round trips, by which point the
      // browser would refuse to open one.
      const tab = openBlankTab();
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
          navigateOpenedTab(tab, `/explore/?slice_id=${id}`);
        } else {
          const snapshot = await fetchVersionSnapshot(
            'dashboard',
            uuid,
            target.versionUuid,
          );
          const id = await createDashboardFromSnapshot(
            uuid,
            snapshot,
            t('%s (copy from %s)', snapshot.dashboard_title, copyDate),
          );
          navigateOpenedTab(tab, `/dashboard/${id}/`);
        }
        addSuccessToast(t('Created from version: %s', target.headline));
      } catch (error) {
        // Leaving the claimed tab open would strand the user on about:blank.
        closeOpenedTab(tab);
        const { error: errMsg } = await getClientErrorObject(error);
        const failed =
          entityType === 'chart'
            ? t('Failed to create a new chart from this version')
            : t('Failed to create a new dashboard from this version');
        addDangerToast(errMsg ? `${failed}: ${errMsg}` : failed);
      } finally {
        creatingRef.current = false;
        setIsCreating(false);
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

  return { requestRestore, openAsNew, isCreating, restoreModal };
}
