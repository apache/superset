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
import { Filter, t } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import {
  ChartsState,
  Layout,
  LayoutItem,
  RootState,
} from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { useMemo } from 'react';

const extractTabLabel = (tab?: LayoutItem) =>
  tab?.meta?.text || tab?.meta?.defaultText || '';
const extractChartLabel = (chart?: LayoutItem) =>
  chart?.meta?.sliceNameOverride || chart?.meta?.sliceName || chart?.id || '';

const useCharts = () => {
  const charts = useSelector<RootState, ChartsState>(state => state.charts);
  return useMemo(() => Object.values(charts), [charts]);
};

export const useFilterScope = (filter: Filter) => {
  const layout = useSelector<RootState, Layout>(
    state => state.dashboardLayout.present,
  );
  const charts = useCharts();

  return useMemo(() => {
    let topLevelTabs: string[] | undefined;
    const topElementId = layout[DASHBOARD_ROOT_ID].children[0];
    if (topElementId.startsWith('TABS-')) {
      topLevelTabs = layout[topElementId].children;
    }

    // no charts in scope
    if (filter.scope.rootPath.length === 0) {
      return undefined;
    }

    // all charts in scope
    // no charts excluded and no top level tabs
    // OR no charts excluded and every top level tab is in rootPath
    if (
      filter.scope.excluded.length === 0 &&
      (filter.scope.rootPath[0] === DASHBOARD_ROOT_ID ||
        (topLevelTabs &&
          topLevelTabs.every(topLevelTab =>
            filter.scope.rootPath.includes(topLevelTab),
          )))
    ) {
      return { all: [t('All charts')] };
    }

    // no charts excluded and not every top level tab in scope
    // returns "TAB1, TAB2"
    if (filter.scope.excluded.length === 0 && topLevelTabs) {
      return {
        tabs: filter.scope.rootPath
          .map(tabId => extractTabLabel(layout[tabId]))
          .filter(Boolean),
      };
    }

    const layoutCharts = Object.values(layout).filter(
      layoutElement => layoutElement.type === CHART_TYPE,
    );

    // no top level tabs, charts excluded
    // returns "CHART1, CHART2"
    if (filter.scope.rootPath[0] === DASHBOARD_ROOT_ID) {
      return {
        charts: charts
          .filter(chart => !filter.scope.excluded.includes(chart.id))
          .map(chart => {
            const layoutElement = layoutCharts.find(
              layoutChart => layoutChart.meta.chartId === chart.id,
            );
            return extractChartLabel(layoutElement);
          })
          .filter(Boolean),
      };
    }

    // top level tabs, charts excluded
    // returns "TAB1, TAB2, CHART1"
    if (topLevelTabs) {
      // We start assuming that all charts are in scope for all tabs in the root path
      const topLevelTabsInFullScope = [...filter.scope.rootPath];
      const layoutChartElementsInTabsInScope = layoutCharts.filter(element =>
        element.parents.some(parent =>
          topLevelTabsInFullScope.includes(parent),
        ),
      );
      // Exclude the tabs that contain excluded charts
      filter.scope.excluded.forEach(chartId => {
        const excludedIndex = topLevelTabsInFullScope.findIndex(tabId =>
          layoutChartElementsInTabsInScope
            .find(chart => chart.meta.chartId === chartId)
            ?.parents.includes(tabId),
        );
        if (excludedIndex > -1) {
          topLevelTabsInFullScope.splice(excludedIndex, 1);
        }
      });
      // Handle charts that are in scope but belong to excluded tabs.
      const chartsInExcludedTabs = charts
        .filter(chart => !filter.scope.excluded.includes(chart.id))
        .reduce((acc: LayoutItem[], chart) => {
          const layoutChartElementInExcludedTab =
            layoutChartElementsInTabsInScope.find(
              element =>
                element.meta.chartId === chart.id &&
                element.parents.every(
                  parent => !topLevelTabsInFullScope.includes(parent),
                ),
            );
          if (layoutChartElementInExcludedTab) {
            acc.push(layoutChartElementInExcludedTab);
          }
          return acc;
        }, []);
      // Join tab names and chart names
      return {
        tabs: topLevelTabsInFullScope
          .map(tabId => extractTabLabel(layout[tabId]))
          .filter(Boolean),
        charts: chartsInExcludedTabs.map(extractChartLabel).filter(Boolean),
      };
    }

    return undefined;
  }, [charts, filter.scope.excluded, filter.scope.rootPath, layout]);
};
