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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDebounceValue } from 'src/hooks/useDebounceValue';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import { hydrateExplore } from 'src/explore/actions/hydrateExplore';
import type { Slice } from 'src/types/Chart';
import type { ExplorePageState } from 'src/explore/types';
import type { ActivityInclude, ActivityRecord, SaveGroup } from './types';
import {
  clearVersionPreview,
  closeVersionHistoryPanel,
  openVersionHistoryPanel,
  selectIsVersionHistoryPanelOpen,
  selectVersionHistoryInclude,
  selectVersionPreview,
  selectVersionRestoreCount,
  selectVersionSessionLog,
  setVersionHistoryInclude,
  setVersionPreview,
} from './reducer';
import { fetchChartUuid, fetchExploreRehydrationData } from './api';
import { openRelatedEntity } from './openRelated';
import { useVersionActivity } from './useVersionActivity';
import { useVersionActions } from './useVersionActions';
import { groupHeadline } from './display';
import VersionHistoryPanel from './VersionHistoryPanel';

/**
 * The explore flex row (datasource rail + control rail + chart) cannot give
 * up enough width for the panel on narrow viewports; below the XL breakpoint
 * the panel overlays the page (anchored to the relatively-positioned explore
 * container) instead of being pushed past the viewport edge.
 */
const PanelHost = styled.div`
  ${({ theme }) => `
    height: 100%;
    flex-shrink: 0;
    @media (max-width: ${theme.screenXL}px) {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      height: auto;
      z-index: 20;
      box-shadow: ${theme.boxShadow};
    }
  `}
`;

export default function ExploreVersionHistory() {
  const dispatch = useDispatch();
  const { addDangerToast } = useToasts();
  const slice = useSelector<ExplorePageState, Slice | undefined>(
    state => state.explore?.slice ?? undefined,
  );
  const isPanelOpen = useSelector(selectIsVersionHistoryPanelOpen);
  const include = useSelector(selectVersionHistoryInclude);
  const preview = useSelector(selectVersionPreview);
  const sessionLog = useSelector(selectVersionSessionLog);
  const sliceId = slice?.slice_id;
  // Key the fetched uuid by slice id so a "save as" (which swaps the slice
  // in place) invalidates it instead of keeping the old chart's uuid.
  const [fetchedUuid, setFetchedUuid] = useState<{
    sliceId: number;
    uuid: string;
  } | null>(null);
  const uuid =
    slice?.uuid ??
    (fetchedUuid && fetchedUuid.sliceId === sliceId
      ? fetchedUuid.uuid
      : undefined);

  useEffect(() => {
    if (getUrlParam(URL_PARAMS.versionHistory)) {
      dispatch(openVersionHistoryPanel('chart'));
    }
  }, [dispatch]);

  // Leaving the page should not carry panel/preview state to other pages.
  useEffect(
    () => () => {
      dispatch(closeVersionHistoryPanel());
    },
    [dispatch],
  );

  useEffect(() => {
    if (uuid || !isPanelOpen || !sliceId) {
      return undefined;
    }
    let cancelled = false;
    fetchChartUuid(sliceId)
      .then(value => {
        if (!cancelled) {
          setFetchedUuid({ sliceId, uuid: value });
        }
      })
      .catch(() => {
        if (!cancelled) {
          addDangerToast(t('Failed to load version history'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uuid, isPanelOpen, sliceId, addDangerToast]);

  // Server-side search over the full history; debounce so each keystroke
  // doesn't refetch (sc-107283 guide, 2026-06-12).
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounceValue(searchTerm);
  const activity = useVersionActivity(
    'chart',
    isPanelOpen ? uuid : undefined,
    include,
    debouncedSearch,
  );

  const { requestRestore, openAsNew, restoreModal } = useVersionActions(
    'chart',
    uuid,
  );

  // After a restore the server-side chart changed; reload the explore
  // page state in place (same payload the page hydrates from) and
  // refresh the activity timeline so the new "Restored version" entry
  // shows up.
  const restoreCount = useSelector(selectVersionRestoreCount);
  // An overwrite save re-hydrates explore in place (no remount), which
  // replaces the slice with a fresh server copy; watch its changed_on
  // so the save surfaces as a new timeline entry while the panel is
  // open. A "save as" navigates with PUSH and reloads the page, so it
  // needs no signal.
  const saveSignal = useSelector<ExplorePageState, string | undefined>(
    state => state.explore?.slice?.changed_on,
  );
  const lastRestoreCountRef = useRef(restoreCount);
  const lastSaveSignalRef = useRef(saveSignal);
  const refreshActivity = activity.refresh;
  useEffect(() => {
    if (restoreCount !== lastRestoreCountRef.current) {
      lastRestoreCountRef.current = restoreCount;
      // The restore refresh covers any save-signal movement caused by
      // the same change; sync it so it does not refetch again.
      lastSaveSignalRef.current = saveSignal;
      refreshActivity();
      if (!sliceId) {
        return;
      }
      fetchExploreRehydrationData(sliceId)
        .then(result => {
          dispatch(hydrateExplore({ ...result, saveAction: 'overwrite' }));
        })
        .catch(() => {
          addDangerToast(t('Failed to reload the restored version'));
        });
      return;
    }
    if (saveSignal !== lastSaveSignalRef.current) {
      // A signal appearing where none existed is the page's initial
      // hydration, not a save.
      const isInitialHydration = lastSaveSignalRef.current === undefined;
      lastSaveSignalRef.current = saveSignal;
      if (!isInitialHydration) {
        refreshActivity();
      }
    }
  }, [
    addDangerToast,
    dispatch,
    refreshActivity,
    restoreCount,
    saveSignal,
    sliceId,
  ]);

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
          headline: groupHeadline('chart', group),
          issuedAt: group.issuedAt,
        }),
      );
    },
    [dispatch, uuid],
  );

  const handleExitPreview = useCallback(() => {
    dispatch(clearVersionPreview());
  }, [dispatch]);

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
          headline: groupHeadline('chart', group),
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
          headline: groupHeadline('chart', group),
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
      <PanelHost>
        <VersionHistoryPanel
          entityType="chart"
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
          sessionEntries={sessionLog}
        />
      </PanelHost>
      {restoreModal}
    </>
  );
}
