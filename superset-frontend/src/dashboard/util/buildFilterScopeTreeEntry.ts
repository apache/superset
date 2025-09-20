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
import { DashboardLayout } from '../types';
import getFilterScopeNodesTree from './getFilterScopeNodesTree';
import getFilterScopeParentNodes from './getFilterScopeParentNodes';
import getKeyForFilterScopeTree from './getKeyForFilterScopeTree';
import getSelectedChartIdForFilterScopeTree from './getSelectedChartIdForFilterScopeTree';

interface FilterScopeMapItem {
  checked?: number[];
  expanded?: string[];
}

interface FilterScopeMap {
  [key: string]: FilterScopeMapItem;
}

interface FilterScopeTreeEntry {
  nodes: any[];
  nodesFiltered: any[];
  checked: string[];
  expanded: string[];
}

interface BuildFilterScopeTreeEntryProps {
  checkedFilterFields?: string[];
  activeFilterField?: string;
  filterScopeMap?: FilterScopeMap;
  layout?: DashboardLayout;
}

export default function buildFilterScopeTreeEntry({
  checkedFilterFields = [],
  activeFilterField,
  filterScopeMap = {},
  layout = {},
}: BuildFilterScopeTreeEntryProps): Record<string, FilterScopeTreeEntry> {
  const key = getKeyForFilterScopeTree({
    checkedFilterFields,
    activeFilterField,
  });
  const editingList = activeFilterField
    ? [activeFilterField]
    : checkedFilterFields;
  const selectedChartId = getSelectedChartIdForFilterScopeTree({
    checkedFilterFields,
    activeFilterField,
  });
  const nodes = getFilterScopeNodesTree({
    components: layout,
    filterFields: editingList,
    selectedChartId,
  });
  const checkedChartIdSet = new Set<string>();
  editingList.forEach(filterField => {
    (filterScopeMap[filterField]?.checked || []).forEach(chartId => {
      checkedChartIdSet.add(`${chartId}:${filterField}`);
    });
  });
  const checked = [...checkedChartIdSet];
  const expanded = filterScopeMap[key]
    ? filterScopeMap[key].expanded || []
    : getFilterScopeParentNodes(nodes, 1);

  return {
    [key]: {
      nodes,
      nodesFiltered: [...nodes],
      checked,
      expanded,
    },
  };
}
