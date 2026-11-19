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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch, useAppSelector } from 'src/views/store';
import { useDebounceValue } from 'src/hooks/useDebounceValue';
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
  clearVersionPreview,
  closeVersionHistoryPanel,
  openVersionHistoryPanel,
  selectIsVersionHistoryPanelOpen,
  selectVersionHistoryInclude,
  selectVersionPreview,
  selectVersionLastRestoredUuid,
  selectVersionRestoreCount,
  setVersionHistoryInclude,
  setVersionPreview,
} from './reducer';
import { selectCanRestoreDashboard } from './canRestoreDashboard';
import { openRelatedEntity } from './openRelated';
import { useVersionActivity } from './useVersionActivity';
import { useVersionActions } from './useVersionActions';
import { useDashboardVersionPreview } from './useDashboardVersionPreview';
import { groupHeadline } from './display';
import VersionHistoryPanel from './VersionHistoryPanel';

export default function DashboardVersionHistory() {
  const dispatch = useAppDispatch();
  const { addDangerToast } = useToasts();
  const uuid = useSelector<RootState, string | undefined>(
    state => state.dashboardInfo?.uuid,
  );
  const canRestore = useSelector(selectCanRestoreDashboard);
  const isPanelOpen = useSelector(selectIsVersionHistoryPanelOpen);
  const include = useSelector(selectVersionHistoryInclude);
  const preview = useSelector(selectVersionPreview);
  const hasUnsavedChanges = useSelector<RootState, boolean>(
    state => !!state.dashboardState?.hasUnsavedChanges,
  );
  // Dashboard edits are tracked coarsely (no per-control log like
  // explore): a single "unsaved edits" entry while edit mode is dirty.
  // The timestamp is captured when the dashboard first turns dirty —
  // stamping it during render would drift on every re-render.
  const [dirtySince, setDirtySince] = useState<number | null>(null);
  useEffect(() => {
    if (hasUnsavedChanges) {
      setDirtySince(current => current ?? Date.now());
    } else {
      setDirtySince(null);
    }
  }, [hasUnsavedChanges]);
  const sessionEntries = useMemo<SessionLogEntry[]>(
    () =>
      hasUnsavedChanges && dirtySince !== null
        ? [
            {
              label: t('Unsaved dashboard edits'),
              controlName: 'dashboard',
              ts: dirtySince,
              user: null,
            },
          ]
        : [],
    [dirtySince, hasUnsavedChanges],
  );

  // The URL param is honoured once per mount. It persists for the whole
  // visit, and this effect re-runs whenever `canRestore` moves — a late
  // false→true flip (dashboardInfo refetch after a properties save) would
  // otherwise re-open a panel the user explicitly closed.
  const urlParamHandledRef = useRef(false);
  useEffect(() => {
    // Match the menu entry's gating: version history is only offered to
    // users who could restore (sc-107604) — the URL param must not open
    // it for read-only viewers.
    if (
      !urlParamHandledRef.current &&
      getUrlParam(URL_PARAMS.versionHistory) &&
      canRestore
    ) {
      urlParamHandledRef.current = true;
      dispatch(openVersionHistoryPanel('dashboard'));
    }
  }, [canRestore, dispatch]);

  // Leaving the page should not carry panel/preview state to other pages.
  useEffect(
    () => () => {
      dispatch(closeVersionHistoryPanel());
    },
    [dispatch],
  );

  // Server-side search over the full history; debounce so each keystroke
  // doesn't refetch.
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounceValue(searchTerm);
  const activity = useVersionActivity(
    'dashboard',
    isPanelOpen ? uuid : undefined,
    include,
    debouncedSearch,
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
  const lastRestoredUuid = useSelector(selectVersionLastRestoredUuid);
  // Only successful writes bump these revisions. Timestamps also change for
  // local metadata edits and may repeat across multiple saves in one second.
  const saveRevision = useAppSelector(state =>
    [
      state.dashboardState?.versionHistoryRevision ?? 0,
      state.dashboardInfo?.versionHistoryRevision ?? 0,
    ].join('|'),
  );
  const lastSaveRevisionRef = useRef(saveRevision);
  const lastSaveUuidRef = useRef(uuid);
  const lastRestoreCountRef = useRef(restoreCount);
  const refreshActivity = activity.refresh;
  useEffect(() => {
    const saved =
      uuid === lastSaveUuidRef.current &&
      saveRevision !== lastSaveRevisionRef.current;
    lastSaveRevisionRef.current = saveRevision;
    lastSaveUuidRef.current = uuid;
    if (restoreCount !== lastRestoreCountRef.current) {
      lastRestoreCountRef.current = restoreCount;
      if (lastRestoredUuid === uuid) {
        // The restore refresh covers any simultaneous save signal.
        refreshActivity();
        return;
      }
    }
    if (saved) {
      refreshActivity();
    }
  }, [lastRestoredUuid, refreshActivity, restoreCount, saveRevision, uuid]);

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
      if (hasUnsavedChanges) {
        // Previewing rehydrates the whole dashboard state, which would
        // silently wipe in-progress edit-mode work and its undo history.
        addDangerToast(
          t('Save or discard your unsaved changes to preview a version.'),
        );
        return;
      }
      dispatch(
        setVersionPreview({
          entityUuid: uuid,
          versionUuid: group.versionUuid,
          transactionId: group.transactionId,
          headline: groupHeadline(group),
          issuedAt: group.issuedAt,
        }),
      );
    },
    [addDangerToast, dispatch, hasUnsavedChanges, uuid],
  );

  const handleExitPreview = useCallback(() => {
    dispatch(clearVersionPreview(uuid));
  }, [dispatch, uuid]);

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
          headline: groupHeadline(group),
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
          headline: groupHeadline(group),
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
        canRestore={canRestore}
        activity={activity}
        include={include}
        onIncludeChange={handleIncludeChange}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        previewedTransactionId={preview?.transactionId ?? null}
        onClose={handleClose}
        onPreview={handlePreview}
        onExitPreview={handleExitPreview}
        onRestore={handleRestore}
        onOpenAsNew={handleOpenAsNew}
        onOpenRelated={handleOpenRelated}
        sessionEntries={sessionEntries}
      />
      {restoreModal}
    </>
  );
}
