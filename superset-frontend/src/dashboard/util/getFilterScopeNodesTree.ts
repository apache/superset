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
import { t } from '@apache-superset/core/ui';

import { DASHBOARD_ROOT_ID } from './constants';
import { CHART_TYPE, DASHBOARD_ROOT_TYPE, TAB_TYPE } from './componentTypes';
import { DashboardComponent, DashboardComponentMap } from '../types';

type FilterField = string | { chartId: number; column: string };

interface ScopeTreeNode {
  value: number | string;
  label: string;
  type: string;
  showCheckbox?: boolean;
  children: ScopeTreeNode[];
}

interface TraverseParams {
  currentNode?: DashboardComponent;
  components?: DashboardComponentMap;
  filterFields?: FilterField[];
  selectedChartId?: number;
}

const FILTER_SCOPE_CONTAINER_TYPES: string[] = [TAB_TYPE, DASHBOARD_ROOT_TYPE];

function traverse({
  currentNode,
  components = {},
  filterFields = [],
  selectedChartId,
}: TraverseParams): ScopeTreeNode | ScopeTreeNode[] | null {
  if (!currentNode) {
    return null;
  }

  const { type } = currentNode;
  if (CHART_TYPE === type && currentNode?.meta?.chartId) {
    const chartNode: ScopeTreeNode = {
      value: currentNode.meta.chartId,
      label:
        currentNode.meta.sliceName || `${type} ${currentNode.meta.chartId}`,
      type,
      showCheckbox: selectedChartId !== currentNode.meta.chartId,
      children: [],
    };

    return chartNode;
  }

  let children: ScopeTreeNode[] = [];
  if (currentNode.children?.length) {
    currentNode.children.forEach(child => {
      const childNodeTree = traverse({
        currentNode: components[child],
        components,
        filterFields,
        selectedChartId,
      });

      const childType = components[child].type;
      if (FILTER_SCOPE_CONTAINER_TYPES.includes(childType)) {
        if (childNodeTree && !Array.isArray(childNodeTree)) {
          children.push(childNodeTree);
        }
      } else if (Array.isArray(childNodeTree)) {
        children = children.concat(childNodeTree);
      } else if (childNodeTree) {
        children = children.concat(childNodeTree);
      }
    });
  }

  if (FILTER_SCOPE_CONTAINER_TYPES.includes(type)) {
    let label: string;
    if (type === DASHBOARD_ROOT_TYPE) {
      label = t('All charts');
    } else {
      label = currentNode.meta?.text
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

interface GetFilterScopeNodesTreeParams {
  components?: DashboardComponentMap;
  filterFields?: FilterField[];
  selectedChartId?: number;
}

export default function getFilterScopeNodesTree({
  components = {},
  filterFields = [],
  selectedChartId,
}: GetFilterScopeNodesTreeParams): ScopeTreeNode[] {
  if (isEmpty(components)) {
    return [];
  }

  const root = traverse({
    currentNode: components[DASHBOARD_ROOT_ID],
    components,
    filterFields,
    selectedChartId,
  });

  if (!root) {
    return [];
  }

  if (Array.isArray(root)) {
    return root;
  }

  return [
    {
      ...root,
    },
  ];
}
