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
import {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { isEqual } from 'lodash';
import {
  ChartCustomizationConfiguration,
  ChartCustomizationType,
  LabelsColorMapSource,
  NativeFilterType,
  getLabelsColorMap,
} from '@superset-ui/core';
import { ParentSize } from '@visx/responsive';
import Tabs from '@superset-ui/core/components/Tabs';
import DashboardGrid from 'src/dashboard/containers/DashboardGrid';
import {
  DashboardInfo,
  DashboardLayout,
  LayoutItem,
  RootState,
} from 'src/dashboard/types';
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_DEPTH,
} from 'src/dashboard/util/constants';
import findTabIndexByComponentId from 'src/dashboard/util/findTabIndexByComponentId';
import { setInScopeStatusOfFilters } from 'src/dashboard/actions/nativeFilters';
import { setInScopeStatusOfCustomizations } from 'src/dashboard/actions/chartCustomizationActions';
import { useChartIds } from 'src/dashboard/util/charts/useChartIds';
import {
  applyDashboardLabelsColorOnLoad,
  updateDashboardLabelsColor,
  persistDashboardLabelsColor,
  ensureSyncedSharedLabelsColors,
  ensureSyncedLabelsColorMap,
} from 'src/dashboard/actions/dashboardState';
import { getColorNamespace, resetColors } from 'src/utils/colorScheme';
import { calculateScopes } from 'src/dashboard/util/calculateScopes';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { NATIVE_FILTER_DIVIDER_PREFIX } from '../nativeFilters/FiltersConfigModal/utils';
import { selectFilterConfiguration } from '../nativeFilters/state';
import { getRootLevelTabsComponent } from './utils';

type DashboardContainerProps = {
  topLevelTabs?: LayoutItem;
};

interface ScopeData {
  chartsInScope: number[];
  tabsInScope: string[];
}

interface FilterScopeData extends ScopeData {
  filterId: string;
}

interface CustomizationScopeData extends ScopeData {
  customizationId: string;
}

export const renderedChartIdsSelector: (state: RootState) => number[] =
  createSelector([(state: RootState) => state.charts], charts =>
    Object.values(charts)
      .filter(chart => chart.chartStatus === 'rendered')
      .map(chart => chart.id),
  );

const useRenderedChartIds = () => {
  const renderedChartIds = useSelector<RootState, number[]>(
    renderedChartIdsSelector,
    shallowEqual,
  );
  return renderedChartIds;
};

const TOP_OF_PAGE_RANGE = 220;

const DashboardContainer: FC<DashboardContainerProps> = ({ topLevelTabs }) => {
  const dispatch = useDispatch();

  const dashboardLayout = useSelector<RootState, DashboardLayout>(
    state => state.dashboardLayout.present,
  );
  const dashboardInfo = useSelector<RootState, DashboardInfo>(
    state => state.dashboardInfo,
  );
  const filterItems = useSelector(selectFilterConfiguration);
  const chartCustomizations = useSelector<
    RootState,
    ChartCustomizationConfiguration
  >(
    state => state.dashboardInfo?.metadata?.chart_customization_config || [],
    shallowEqual,
  );
  const directPathToChild = useSelector<RootState, string[]>(
    state => state.dashboardState.directPathToChild,
  );
  const chartIds = useChartIds();

  const renderedChartIds = useRenderedChartIds();

  const [dashboardLabelsColorInitiated, setDashboardLabelsColorInitiated] =
    useState(false);
  const prevRenderedChartIds = useRef<number[]>([]);
  const prevTabIndexRef = useRef<number>();
  const prevFilterScopesRef = useRef<FilterScopeData[]>([]);
  const prevCustomizationScopesRef = useRef<CustomizationScopeData[]>([]);
  const tabIndex = useMemo(() => {
    const nextTabIndex = findTabIndexByComponentId({
      currentComponent: getRootLevelTabsComponent(dashboardLayout),
      directPathToChild,
    });

    if (nextTabIndex === -1) {
      return prevTabIndexRef.current ?? 0;
    }
    prevTabIndexRef.current = nextTabIndex;
    return nextTabIndex;
  }, [dashboardLayout, directPathToChild]);
  // when all charts have rendered, enforce fresh shared labels
  const shouldForceFreshSharedLabelsColors =
    dashboardLabelsColorInitiated &&
    renderedChartIds.length > 0 &&
    chartIds.length === renderedChartIds.length &&
    prevRenderedChartIds.current.length < renderedChartIds.length;

  const onBeforeUnload = useCallback(() => {
    dispatch(persistDashboardLabelsColor());
    resetColors(getColorNamespace(dashboardInfo?.metadata?.color_namespace));
    prevRenderedChartIds.current = [];
  }, [dashboardInfo?.metadata?.color_namespace, dispatch]);

  const chartLayoutItems = useMemo(
    () =>
      Object.values(dashboardLayout).filter(item => item?.type === CHART_TYPE),
    [dashboardLayout],
  );

  useEffect(() => {
    if (filterItems.length === 0) {
      return;
    }

    const scopes = calculateScopes(
      filterItems,
      chartIds,
      chartLayoutItems,
      item =>
        item.id.startsWith(NATIVE_FILTER_DIVIDER_PREFIX) ||
        item.type === NativeFilterType.Divider,
    ).map(scope => ({
      filterId: scope.id,
      chartsInScope: scope.chartsInScope,
      tabsInScope: scope.tabsInScope,
    }));

    if (!isEqual(scopes, prevFilterScopesRef.current)) {
      prevFilterScopesRef.current = scopes;
      dispatch(setInScopeStatusOfFilters(scopes));
    }
  }, [chartIds, filterItems, chartLayoutItems, dispatch]);

  useEffect(() => {
    if (chartCustomizations.length === 0) {
      return;
    }

    const scopes = calculateScopes(
      chartCustomizations,
      chartIds,
      chartLayoutItems,
      item => item.type === ChartCustomizationType.Divider,
    ).map(scope => ({
      customizationId: scope.id,
      chartsInScope: scope.chartsInScope,
      tabsInScope: scope.tabsInScope,
    }));

    if (!isEqual(scopes, prevCustomizationScopesRef.current)) {
      prevCustomizationScopesRef.current = scopes;
      dispatch(setInScopeStatusOfCustomizations(scopes));
    }
  }, [chartIds, chartCustomizations, chartLayoutItems, dispatch]);

  const childIds: string[] = useMemo(
    () => (topLevelTabs ? topLevelTabs.children : [DASHBOARD_GRID_ID]),
    [topLevelTabs],
  );
  const min = Math.min(tabIndex, childIds.length - 1);
  const activeKey = min === 0 ? DASHBOARD_GRID_ID : min.toString();

  useEffect(() => {
    if (shouldForceFreshSharedLabelsColors) {
      // all available charts have rendered, enforce freshest shared label colors
      dispatch(ensureSyncedSharedLabelsColors(dashboardInfo.metadata, true));
    }
  }, [dashboardInfo.metadata, dispatch, shouldForceFreshSharedLabelsColors]);

  useEffect(() => {
    // verify freshness of color map
    // when charts render to catch new labels
    const numRenderedCharts = renderedChartIds.length;

    if (
      dashboardLabelsColorInitiated &&
      numRenderedCharts > 0 &&
      prevRenderedChartIds.current.length < numRenderedCharts
    ) {
      const newRenderedChartIds = renderedChartIds.filter(
        id => !prevRenderedChartIds.current.includes(id),
      );
      prevRenderedChartIds.current = renderedChartIds;
      dispatch(updateDashboardLabelsColor(newRenderedChartIds));
      // new data may have appeared in the map (data changes)
      // or new slices may have appeared while changing tabs
      dispatch(ensureSyncedLabelsColorMap(dashboardInfo.metadata));

      if (!shouldForceFreshSharedLabelsColors) {
        dispatch(ensureSyncedSharedLabelsColors(dashboardInfo.metadata));
      }
    }
  }, [
    renderedChartIds,
    dispatch,
    dashboardLabelsColorInitiated,
    dashboardInfo.metadata,
    shouldForceFreshSharedLabelsColors,
  ]);

  useEffect(() => {
    const labelsColorMap = getLabelsColorMap();
    labelsColorMap.source = LabelsColorMapSource.Dashboard;

    if (dashboardInfo?.id && !dashboardLabelsColorInitiated) {
      dispatch(applyDashboardLabelsColorOnLoad(dashboardInfo.metadata));
      // apply labels color as dictated by stored metadata (if any)
      setDashboardLabelsColorInitiated(true);
    }

    return () => {
      onBeforeUnload();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardInfo?.id, dispatch]);

  useEffect(() => {
    // 'beforeunload' event interferes with Cypress data cleanup process.
    // This code prevents 'beforeunload' from triggering in Cypress tests,
    // as it is not required for end-to-end testing scenarios.
    if (!(window as any).Cypress) {
      window.addEventListener('beforeunload', onBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [onBeforeUnload]);

  const renderTabBar = useCallback(() => <></>, []);
  const handleFocus = useCallback(e => {
    if (
      // prevent scrolling when tabbing to the tab pane
      e.target.classList.contains('ant-tabs-tabpane') &&
      window.scrollY < TOP_OF_PAGE_RANGE
    ) {
      // prevent window from jumping down when tabbing
      // if already at the top of the page
      // to help with accessibility when using keyboard navigation
      window.scrollTo(window.scrollX, 0);
    }
  }, []);

  const renderParentSizeChildren = useCallback(
    ({ width }) => {
      const tabItems = childIds.map((id, index) => ({
        key: index === 0 ? DASHBOARD_GRID_ID : index.toString(),
        label: null,
        children: (
          <DashboardGrid
            gridComponent={dashboardLayout[id]}
            depth={DASHBOARD_ROOT_DEPTH + 1}
            width={width}
            isComponentVisible={index === tabIndex}
          />
        ),
      }));

      return (
        <Tabs
          id={DASHBOARD_GRID_ID}
          activeKey={activeKey}
          renderTabBar={renderTabBar}
          animated={false}
          allowOverflow
          fullHeight
          onFocus={handleFocus}
          items={tabItems}
          tabBarStyle={{ paddingLeft: 0 }}
        />
      );
    },
    [activeKey, childIds, dashboardLayout, handleFocus, renderTabBar, tabIndex],
  );

  return (
    <div className="grid-container" data-test="grid-container">
      <ParentSize>{renderParentSizeChildren}</ParentSize>
    </div>
  );
};

export default memo(DashboardContainer);
