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
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useActivity } from '../hooks/useActivity';
import { useRestoreVersion } from '../hooks/useRestoreVersion';
import { ActivityInclude, EntityType } from '../types';
import { ActivitySaveRow } from '../utils/groupActivity';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import { formatVersionDate } from '../utils/formatVersionUser';
import { reloadStrippingVersionUuid } from '../utils/restoreReload';
import VersionList from './VersionList';
import RestoreConfirmModal from './RestoreConfirmModal';

interface Props {
  entityType: EntityType;
  uuid: string | null | undefined;
  hasUnsavedChanges?: boolean;
  onOpenAsNew?: (save: ActivitySaveRow) => void;
}

// Z-index high enough to sit above sticky page headers and chart canvases
// but below toast notifications (which render at the antd default 1010+).
const DRAWER_Z_INDEX = 1000;
// Exported so the preview banner can reserve matching right-padding while
// the drawer is open — otherwise the drawer covers the banner's
// restore/exit buttons. 296px matches the Figma reference; the previous
// 380px was a placeholder pre-design review.
export const DRAWER_WIDTH = 296;

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
  //
  // The setState-during-render below is the "derived state" pattern
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes):
  // the conditional guard prevents an infinite loop and React batches the
  // update into the same render, so no extra paint. Do NOT "fix" this with
  // useEffect — that would introduce a flash of un-fetched UI on the same
  // render the drawer first opens.
  const [hasFetched, setHasFetched] = useState(false);
  if (isPanelOpen && !hasFetched) {
    setHasFetched(true);
  }
  const [scopeFilter, setScopeFilter] = useState<ActivityInclude>('all');
  const { records, loading, error } = useActivity(
    entityType,
    hasFetched ? uuid : null,
    { include: scopeFilter },
  );
  const { restore, restoring } = useRestoreVersion(entityType, uuid);
  const [pendingRestore, setPendingRestore] = useState<ActivitySaveRow | null>(
    null,
  );

  // Reset transient panel state when the viewed entity changes — without
  // this the SPA's implicit "unmount on route change" was the only thing
  // keeping stale scope filters / pending-restore modals / cached
  // ``hasFetched`` flags from leaking across navigations. ``VersionList``
  // also gets a fresh ``key`` below so its internal search query resets
  // with us.
  useEffect(() => {
    setScopeFilter('all');
    setPendingRestore(null);
    setHasFetched(false);
  }, [entityType, uuid]);

  // The first self-save is the live version — clicking it exits preview.
  const currentVersionUuid = useMemo(() => {
    if (!records) return null;
    const firstSelf = records.find(r => r.source === 'self');
    return firstSelf?.version_uuid ?? null;
  }, [records]);

  const handleSelect = useCallback(
    (versionUuid: string) => {
      if (currentVersionUuid === versionUuid) {
        exitPreview();
        return;
      }
      enterPreview(versionUuid);
    },
    [currentVersionUuid, enterPreview, exitPreview],
  );

  const handleRestore = useCallback(
    (save: ActivitySaveRow) => setPendingRestore(save),
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
        // The default antd backdrop mask is a full-viewport overlay that
        // sits above the chart canvas + the preview banner, so even
        // though the banner's restore / exit / open-as-new buttons are
        // visually outside the drawer panel, hit-testing at those
        // coordinates lands on the mask and clicks are swallowed. A
        // side-panel-style drawer doesn't need a click-to-dismiss mask
        // — users dismiss via the back arrow / built-in close button.
        mask={false}
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
            // Forces the search-box state (owned by ``VersionList``) to
            // remount when the viewed entity changes — pairs with the
            // ``setScopeFilter`` / ``setHasFetched`` reset effect above.
            key={`${entityType}:${uuid ?? ''}`}
            entityType={entityType}
            records={records}
            loading={loading}
            error={error}
            selectedVersionUuid={previewVersionUuid}
            scopeFilter={scopeFilter}
            onScopeFilterChange={setScopeFilter}
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
