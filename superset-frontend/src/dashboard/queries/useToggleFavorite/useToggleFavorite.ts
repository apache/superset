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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { useDashboardStateStore } from 'src/dashboard/stores';
import { dashboardKeys } from '../keys';
import { isCurrentDashboard } from '../updateDashboardApi';

/** Favorites / unfavorites a dashboard for the current user. */
export function useToggleFavorite(id: number) {
  const { addDangerToast } = useToasts();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isStarred: boolean) => {
      const endpoint = `/api/v1/dashboard/${id}/favorites/`;
      const apiCall = isStarred
        ? SupersetClient.delete({ endpoint })
        : SupersetClient.post({ endpoint });
      return apiCall.then(() => isStarred);
    },
    onSuccess: isStarred => {
      const nowStarred = !isStarred;
      // Always sync the cache, even if the user navigated away, so a later visit
      // within staleTime doesn't mirror a stale value back into the store.
      queryClient.setQueryData(dashboardKeys.favoriteStatus(id), nowStarred);
      if (isCurrentDashboard(id)) {
        useDashboardStateStore.getState().setIsStarred(nowStarred);
      }
    },
    onError: () => {
      if (!isCurrentDashboard(id)) return;
      addDangerToast(t('There was an issue favoriting this dashboard.'));
    },
  });
}
