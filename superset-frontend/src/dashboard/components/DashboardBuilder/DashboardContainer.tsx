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
// ParentSize uses resize observer so the dashboard will update size
// when its container size changes, due to e.g., builder side panel opening
import React, { FC, useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  FeatureFlag,
  Filter,
  Filters,
  getCategoricalSchemeRegistry,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import { ParentSize } from '@vx/responsive';
import pick from 'lodash/pick';
import Tabs from 'src/components/Tabs';
import DashboardGrid from 'src/dashboard/containers/DashboardGrid';
import {
  ChartsState,
  DashboardInfo,
  DashboardLayout,
  LayoutItem,
  RootState,
} from 'src/dashboard/types';
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_DEPTH,
} from 'src/dashboard/util/constants';
import { getChartIdsInFilterScope } from 'src/dashboard/util/getChartIdsInFilterScope';
import findTabIndexByComponentId from 'src/dashboard/util/findTabIndexByComponentId';
import { setInScopeStatusOfFilters } from 'src/dashboard/actions/nativeFilters';
import { dashboardInfoChanged } from 'src/dashboard/actions/dashboardInfo';
import { setColorScheme } from 'src/dashboard/actions/dashboardState';
import { useComponentDidUpdate } from 'src/hooks/useComponentDidUpdate/useComponentDidUpdate';
import jsonStringify from 'json-stringify-pretty-compact';
import { NATIVE_FILTER_DIVIDER_PREFIX } from '../nativeFilters/FiltersConfigModal/utils';
import { findTabsWithChartsInScope } from '../nativeFilters/utils';
import { getRootLevelTabIndex, getRootLevelTabsComponent } from './utils';

type DashboardContainerProps = {
  topLevelTabs?: LayoutItem;
};

const useNativeFilterScopes = () => {
  const nativeFilters = useSelector<RootState, Filters>(
    state => state.nativeFilters?.filters,
  );
  return useMemo(
    () =>
      nativeFilters
        ? Object.values(nativeFilters).map((filter: Filter) =>
            pick(filter, ['id', 'scope', 'type']),
          )
        : [],
    [JSON.stringify(nativeFilters)],
  );
};

const DashboardContainer: FC<DashboardContainerProps> = ({ topLevelTabs }) => {
  const nativeFilterScopes = useNativeFilterScopes();
  const dispatch = useDispatch();

  const dashboardLayout = useSelector<RootState, DashboardLayout>(
    state => state.dashboardLayout.present,
  );
  const dashboardInfo = useSelector<RootState, DashboardInfo>(
    state => state.dashboardInfo,
  );
  const directPathToChild = useSelector<RootState, string[]>(
    state => state.dashboardState.directPathToChild,
  );
  const charts = useSelector<RootState, ChartsState>(state => state.charts);

  const tabIndex = useMemo(() => {
    const nextTabIndex = findTabIndexByComponentId({
      currentComponent: getRootLevelTabsComponent(dashboardLayout),
      directPathToChild,
    });

    return nextTabIndex > -1
      ? nextTabIndex
      : getRootLevelTabIndex(dashboardLayout, directPathToChild);
  }, [dashboardLayout, directPathToChild]);

  useEffect(() => {
    if (
      !isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS) ||
      nativeFilterScopes.length === 0
    ) {
      return;
    }
    const scopes = nativeFilterScopes.map(filterScope => {
      if (filterScope.id.startsWith(NATIVE_FILTER_DIVIDER_PREFIX)) {
        return {
          filterId: filterScope.id,
          tabsInScope: [],
          chartsInScope: [],
        };
      }
      const chartsInScope: number[] = getChartIdsInFilterScope(
        filterScope.scope,
        charts,
        dashboardLayout,
      );
      const tabsInScope = findTabsWithChartsInScope(
        dashboardLayout,
        chartsInScope,
      );
      return {
        filterId: filterScope.id,
        tabsInScope: Array.from(tabsInScope),
        chartsInScope,
      };
    });
    dispatch(setInScopeStatusOfFilters(scopes));
  }, [nativeFilterScopes, dashboardLayout, dispatch]);

  const verifyUpdateColorScheme = useCallback(() => {
    const currentMetadata = dashboardInfo.metadata;
    if (currentMetadata?.color_scheme) {
      const metadata = { ...currentMetadata };
      const colorScheme = metadata?.color_scheme;
      const colorSchemeDomain = metadata?.color_scheme_domain || [];
      const categoricalSchemes = getCategoricalSchemeRegistry();
      const registryColorScheme =
        categoricalSchemes.get(colorScheme, true) || undefined;
      const registryColorSchemeDomain = registryColorScheme?.colors || [];
      const defaultColorScheme = categoricalSchemes.defaultKey;
      const colorSchemeExists = !!registryColorScheme;

      const updateDashboardData = () => {
        SupersetClient.put({
          endpoint: `/api/v1/dashboard/${dashboardInfo.id}`,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            json_metadata: jsonStringify(metadata),
          }),
        }).catch(e => console.log(e));
      };
      const updateColorScheme = (scheme: string) => {
        dispatch(setColorScheme(scheme));
      };
      const updateDashboard = () => {
        dispatch(
          dashboardInfoChanged({
            metadata,
          }),
        );
        updateDashboardData();
      };
      // selected color scheme does not exist anymore
      // must fallback to the available default one
      if (!colorSchemeExists) {
        const updatedScheme =
          defaultColorScheme?.toString() || 'supersetColors';
        metadata.color_scheme = updatedScheme;
        metadata.color_scheme_domain =
          categoricalSchemes.get(defaultColorScheme)?.colors || [];

        // reset shared_label_colors
        // TODO: Requires regenerating the shared_label_colors after
        // fixing a bug which affects their generation on dashboards with tabs
        metadata.shared_label_colors = {};

        updateColorScheme(updatedScheme);
        updateDashboard();
      } else {
        // if this dashboard does not have a color_scheme_domain saved
        // must create one and store it for the first time
        if (colorSchemeExists && !colorSchemeDomain.length) {
          metadata.color_scheme_domain = registryColorSchemeDomain;
          updateDashboard();
        }
        // if the color_scheme_domain is not the same as the registry domain
        // must update the existing color_scheme_domain
        if (
          colorSchemeExists &&
          colorSchemeDomain.length &&
          registryColorSchemeDomain.toString() !== colorSchemeDomain.toString()
        ) {
          metadata.color_scheme_domain = registryColorSchemeDomain;

          // reset shared_label_colors
          // TODO: Requires regenerating the shared_label_colors after
          // fixing a bug which affects their generation on dashboards with tabs
          metadata.shared_label_colors = {};

          updateColorScheme(colorScheme);
          updateDashboard();
        }
      }
    }
  }, [charts]);

  useComponentDidUpdate(verifyUpdateColorScheme);

  const childIds: string[] = topLevelTabs
    ? topLevelTabs.children
    : [DASHBOARD_GRID_ID];
  const min = Math.min(tabIndex, childIds.length - 1);
  const activeKey = min === 0 ? DASHBOARD_GRID_ID : min.toString();

  return (
    <div className="grid-container" data-test="grid-container">
      <ParentSize>
        {({ width }) => (
          /*
            We use a TabContainer irrespective of whether top-level tabs exist to maintain
            a consistent React component tree. This avoids expensive mounts/unmounts of
            the entire dashboard upon adding/removing top-level tabs, which would otherwise
            happen because of React's diffing algorithm
          */
          <Tabs
            id={DASHBOARD_GRID_ID}
            activeKey={activeKey}
            renderTabBar={() => <></>}
            fullWidth={false}
            animated={false}
            allowOverflow
          >
            {childIds.map((id, index) => (
              // Matching the key of the first TabPane irrespective of topLevelTabs
              // lets us keep the same React component tree when !!topLevelTabs changes.
              // This avoids expensive mounts/unmounts of the entire dashboard.
              <Tabs.TabPane
                key={index === 0 ? DASHBOARD_GRID_ID : index.toString()}
              >
                <DashboardGrid
                  gridComponent={dashboardLayout[id]}
                  // see isValidChild for why tabs do not increment the depth of their children
                  depth={DASHBOARD_ROOT_DEPTH + 1} // (topLevelTabs ? 0 : 1)}
                  width={width}
                  isComponentVisible={index === tabIndex}
                />
              </Tabs.TabPane>
            ))}
          </Tabs>
        )}
      </ParentSize>
    </div>
  );
};

export default DashboardContainer;
