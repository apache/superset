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
import { FC, useEffect } from 'react';

import { pick } from 'lodash';
import { shallowEqual, useSelector } from 'react-redux';
import { DashboardContextForExplore } from 'src/types/DashboardContextForExplore';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import { RootState } from 'src/dashboard/types';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';

type Props = { dashboardPageId: string };

const EMPTY_OBJECT = {};

export const getDashboardContextLocalStorage = () => {
  const dashboardsContexts = getItem(
    LocalStorageKeys.DashboardExploreContext,
    {},
  );
  // A new dashboard tab id is generated on each dashboard page opening.
  // We mark ids as redundant when user leaves the dashboard, because they won't be reused.
  // Then we remove redundant dashboard contexts from local storage in order not to clutter it
  return Object.fromEntries(
    Object.entries(dashboardsContexts).filter(
      ([, value]) => !value.isRedundant,
    ),
  );
};

const updateDashboardTabLocalStorage = (
  dashboardPageId: string,
  dashboardContext: DashboardContextForExplore,
) => {
  const dashboardsContexts = getDashboardContextLocalStorage();
  setItem(LocalStorageKeys.DashboardExploreContext, {
    ...dashboardsContexts,
    [dashboardPageId]: dashboardContext,
  });
};

const SyncDashboardState: FC<Props> = ({ dashboardPageId }) => {
  const dashboardContextForExplore = useSelector<
    RootState,
    DashboardContextForExplore
  >(
    ({ dashboardInfo, dashboardState, nativeFilters, dataMask }) => ({
      labelsColor: dashboardInfo.metadata?.label_colors || EMPTY_OBJECT,
      labelsColorMap:
        dashboardInfo.metadata?.shared_label_colors || EMPTY_OBJECT,
      colorScheme: dashboardState?.colorScheme,
      chartConfiguration:
        dashboardInfo.metadata?.chart_configuration || EMPTY_OBJECT,
      nativeFilters: Object.entries(nativeFilters.filters).reduce(
        (acc, [key, filterValue]) => ({
          ...acc,
          [key]: pick(filterValue, ['chartsInScope']),
        }),
        {},
      ),
      dataMask,
      dashboardId: dashboardInfo.id,
      filterBoxFilters: getActiveFilters(),
      dashboardPageId,
    }),
    shallowEqual,
  );

  useEffect(() => {
    updateDashboardTabLocalStorage(dashboardPageId, dashboardContextForExplore);
    return () => {
      // mark tab id as redundant when dashboard unmounts - case when user opens
      // Explore in the same tab
      updateDashboardTabLocalStorage(dashboardPageId, {
        ...dashboardContextForExplore,
        isRedundant: true,
      });
    };
  }, [dashboardContextForExplore, dashboardPageId]);

  return null;
};

export default SyncDashboardState;
