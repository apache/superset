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
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import { hydrateExplore } from 'src/explore/actions/hydrateExplore';
import type { Slice } from 'src/types/Chart';
import type { ExplorePageState } from 'src/explore/types';
import type { ActivityInclude, ActivityRecord, SaveGroup } from './types';
import {
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
  const [uuid, setUuid] = useState<string | undefined>(slice?.uuid);

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
    if (uuid || !isPanelOpen || !slice?.slice_id) {
      return undefined;
    }
    if (slice.uuid) {
      setUuid(slice.uuid);
      return undefined;
    }
    let cancelled = false;
    fetchChartUuid(slice.slice_id)
      .then(value => {
        if (!cancelled) {
          setUuid(value);
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
  }, [uuid, isPanelOpen, slice?.slice_id, slice?.uuid, addDangerToast]);

  const activity = useVersionActivity(
    'chart',
    isPanelOpen ? uuid : undefined,
    include,
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
  const lastRestoreCountRef = useRef(restoreCount);
  const refreshActivity = activity.refresh;
  const sliceId = slice?.slice_id;
  useEffect(() => {
    if (restoreCount === lastRestoreCountRef.current) {
      return;
    }
    lastRestoreCountRef.current = restoreCount;
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
  }, [addDangerToast, dispatch, refreshActivity, restoreCount, sliceId]);

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
      <VersionHistoryPanel
        entityType="chart"
        activity={activity}
        include={include}
        onIncludeChange={handleIncludeChange}
        previewedTransactionId={preview?.transactionId ?? null}
        onClose={handleClose}
        onPreview={handlePreview}
        onRestore={handleRestore}
        onOpenAsNew={handleOpenAsNew}
        onOpenRelated={handleOpenRelated}
        sessionEntries={sessionLog}
      />
      {restoreModal}
    </>
  );
}
