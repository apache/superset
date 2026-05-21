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
import { useCallback, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { css } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Drawer } from '@superset-ui/core/components';
import {
  addDangerToast,
  addSuccessToast,
} from 'src/components/MessageToasts/actions';
import { useVersionHistory } from '../context/VersionHistoryContext';
import { useVersionList } from '../hooks/useVersionList';
import { useRestoreVersion } from '../hooks/useRestoreVersion';
import { EntityType, Version } from '../types';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import { formatVersionDate } from '../utils/formatVersionUser';
import VersionList from './VersionList';
import RestoreConfirmModal from './RestoreConfirmModal';

interface Props {
  entityType: EntityType;
  uuid: string | null | undefined;
  onOpenAsNew?: (version: Version) => void;
}

// Z-index high enough to sit above sticky page headers and chart canvases
// but below toast notifications (which render at the antd default 1010+).
const DRAWER_Z_INDEX = 1000;

const VersionHistoryPanel = ({ entityType, uuid, onOpenAsNew }: Props) => {
  const {
    isPanelOpen,
    closePanel,
    previewVersionUuid,
    enterPreview,
    exitPreview,
  } = useVersionHistory();
  const dispatch = useDispatch();
  const { versions, loading, error } = useVersionList(entityType, uuid);
  const { restore, restoring, lastError } = useRestoreVersion(entityType, uuid);
  const [pendingRestore, setPendingRestore] = useState<Version | null>(null);

  const handleSelect = useCallback(
    (versionUuid: string) => {
      // First row is the live version — clicking it exits preview mode.
      if (versions && versions[0]?.version_uuid === versionUuid) {
        exitPreview();
        return;
      }
      enterPreview(versionUuid);
    },
    [enterPreview, exitPreview, versions],
  );

  const handleRestore = useCallback(
    (version: Version) => setPendingRestore(version),
    [],
  );

  const confirmRestore = useCallback(async () => {
    if (!pendingRestore) return;
    const ok = await restore(pendingRestore.version_uuid);
    if (ok) {
      dispatch(
        addSuccessToast(
          t('Restored to "%(summary)s"', {
            summary: formatChangeTitle(pendingRestore.changes),
          }),
        ),
      );
      setPendingRestore(null);
      exitPreview();
      // Reload so the in-memory chart/dashboard reflects the new live state
      // — the restore endpoint mutates the backend record but our Redux
      // entity slice still holds the pre-restore data.
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } else {
      dispatch(
        addDangerToast(
          lastError
            ? t('Failed to restore version: %(detail)s', { detail: lastError })
            : t('Failed to restore version'),
        ),
      );
    }
  }, [dispatch, exitPreview, lastError, pendingRestore, restore]);

  const restoreContext = useMemo(() => {
    if (!pendingRestore) return null;
    return {
      summary: formatChangeTitle(pendingRestore.changes),
      date: formatVersionDate(pendingRestore.issued_at),
    };
  }, [pendingRestore]);

  return (
    <>
      <Drawer
        title={t('Version history')}
        placement="right"
        open={isPanelOpen}
        onClose={closePanel}
        width={380}
        zIndex={DRAWER_Z_INDEX}
        styles={{ body: { padding: 0 } }}
        destroyOnHidden
        data-test="version-history-panel"
      >
        <div
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
          `}
        >
          <VersionList
            versions={versions}
            loading={loading}
            error={error}
            selectedVersionUuid={previewVersionUuid}
            onSelect={handleSelect}
            onRestore={handleRestore}
            onOpenAsNew={onOpenAsNew}
          />
        </div>
      </Drawer>
      <RestoreConfirmModal
        open={!!pendingRestore}
        entityType={entityType}
        summary={restoreContext?.summary ?? ''}
        date={restoreContext?.date ?? ''}
        restoring={restoring}
        onConfirm={confirmRestore}
        onCancel={() => setPendingRestore(null)}
      />
    </>
  );
};

export default VersionHistoryPanel;
