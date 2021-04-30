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
import { flow, keyBy, mapValues } from 'lodash/fp';
import { flatMap, isEmpty } from 'lodash';

import { CHART_TYPE, TAB_TYPE } from './componentTypes';
import { getChartIdAndColumnFromFilterKey } from './getDashboardFilterKey';

function getImmuneChartIdsFromTabsNotInScope({ tabs = [], tabsInScope = [] }) {
  const chartsNotInScope = [];
  tabs.forEach(({ value: tab, children: tabChildren }) => {
    if (tabChildren && !tabsInScope.includes(tab)) {
      tabChildren.forEach(({ value: subTab, children: subTabChildren }) => {
        if (subTabChildren && !tabsInScope.includes(subTab)) {
          chartsNotInScope.push(
            ...subTabChildren.filter(({ type }) => type === CHART_TYPE),
          );
        }
      });
    }
  });

  // return chartId only
  return chartsNotInScope.map(({ value }) => value);
}
function getTabChildrenScope({
  tabScopes,
  parentNodeValue,
  forceAggregate = false,
  hasChartSiblings = false,
  tabChildren = [],
  immuneChartSiblings = [],
}) {
  // if all sub-tabs are in scope, or forceAggregate =  true
  // aggregate scope to parentNodeValue
  if (
    forceAggregate ||
    (!hasChartSiblings &&
      Object.entries(tabScopes).every(
        ([key, { scope }]) => scope && scope.length && key === scope[0],
      ))
  ) {
    // get all charts from tabChildren that is not in scope
    const immuneChartIdsFromTabsNotInScope = getImmuneChartIdsFromTabsNotInScope(
      {
        tabs: tabChildren,
        tabsInScope: flatMap(tabScopes, ({ scope }) => scope),
      },
    );
    const immuneChartIdsFromTabsInScope = flatMap(
      Object.values(tabScopes),
      ({ immune }) => immune,
    );
    const immuneCharts = [
      ...new Set([
        ...immuneChartIdsFromTabsNotInScope,
        ...immuneChartIdsFromTabsInScope,
      ]),
    ];
    return {
      scope: [parentNodeValue],
      immune: immuneCharts,
    };
  }

  const componentsInScope = Object.values(tabScopes).filter(
    ({ scope }) => scope && scope.length,
  );
  return {
    scope: flatMap(componentsInScope, ({ scope }) => scope),
    immune: componentsInScope.length
      ? flatMap(componentsInScope, ({ immune }) => immune)
      : flatMap(Object.values(tabScopes), ({ immune }) => immune).concat(
          immuneChartSiblings,
        ),
  };
}

function traverse({ currentNode = {}, filterId, checkedChartIds = [] }) {
  if (!currentNode) {
    return {};
  }

  const { value: currentValue, children } = currentNode;
  const chartChildren = children.filter(({ type }) => type === CHART_TYPE);
  const tabChildren = children.filter(({ type }) => type === TAB_TYPE);

  const chartsImmune = chartChildren
    .filter(
      ({ value }) => filterId !== value && !checkedChartIds.includes(value),
    )
    .map(({ value }) => value);
  const tabScopes = flow(
    keyBy(child => child.value),
    mapValues(child =>
      traverse({
        currentNode: child,
        filterId,
        checkedChartIds,
      }),
    ),
  )(tabChildren);

  // if any chart type child is in scope,
  // no matter has tab children or not, current node should be scope
  if (
    !isEmpty(chartChildren) &&
    chartChildren.some(({ value }) => checkedChartIds.includes(value))
  ) {
    if (isEmpty(tabChildren)) {
      return { scope: [currentValue], immune: chartsImmune };
    }

    const { scope, immune } = getTabChildrenScope({
      tabScopes,
      parentNodeValue: currentValue,
      forceAggregate: true,
      tabChildren,
    });
    return {
      scope,
      immune: chartsImmune.concat(immune),
    };
  }

  // has tab children but only some sub-tab in scope
  if (tabChildren.length) {
    return getTabChildrenScope({
      tabScopes,
      parentNodeValue: currentValue,
      hasChartSiblings: !isEmpty(chartChildren),
      tabChildren,
      immuneChartSiblings: chartsImmune,
    });
  }

  // no tab children and no chart children in scope
  return {
    scope: [],
    immune: chartsImmune,
  };
}

export default function getFilterScopeFromNodesTree({
  filterKey,
  nodes = [],
  checkedChartIds = [],
}) {
  if (nodes.length) {
    const { chartId } = getChartIdAndColumnFromFilterKey(filterKey);
    return traverse({
      currentNode: nodes[0],
      filterId: chartId,
      checkedChartIds,
    });
  }

  return {};
}
