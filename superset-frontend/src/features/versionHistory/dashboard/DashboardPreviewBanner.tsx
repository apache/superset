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
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import {
  addDangerToast,
  addSuccessToast,
} from 'src/components/MessageToasts/actions';
import type { RootState } from 'src/dashboard/types';
import PreviewBanner from '../components/PreviewBanner';
import RestoreConfirmModal from '../components/RestoreConfirmModal';
import { useOptionalVersionHistory } from '../context/VersionHistoryContext';
import { useForkVersion } from '../hooks/useForkVersion';
import { useVersionList } from '../hooks/useVersionList';
import { useRestoreVersion } from '../hooks/useRestoreVersion';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import { formatVersionDate } from '../utils/formatVersionUser';
import { reloadStrippingVersionUuid } from '../utils/restoreReload';

/**
 * Renders above the dashboard grid while a historical version preview is
 * active. Reads ``dashboardState.versionPreview`` so it appears regardless of
 * the surrounding mount path. Bails out cheap when the feature flag is off.
 */
const DashboardPreviewBanner = () => {
  const dispatch = useDispatch();
  const ctx = useOptionalVersionHistory();
  const versionPreview = useSelector(
    (state: RootState) => state.dashboardState.versionPreview ?? null,
  );
  const dashboardUuid = useSelector(
    (state: RootState) => state.dashboardInfo?.uuid ?? null,
  );
  const { versions } = useVersionList('dashboard', dashboardUuid);
  const { restore, restoring } = useRestoreVersion('dashboard', dashboardUuid);
  const forkVersion = useForkVersion('dashboard', dashboardUuid);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Has the user accumulated live, unsaved edits before opening preview?
  // The dashboardState flag captures this for the dashboard side; we only
  // surface the warning when restore would actually destroy something.
  const hasUnsavedChanges = useSelector(
    (state: RootState) => !!state.dashboardState?.hasUnsavedChanges,
  );

  // Gating relies on ``versionPreview`` being non-null, which is only ever
  // set by the version-history bridge — itself mounted only when the flag
  // is on. No need to re-check the flag here.
  if (!versionPreview) return null;

  const { versionUuid } = versionPreview;
  const matched = versions?.find(v => v.version_uuid === versionUuid);
  const summary = matched
    ? formatChangeTitle(matched.changes)
    : t('Historical version');
  const date = matched ? formatVersionDate(matched.issued_at) : '';

  // Clearing the preview UUID on the context triggers the
  // DashboardPreviewBridge's effect to dispatch exitVersionPreview. Doing
  // it here too would double-dispatch (the reducer no-ops on the second
  // hit, but we keep cleanup in one place).
  const handleExit = () => {
    ctx?.exitPreview();
  };

  const handleConfirmRestore = async () => {
    const { ok, error } = await restore(versionUuid);
    if (ok) {
      dispatch(
        addSuccessToast(t("Restored to '%(summary)s' version", { summary })),
      );
      setConfirmOpen(false);
      handleExit();
      // Reload so the dashboard hydrate runs against the restored backend
      // state — our Redux sliceEntities + dashboardLayout still hold the
      // pre-restore values. Strip ``?version_uuid`` first so the reloaded
      // page does not re-enter preview of the version just restored.
      reloadStrippingVersionUuid();
    } else {
      dispatch(
        addDangerToast(
          error
            ? t('Failed to restore version: %(detail)s', { detail: error })
            : t('Failed to restore version'),
        ),
      );
    }
  };

  return (
    <>
      <PreviewBanner
        entityType="dashboard"
        summary={summary}
        date={date}
        onRestore={() => setConfirmOpen(true)}
        onExit={handleExit}
        onOpenAsNew={matched ? () => forkVersion(matched) : undefined}
        restoring={restoring}
      />
      <RestoreConfirmModal
        open={confirmOpen}
        entityType="dashboard"
        summary={summary}
        date={date}
        restoring={restoring}
        hasUnsavedChanges={hasUnsavedChanges}
        onConfirm={handleConfirmRestore}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};

export default DashboardPreviewBanner;
