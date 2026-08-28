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
import { useDispatch, useSelector } from 'react-redux';
import { useDebounceValue } from 'src/hooks/useDebounceValue';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { getUrlParam } from 'src/utils/urlUtils';
import { canOverwriteSlice } from 'src/explore/exploreUtils/canOverwriteSlice';
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
  selectVersionLastRestoredUuid,
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
  const user = useSelector<ExplorePageState, ExplorePageState['user']>(
    state => state.user,
  );
  const canOverwrite = useSelector<ExplorePageState, boolean>(
    state => state.explore?.can_overwrite ?? false,
  );
  // Same predicate as the menu that opens this panel: can_overwrite alone
  // excludes admins and extra editors on charts with no explicit editors.
  const canRestore = useMemo(
    () => canOverwriteSlice({ slice, user, canOverwrite }),
    [slice, user, canOverwrite],
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

  // The URL param is honoured once per mount. It persists for the whole
  // visit, and this effect re-runs whenever `canRestore` moves — a late
  // false→true flip (slice metadata refetch, an editors change landing)
  // would otherwise re-open a panel the user explicitly closed.
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
      dispatch(openVersionHistoryPanel('chart'));
    }
  }, [canRestore, dispatch]);

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
          // Without a uuid the panel would sit on a misleading
          // "No history yet" empty state; close it instead.
          dispatch(closeVersionHistoryPanel());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uuid, isPanelOpen, sliceId, addDangerToast, dispatch]);

  // Server-side search over the full history; debounce so each keystroke
  // doesn't refetch.
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
  const lastRestoredUuid = useSelector(selectVersionLastRestoredUuid);
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
  // Invalidation token for the in-flight post-restore rehydration.
  // hydrateExplore rewrites the whole explore store, so a fetch resolving
  // after the page unmounted — or after a save-as swapped the slice in
  // place — would overwrite the newly loaded chart's state with the old
  // chart's payload. The token belongs to the fetch, not to the effect:
  // the effect's identity moves whenever the debounced search term or the
  // include filter does (both feed `refreshActivity`), and cancelling on
  // those re-runs would drop a live rehydration that nothing re-issues.
  const restoreHydrationIdRef = useRef(0);
  // Only unmount and a slice/uuid swap supersede a rehydration here; a
  // newer restore bumps the token where it starts its own fetch.
  useEffect(
    () => () => {
      restoreHydrationIdRef.current += 1;
    },
    [sliceId, uuid],
  );
  useEffect(() => {
    if (restoreCount !== lastRestoreCountRef.current) {
      lastRestoreCountRef.current = restoreCount;
      // Guard: a restore of some other entity, resolving after navigation.
      // This chart did not change on the server; rehydrating would discard
      // its state for someone else's restore.
      if (lastRestoredUuid === uuid) {
        // The restore refresh covers any save-signal movement caused by
        // the same change; sync it so it does not refetch again.
        lastSaveSignalRef.current = saveSignal;
        refreshActivity();
        if (sliceId) {
          restoreHydrationIdRef.current += 1;
          const hydrationId = restoreHydrationIdRef.current;
          // A save landing while this fetch is in flight leaves the payload
          // in hand older than the store: hydrating it would roll the chart
          // back over the newer save. The save's own in-place hydration is
          // already correct, so the stale restore payload is simply dropped.
          const saveSignalAtStart = lastSaveSignalRef.current;
          const isCurrent = () =>
            restoreHydrationIdRef.current === hydrationId &&
            lastSaveSignalRef.current === saveSignalAtStart;
          fetchExploreRehydrationData(sliceId)
            .then(result => {
              if (isCurrent()) {
                dispatch(
                  hydrateExplore({ ...result, saveAction: 'overwrite' }),
                );
              }
            })
            .catch(() => {
              if (isCurrent()) {
                addDangerToast(t('Failed to reload the restored version'));
              }
            });
        }
      }
    } else if (saveSignal !== lastSaveSignalRef.current) {
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
    lastRestoredUuid,
    refreshActivity,
    restoreCount,
    saveSignal,
    sliceId,
    uuid,
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
          headline: groupHeadline(group),
          issuedAt: group.issuedAt,
        }),
      );
    },
    [dispatch, uuid],
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
      <PanelHost>
        <VersionHistoryPanel
          entityType="chart"
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
          sessionEntries={sessionLog}
        />
      </PanelHost>
      {restoreModal}
    </>
  );
}
