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
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import type { RootState } from 'src/dashboard/types';
import type {
  ActivityInclude,
  ActivityRecord,
  SaveGroup,
  SessionLogEntry,
} from './types';
import {
  closeVersionHistoryPanel,
  openVersionHistoryPanel,
  selectIsVersionHistoryPanelOpen,
  selectVersionHistoryInclude,
  selectVersionPreview,
  selectVersionRestoreCount,
  setVersionHistoryInclude,
  setVersionPreview,
} from './reducer';
import { openRelatedEntity } from './openRelated';
import { useVersionActivity } from './useVersionActivity';
import { useVersionActions } from './useVersionActions';
import { useDashboardVersionPreview } from './useDashboardVersionPreview';
import { groupHeadline } from './display';
import VersionHistoryPanel from './VersionHistoryPanel';

export default function DashboardVersionHistory() {
  const dispatch = useDispatch();
  const { addDangerToast } = useToasts();
  const uuid = useSelector<RootState, string | undefined>(
    state => state.dashboardInfo?.uuid,
  );
  const isPanelOpen = useSelector(selectIsVersionHistoryPanelOpen);
  const include = useSelector(selectVersionHistoryInclude);
  const preview = useSelector(selectVersionPreview);
  const hasUnsavedChanges = useSelector<RootState, boolean>(
    state => !!state.dashboardState?.hasUnsavedChanges,
  );
  // Dashboard edits are tracked coarsely (no per-control log like
  // explore): a single "unsaved edits" entry while edit mode is dirty.
  const sessionEntries = useMemo<SessionLogEntry[]>(
    () =>
      hasUnsavedChanges
        ? [
            {
              label: t('Unsaved dashboard edits'),
              controlName: 'dashboard',
              ts: Date.now(),
              user: null,
            },
          ]
        : [],
    [hasUnsavedChanges],
  );

  useEffect(() => {
    if (getUrlParam(URL_PARAMS.versionHistory)) {
      dispatch(openVersionHistoryPanel('dashboard'));
    }
  }, [dispatch]);

  // Leaving the page should not carry panel/preview state to other pages.
  useEffect(
    () => () => {
      dispatch(closeVersionHistoryPanel());
    },
    [dispatch],
  );

  const activity = useVersionActivity(
    'dashboard',
    isPanelOpen ? uuid : undefined,
    include,
  );

  useDashboardVersionPreview(uuid);

  const { requestRestore, openAsNew, restoreModal } = useVersionActions(
    'dashboard',
    uuid,
  );

  // Page rehydration after a restore happens in useDashboardVersionPreview;
  // here only the activity timeline needs a refresh so the new
  // "Restored version" entry shows up.
  const restoreCount = useSelector(selectVersionRestoreCount);
  const lastRestoreCountRef = useRef(restoreCount);
  const refreshActivity = activity.refresh;
  useEffect(() => {
    if (restoreCount !== lastRestoreCountRef.current) {
      lastRestoreCountRef.current = restoreCount;
      refreshActivity();
    }
  }, [refreshActivity, restoreCount]);

  const handleClose = useCallback(() => {
    dispatch(closeVersionHistoryPanel());
  }, [dispatch]);

  const handleIncludeChange = useCallback(
    (value: ActivityInclude) => {
      dispatch(setVersionHistoryInclude(value));
    },
    [dispatch],
  );

  const handlePreview = useCallback(
    (group: SaveGroup) => {
      if (!group.versionUuid || !uuid) {
        return;
      }
      dispatch(
        setVersionPreview({
          entityUuid: uuid,
          versionUuid: group.versionUuid,
          transactionId: group.transactionId,
          headline: groupHeadline('dashboard', group),
          issuedAt: group.issuedAt,
        }),
      );
    },
    [dispatch, uuid],
  );

  const handleOpenRelated = useCallback(
    (record: ActivityRecord) => {
      openRelatedEntity(record, addDangerToast);
    },
    [addDangerToast],
  );

  const handleRestore = useCallback(
    (group: SaveGroup) => {
      if (group.versionUuid) {
        requestRestore({
          versionUuid: group.versionUuid,
          headline: groupHeadline('dashboard', group),
          issuedAt: group.issuedAt,
        });
      }
    },
    [requestRestore],
  );

  const handleOpenAsNew = useCallback(
    (group: SaveGroup) => {
      if (group.versionUuid) {
        openAsNew({
          versionUuid: group.versionUuid,
          headline: groupHeadline('dashboard', group),
          issuedAt: group.issuedAt,
        });
      }
    },
    [openAsNew],
  );

  if (!isPanelOpen) {
    return restoreModal;
  }

  return (
    <>
      <VersionHistoryPanel
        entityType="dashboard"
        activity={activity}
        include={include}
        onIncludeChange={handleIncludeChange}
        previewedTransactionId={preview?.transactionId ?? null}
        onClose={handleClose}
        onPreview={handlePreview}
        onRestore={handleRestore}
        onOpenAsNew={handleOpenAsNew}
        onOpenRelated={handleOpenRelated}
        sessionEntries={sessionEntries}
      />
      {restoreModal}
    </>
  );
}
