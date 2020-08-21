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
import { t } from '@superset-ui/translation';

import { DASHBOARD_ROOT_ID } from './constants';
import {
  CHART_TYPE,
  DASHBOARD_ROOT_TYPE,
  TAB_TYPE,
} from '../util/componentTypes';

const FILTER_SCOPE_CONTAINER_TYPES = [TAB_TYPE, DASHBOARD_ROOT_TYPE];

function traverse({
  currentNode = {},
  components = {},
  filterFields = [],
  selectedChartId,
}) {
  if (!currentNode) {
    return null;
  }

  const type = currentNode.type;
  if (
    CHART_TYPE === type &&
    currentNode &&
    currentNode.meta &&
    currentNode.meta.chartId
  ) {
    const chartNode = {
      value: currentNode.meta.chartId,
      label:
        currentNode.meta.sliceName || `${type} ${currentNode.meta.chartId}`,
      type,
      showCheckbox: selectedChartId !== currentNode.meta.chartId,
    };

    return {
      ...chartNode,
      children: filterFields.map(filterField => ({
        value: `${currentNode.meta.chartId}:${filterField}`,
        label: `${chartNode.label}`,
        type: 'filter_box',
        showCheckbox: false,
      })),
    };
  }

  let children = [];
  if (currentNode.children && currentNode.children.length) {
    currentNode.children.forEach(child => {
      const childNodeTree = traverse({
        currentNode: components[child],
        components,
        filterFields,
        selectedChartId,
      });

      const childType = components[child].type;
      if (FILTER_SCOPE_CONTAINER_TYPES.includes(childType)) {
        children.push(childNodeTree);
      } else {
        children = children.concat(childNodeTree);
      }
    });
  }

  if (FILTER_SCOPE_CONTAINER_TYPES.includes(type)) {
    let label = null;
    if (type === DASHBOARD_ROOT_TYPE) {
      label = t('All charts');
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

export default function getFilterScopeNodesTree({
  components = {},
  filterFields = [],
  selectedChartId,
}) {
  if (isEmpty(components)) {
    return [];
  }

  const root = traverse({
    currentNode: components[DASHBOARD_ROOT_ID],
    components,
    filterFields,
    selectedChartId,
  });
  return [
    {
      ...root,
    },
  ];
}
