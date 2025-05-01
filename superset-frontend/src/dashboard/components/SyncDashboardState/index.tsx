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

import { pick, pickBy } from 'lodash';
import { useSelector } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { DashboardContextForExplore } from 'src/types/DashboardContextForExplore';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import { RootState } from 'src/dashboard/types';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { enforceSharedLabelsColorsArray } from 'src/utils/colorScheme';
import { Divider, Filter } from '@superset-ui/core';

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
  return pickBy(dashboardsContexts, value => !value.isRedundant);
};

const updateDashboardTabLocalStorage = (
  dashboardPageId: string,
  dashboardContext: DashboardContextForExplore,
) => {
  const dashboardsContexts = getDashboardContextLocalStorage();
  setItem(LocalStorageKeys.DashboardExploreContext, {
    ...dashboardsContexts,
    [dashboardPageId]: { ...dashboardContext, dashboardPageId },
  });
};

const selectDashboardContextForExplore = createSelector(
  [
    (state: RootState) => state.dashboardInfo.metadata,
    (state: RootState) => state.dashboardInfo.id,
    (state: RootState) => state.dashboardState?.colorScheme,
    (state: RootState) => state.nativeFilters?.filters,
    (state: RootState) => state.dataMask,
  ],
  (metadata, dashboardId, colorScheme, filters, dataMask) => {
    const nativeFilters = Object.keys(filters).reduce<
      Record<string, Pick<Filter | Divider, 'chartsInScope'>>
    >((acc, key) => {
      acc[key] = pick(filters[key], ['chartsInScope']);
      return acc;
    }, {});

    return {
      labelsColor: metadata?.label_colors || EMPTY_OBJECT,
      labelsColorMap: metadata?.map_label_colors || EMPTY_OBJECT,
      sharedLabelsColors: enforceSharedLabelsColorsArray(
        metadata?.shared_label_colors,
      ),
      colorScheme,
      chartConfiguration: metadata?.chart_configuration || EMPTY_OBJECT,
      nativeFilters,
      dataMask,
      dashboardId,
      filterBoxFilters: getActiveFilters(),
    };
  },
);

const SyncDashboardState: FC<Props> = ({ dashboardPageId }) => {
  const dashboardContextForExplore = useSelector<
    RootState,
    DashboardContextForExplore
  >(selectDashboardContextForExplore);

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
