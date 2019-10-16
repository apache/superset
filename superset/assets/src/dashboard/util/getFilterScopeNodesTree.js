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
import { DASHBOARD_ROOT_ID } from './constants';
import {
  CHART_TYPE,
  DASHBOARD_ROOT_TYPE,
  TAB_TYPE,
} from '../util/componentTypes';

const FILTER_SCOPE_CONTAINER_TYPES = [TAB_TYPE, DASHBOARD_ROOT_TYPE];

export default function getFilterScopeNodesTree({
  components = {},
  isSingleEditMode = true,
  checkedFilterFields = [],
  selectedChartId,
}) {
  function traverse(currentNode) {
    if (!currentNode) {
      return null;
    }

    const type = currentNode.type;
    if (CHART_TYPE === type && currentNode.meta.chartId) {
      const chartNode = {
        value: currentNode.meta.chartId,
        label:
          currentNode.meta.sliceName || `${type} ${currentNode.meta.chartId}`,
        type,
        showCheckbox: selectedChartId !== currentNode.meta.chartId,
      };

      if (isSingleEditMode) {
        return chartNode;
      }

      return {
        ...chartNode,
        children: checkedFilterFields.map(filterField => ({
          value: `${currentNode.meta.chartId}:${filterField}`,
          label: `${currentNode.meta.chartId}:${filterField}`,
          type: 'filter_box',
          showCheckbox: false,
        })),
      };
    }

    let children = [];
    if (currentNode.children && currentNode.children.length) {
      currentNode.children.forEach(child => {
        const cNode = traverse(components[child]);

        const childType = components[child].type;
        if (FILTER_SCOPE_CONTAINER_TYPES.includes(childType)) {
          children.push(cNode);
        } else {
          children = children.concat(cNode);
        }
      });
    }

    if (FILTER_SCOPE_CONTAINER_TYPES.includes(type)) {
      let label = '';
      if (type === DASHBOARD_ROOT_TYPE) {
        label = 'All dashboard';
      } else {
        label =
          currentNode.meta && currentNode.meta.text
            ? currentNode.meta.text
            : `${type} ${currentNode.id}`;
      }

      return {
        value: currentNode.id,
        label,
        type,
        children,
      };
    }

    return children;
  }

  if (Object.keys(components).length === 0) {
    return [];
  }

  const root = traverse(components[DASHBOARD_ROOT_ID]);
  return [
    {
      ...root,
    },
  ];
}
