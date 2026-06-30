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
import { rebaselineHydrationSnapshot } from 'src/dashboard/util/rebaselineHydrationDashboardInfo';
import { dashboardKeys } from '../keys';
import { isCurrentDashboard } from '../updateDashboardApi';

/** Publishes / unpublishes a dashboard. */
export function usePublishDashboard(id: number) {
  const { addSuccessToast, addDangerToast } = useToasts();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isPublished: boolean) =>
      SupersetClient.put({
        endpoint: `/api/v1/dashboard/${id}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: isPublished }),
      }).then(() => isPublished),
    onSuccess: isPublished => {
      // Ignore a response that resolved after the user navigated away.
      if (!isCurrentDashboard(id)) return;
      addSuccessToast(
        isPublished
          ? t('This dashboard is now published')
          : t('This dashboard is now hidden'),
      );
      useDashboardStateStore.getState().setIsPublished(isPublished);
      queryClient.invalidateQueries({ queryKey: dashboardKeys.detail(id) });
      // Rebaseline the discard snapshot so the persisted publish state survives
      // a later in-place discard (published lives in the seed).
      rebaselineHydrationSnapshot(id);
    },
    onError: () => {
      if (!isCurrentDashboard(id)) return;
      addDangerToast(t('You do not have permissions to edit this dashboard.'));
    },
  });
}
