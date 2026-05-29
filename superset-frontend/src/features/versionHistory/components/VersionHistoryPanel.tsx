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
import { Drawer, Icons } from '@superset-ui/core/components';
import { useTheme } from '@apache-superset/core/theme';
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
import { reloadStrippingVersionUuid } from '../utils/restoreReload';
import VersionList from './VersionList';
import RestoreConfirmModal from './RestoreConfirmModal';

interface Props {
  entityType: EntityType;
  uuid: string | null | undefined;
  hasUnsavedChanges?: boolean;
  onOpenAsNew?: (version: Version) => void;
}

// Z-index high enough to sit above sticky page headers and chart canvases
// but below toast notifications (which render at the antd default 1010+).
const DRAWER_Z_INDEX = 1000;
// Exported so the preview banner can reserve matching right-padding while
// the drawer is open — otherwise the drawer covers the banner's
// restore/exit buttons.
export const DRAWER_WIDTH = 380;

const VersionHistoryPanel = ({
  entityType,
  uuid,
  hasUnsavedChanges,
  onOpenAsNew,
}: Props) => {
  const {
    isPanelOpen,
    closePanel,
    previewVersionUuid,
    enterPreview,
    exitPreview,
  } = useVersionHistory();
  const dispatch = useDispatch();
  // Defer the list fetch until the panel actually opens — every chart and
  // dashboard page render mounts this component, but most visits never
  // open the drawer. Once opened, ``hasFetched`` stays true so subsequent
  // closes don't drop the cached list.
  const [hasFetched, setHasFetched] = useState(false);
  if (isPanelOpen && !hasFetched) {
    setHasFetched(true);
  }
  const { versions, loading, error } = useVersionList(
    entityType,
    hasFetched ? uuid : null,
  );
  const { restore, restoring } = useRestoreVersion(entityType, uuid);
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
    const { ok, error } = await restore(pendingRestore.version_uuid);
    if (ok) {
      dispatch(
        addSuccessToast(
          t("Restored to '%(summary)s' version", {
            summary: formatChangeTitle(pendingRestore.changes),
          }),
        ),
      );
      setPendingRestore(null);
      exitPreview();
      // Reload so the in-memory chart/dashboard reflects the new live state
      // — the restore endpoint mutates the backend record but our Redux
      // entity slice still holds the pre-restore data. Strip
      // ``?version_uuid`` first so the reloaded page does not re-enter
      // preview of the version just restored.
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
  }, [dispatch, exitPreview, pendingRestore, restore]);

  const theme = useTheme();

  // Custom title with a back-arrow that mirrors the antd Drawer's
  // built-in close button so users have two consistent ways to dismiss
  // the panel.
  const drawerTitle = (
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit * 2}px;
      `}
    >
      <button
        type="button"
        aria-label={t('Back')}
        onClick={closePanel}
        data-test="version-history-back"
        css={css`
          display: inline-flex;
          align-items: center;
          padding: ${theme.sizeUnit}px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: ${theme.colorIcon};
          &:hover {
            color: ${theme.colorIconHover};
          }
        `}
      >
        <Icons.LeftOutlined iconSize="m" />
      </button>
      <span>{t('Version history')}</span>
    </div>
  );

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
        title={drawerTitle}
        placement="right"
        open={isPanelOpen}
        onClose={closePanel}
        width={DRAWER_WIDTH}
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
            entityType={entityType}
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
        hasUnsavedChanges={hasUnsavedChanges}
        onConfirm={confirmRestore}
        onCancel={() => setPendingRestore(null)}
      />
    </>
  );
};

export default VersionHistoryPanel;
