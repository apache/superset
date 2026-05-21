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
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import {
  addDangerToast,
  addSuccessToast,
} from 'src/components/MessageToasts/actions';
import type { RootState } from 'src/dashboard/types';
import { exitVersionPreview } from 'src/dashboard/actions/dashboardState';
import PreviewBanner from '../components/PreviewBanner';
import RestoreConfirmModal from '../components/RestoreConfirmModal';
import { useOptionalVersionHistory } from '../context/VersionHistoryContext';
import { useVersionList } from '../hooks/useVersionList';
import { useRestoreVersion } from '../hooks/useRestoreVersion';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import { formatVersionDate } from '../utils/formatVersionUser';

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
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!isFeatureEnabled(FeatureFlag.VersionHistory)) return null;
  if (!versionPreview) return null;

  const { versionUuid } = versionPreview;
  const matched = versions?.find(v => v.version_uuid === versionUuid);
  const summary = matched
    ? formatChangeTitle(matched.changes)
    : t('Historical version');
  const date = matched ? formatVersionDate(matched.issued_at) : '';

  const handleExit = () => {
    ctx?.exitPreview();
    dispatch(exitVersionPreview());
  };

  const handleConfirmRestore = async () => {
    const ok = await restore(versionUuid);
    if (ok) {
      dispatch(addSuccessToast(t('Restored to "%(summary)s"', { summary })));
      setConfirmOpen(false);
      handleExit();
      // Reload so the dashboard hydrate runs against the restored backend
      // state — our Redux sliceEntities + dashboardLayout still hold the
      // pre-restore values.
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } else {
      dispatch(addDangerToast(t('Failed to restore version')));
    }
  };

  return (
    <>
      <PreviewBanner
        summary={summary}
        date={date}
        onRestore={() => setConfirmOpen(true)}
        onExit={handleExit}
        restoring={restoring}
      />
      <RestoreConfirmModal
        open={confirmOpen}
        entityType="dashboard"
        summary={summary}
        date={date}
        restoring={restoring}
        onConfirm={handleConfirmRestore}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};

export default DashboardPreviewBanner;
