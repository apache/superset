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
import { isEmpty } from 'lodash';
import { CHART_TYPE, TAB_TYPE } from './componentTypes';
import { getDashboardFilterByKey } from './getDashboardFilterKey';

// filterKey: '107_region',
// nodes: [
//  { value, label, children:
//    [
//      { value1, label1, children1 },
//      { value2, label2, children2 },
//    ]
//  },
// ],
// checkedIds: [101]
//
// output {
//   { scope: [tab1, tab2], immune: [chart1, chart2] }
// }
export default function getFilterScopeFromNodesTree({
  filterKey,
  nodes = [],
  checkedChartIds = [],
}) {
  function getTabChildrenScope({
    tabScopes,
    parentNodeValue,
    forceAggregate = false,
  }) {
    // if all sub-tabs are in scope, or forceAggregate =  true
    // aggregate scope to parentNodeValue
    if (
      forceAggregate ||
      Object.entries(tabScopes).every(
        ([key, { scope }]) => scope.length && key === scope[0],
      )
    ) {
      return {
        scope: [parentNodeValue],
        immune: [].concat(
          ...Object.values(tabScopes).map(({ immune }) => immune),
        ),
      };
    }

    const componentsInScope = Object.values(tabScopes).filter(
      ({ scope }) => scope && scope.length,
    );
    const scopeValue = [].concat(
      ...componentsInScope.map(({ scope }) => scope),
    );
    const immuneValue = [].concat(
      ...componentsInScope.map(({ immune }) => immune),
    );

    return {
      scope: scopeValue,
      immune: immuneValue,
    };
  }

  function traverse({ currentNode, filterId }) {
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
    const tabScopes = tabChildren.reduce((map, child) => {
      const { value: tabValue } = child;
      return {
        ...map,
        [tabValue]: traverse({
          currentNode: child,
          filterId,
        }),
      };
    }, {});

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
      });
      return {
        scope,
        immune: chartsImmune.concat(immune),
      };
    }

    // has tab children but only some sub-tab in scope
    if (!isEmpty(tabChildren)) {
      return getTabChildrenScope({ tabScopes, parentNodeValue: currentValue });
    }

    // no tab children and no chart children in scope
    return {
      scope: [],
      immune: chartsImmune,
    };
  }

  const [chartId] = getDashboardFilterByKey(filterKey);
  if (nodes && nodes.length) {
    return traverse({
      currentNode: nodes[0],
      filterId: chartId,
    });
  }

  return {};
}
