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
import { useEffect } from 'react';
import rison from 'rison';
import { useQuery } from '@tanstack/react-query';
import { JsonObject, SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { useDashboardStateStore } from 'src/dashboard/stores';
import { dashboardKeys } from '../keys';
import { isCurrentDashboard } from '../updateDashboardApi';

async function fetchFavoriteStatus(id: number): Promise<boolean> {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/dashboard/favorite_status/?q=${rison.encode([id])}`,
  });
  return !!((json as JsonObject)?.result as JsonObject[])?.[0]?.value;
}

/**
 * Fetches the current user's favorite status for the dashboard and mirrors it
 * into the dashboard-state store. Replaces the `fetchFaveStar` thunk.
 */
export function useFavoriteStatus(id: number, enabled = true) {
  const { addDangerToast } = useToasts();
  const query = useQuery({
    queryKey: dashboardKeys.favoriteStatus(id),
    queryFn: () => fetchFavoriteStatus(id),
    enabled,
    // Favorite status only changes via this user's own toggle (which writes the
    // cache directly), so avoid refetching on every Header remount / refocus.
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data === undefined) return;
    // Guard against stale responses landing after the user navigated away.
    if (!isCurrentDashboard(id)) return;
    useDashboardStateStore.getState().setIsStarred(query.data);
  }, [id, query.data]);

  useEffect(() => {
    if (!query.isError) return;
    // 404 = status unavailable to this user (non-owner draft, or deleted after
    // navigation); swallow it silently instead of alarming them.
    if (query.error instanceof Response && query.error.status === 404) return;
    if (!isCurrentDashboard(id)) return;
    addDangerToast(
      t('There was an issue fetching the favorite status of this dashboard.'),
    );
  }, [id, query.isError, query.error, addDangerToast]);

  return query;
}
