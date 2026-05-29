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
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import {
  addDangerToast,
  addSuccessToast,
} from 'src/components/MessageToasts/actions';
import { Change, EntityType } from '../types';
import {
  forkChartFromSnapshot,
  forkDashboardFromSnapshot,
} from '../utils/forkActions';
import { formatChangeTitle } from '../utils/formatChangeTitle';

/** Minimal shape needed to fork — both the legacy ``Version`` row and the
 * new ``ActivitySaveRow`` satisfy this. */
export interface ForkableVersion {
  version_uuid: string;
  changes: Change[];
}

/**
 * Returns a callback that forks a chart or dashboard from a historical
 * version snapshot, navigates to the new entity, and surfaces success /
 * failure toasts. Used by both the side panel's "Open as new" menu item
 * and the preview banner's "Open as new" button so they stay in sync.
 */
export function useForkVersion(
  entityType: EntityType,
  uuid: string | null | undefined,
) {
  const dispatch = useDispatch();
  const history = useHistory();
  const ownerId = useSelector(
    (state: { user?: { userId?: number } }) => state.user?.userId,
  );

  return useCallback(
    async (version: ForkableVersion) => {
      if (!uuid) return;
      try {
        const { json } = await SupersetClient.get({
          endpoint: `/api/v1/${entityType}/${uuid}/versions/${version.version_uuid}/`,
        });
        const snapshotPayload = (
          json as { result?: Parameters<typeof forkChartFromSnapshot>[0] }
        )?.result;
        if (!snapshotPayload) {
          throw new Error('Snapshot payload missing');
        }
        const created =
          entityType === 'chart'
            ? await forkChartFromSnapshot(snapshotPayload, ownerId)
            : await forkDashboardFromSnapshot(snapshotPayload, ownerId);
        dispatch(
          addSuccessToast(
            t('Created from version: %(summary)s', {
              summary: formatChangeTitle(version.changes),
            }),
          ),
        );
        history.push(
          entityType === 'chart'
            ? `/explore/?slice_id=${created.id}`
            : `/superset/dashboard/${created.id}/`,
        );
      } catch (e) {
        dispatch(
          addDangerToast(
            entityType === 'chart'
              ? t('Failed to create chart from version')
              : t('Failed to create dashboard from version'),
          ),
        );
      }
    },
    [dispatch, entityType, history, ownerId, uuid],
  );
}
