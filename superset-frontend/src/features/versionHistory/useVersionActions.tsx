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
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
import {
  clearVersionPreview,
  selectVersionSessionLog,
  versionRestored,
  type VersionHistoryRootState,
} from './reducer';
import { formatVersionMonthDay } from './display';
import RestoreConfirmModal from './RestoreConfirmModal';

/** The version a restore / open-as-new action operates on. */
export interface VersionActionTarget {
  versionUuid: string;
  headline: string;
  issuedAt: string;
}

// The in-flight locks live at module scope because the invariant they
// protect is entity-wide, not instance-wide: the preview banner and the
// history panel each mount their own useVersionActions for the same
// entity, so a ref-scoped lock would let the banner's activation slip
// past the panel's and fork a duplicate (or start a second restore).
// State guards alone are no lock at all — two activations in one tick
// both read the pre-update state value. Keys are removed in `finally`,
// so the set is self-cleaning; the per-instance isRestoring/isCreating
// state remains only to drive that instance's spinner.
const inFlightActions = new Set<string>();

const restoreLockKey = (entityType: string, uuid: string): string =>
  `restore:${entityType}:${uuid}`;
const forkLockKey = (
  entityType: string,
  uuid: string,
  versionUuid: string,
): string => `fork:${entityType}:${uuid}:${versionUuid}`;

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

  // A restore rehydrates the page from the server, which silently wipes
  // in-progress edits and their undo history — the same hazard the preview
  // entry gate guards against. The dirty signal is page-specific: dashboards
  // track hasUnsavedChanges; explore's signal is the session log, which lists
  // exactly the unsaved control changes the panel shows under "Current
  // version". Read here rather than passed in, so no call site (panel kebab,
  // preview banner) can forget it.
  const hasUnsavedChanges = useSelector<
    VersionHistoryRootState & {
      dashboardState?: { hasUnsavedChanges?: boolean };
    },
    boolean
  >(state =>
    entityType === 'dashboard'
      ? !!state.dashboardState?.hasUnsavedChanges
      : selectVersionSessionLog(state).length > 0,
  );

  // A pending confirmation names a version of the entity it was opened for.
  // If the page's entity changes underneath it (an in-place slice swap), the
  // modal must not survive to combine the new uuid with the old version —
  // the server would refuse the mismatch, but the user would be shown a
  // confusing failure for an action they aimed at something else.
  useEffect(() => {
    setRestoreTarget(null);
  }, [entityType, uuid]);

  const requestRestore = useCallback(
    (target: VersionActionTarget) => {
      if (hasUnsavedChanges) {
        addDangerToast(
          t('Save or discard your unsaved changes to restore a version.'),
        );
        return;
      }
      setRestoreTarget(target);
    },
    [addDangerToast, hasUnsavedChanges],
  );

  const cancelRestore = useCallback(() => {
    setRestoreTarget(null);
  }, []);

  // TODO(version-history): backend workaround — remove when the restore
  // endpoint reports whether it created a version (e.g. `created: boolean`
  // in its response). The endpoint reports success but not whether a new
  // version transaction was created (restoring an already-matching state
  // is a server-side no-op); probe the newest self transaction to tell the
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
    if (!restoreTarget || !uuid) {
      return;
    }
    // Entity-wide, not per-version: two concurrent restores to different
    // versions of the same entity would race each other's rehydration.
    const lockKey = restoreLockKey(entityType, uuid);
    if (inFlightActions.has(lockKey)) {
      return;
    }
    if (hasUnsavedChanges) {
      // The request-time gate can be outrun: work turning dirty while the
      // confirmation modal sits open (an in-flight edit resolving late)
      // would still be wiped by the rehydration. Re-check at the moment of
      // mutation.
      addDangerToast(
        t('Save or discard your unsaved changes to restore a version.'),
      );
      setRestoreTarget(null);
      return;
    }
    inFlightActions.add(lockKey);
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
      dispatch(clearVersionPreview(uuid));
      dispatch(versionRestored(uuid));
    } catch (error) {
      const { error: errMsg } = await getClientErrorObject(error);
      addDangerToast(
        errMsg
          ? t('Failed to restore %s: %s', restoreTarget.headline, errMsg)
          : t('Failed to restore %s', restoreTarget.headline),
      );
    } finally {
      inFlightActions.delete(lockKey);
      setIsRestoring(false);
    }
  }, [
    addDangerToast,
    addInfoToast,
    addSuccessToast,
    addWarningToast,
    dispatch,
    entityType,
    hasUnsavedChanges,
    latestTransactionId,
    restoreTarget,
    uuid,
  ]);

  const openAsNew = useCallback(
    async (target: VersionActionTarget) => {
      if (!uuid) {
        return;
      }
      // Forking awaits several requests, and a double activation — same
      // button twice, or the banner's button plus the panel kebab — would
      // create two copies. Per-version key: forking two different versions
      // concurrently is legitimate.
      const lockKey = forkLockKey(entityType, uuid, target.versionUuid);
      if (inFlightActions.has(lockKey)) {
        return;
      }
      inFlightActions.add(lockKey);
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
            t(
              '%s (copy from %s)',
              snapshot.slice_name ?? t('Untitled chart'),
              copyDate,
            ),
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
            t(
              '%s (copy from %s)',
              snapshot.dashboard_title ?? t('Untitled dashboard'),
              copyDate,
            ),
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
        inFlightActions.delete(lockKey);
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
