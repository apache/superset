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
import React, { FC, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { ParentSize } from '@vx/responsive';
import Tabs from 'src/components/Tabs';
import DashboardGrid from 'src/dashboard/containers/DashboardGrid';
import getLeafComponentIdFromPath from 'src/dashboard/util/getLeafComponentIdFromPath';
import { DashboardLayout, LayoutItem, RootState } from 'src/dashboard/types';
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_DEPTH,
} from 'src/dashboard/util/constants';
import { getRootLevelTabIndex, getRootLevelTabsComponent } from './utils';
import { Filters } from '../../reducers/types';
import { getChartIdsInFilterScope } from '../../util/activeDashboardFilters';
import findTabIndexByComponentId from '../../util/findTabIndexByComponentId';
import { findTabsWithChartsInScope } from '../nativeFilters/utils';
import { setInScopeStatusOfFilters } from '../../actions/nativeFilters';

type DashboardContainerProps = {
  topLevelTabs?: LayoutItem;
};

const DashboardContainer: FC<DashboardContainerProps> = ({ topLevelTabs }) => {
  const dashboardLayout = useSelector<RootState, DashboardLayout>(
    state => state.dashboardLayout.present,
  );
  const nativeFilters = useSelector<RootState, Filters>(
    state => state.nativeFilters?.filters,
  );
  const directPathToChild = useSelector<RootState, string[]>(
    state => state.dashboardState.directPathToChild,
  );
  const [tabIndex, setTabIndex] = useState(
    getRootLevelTabIndex(dashboardLayout, directPathToChild),
  );

  const dispatch = useDispatch();

  useEffect(() => {
    const nextTabIndex = findTabIndexByComponentId({
      currentComponent: getRootLevelTabsComponent(dashboardLayout),
      directPathToChild,
    });
    if (nextTabIndex > -1) {
      setTabIndex(nextTabIndex);
    }
  }, [getLeafComponentIdFromPath(directPathToChild)]);

  // recalculate charts and tabs in scopes of native filters only when a scope or dashboard layout changes
  const filterScopes = Object.values(nativeFilters ?? {}).map(filter => ({
    id: filter.id,
    scope: filter.scope,
  }));
  useEffect(() => {
    if (
      !isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS) ||
      filterScopes.length === 0
    ) {
      return;
    }
    const scopes = filterScopes.map(filterScope => {
      const { scope } = filterScope;
      const chartsInScope: number[] = getChartIdsInFilterScope({
        filterScope: {
          scope: scope.rootPath,
          // @ts-ignore
          immune: scope.excluded,
        },
      });
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
  }, [JSON.stringify(filterScopes), dashboardLayout, dispatch]);

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
