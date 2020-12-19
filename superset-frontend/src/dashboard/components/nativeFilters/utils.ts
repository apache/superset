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
import { ExtraFormData, QueryObject } from '@superset-ui/core';
import { Charts, Layout, LayoutItem } from 'src/dashboard/types';
import {
  CHART_TYPE,
  DASHBOARD_ROOT_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from 'src/dashboard/util/componentTypes';
import {
  CascadeFilter,
  Filter,
  NativeFiltersState,
  Scope,
  TreeItem,
} from './types';

export const isShowTypeInTree = ({ type, meta }: LayoutItem, charts?: Charts) =>
  (type === TABS_TYPE ||
    type === TAB_TYPE ||
    type === CHART_TYPE ||
    type === DASHBOARD_ROOT_TYPE) &&
  (!charts || charts[meta?.chartId]?.formData?.viz_type !== 'filter_box');

export const buildTree = (
  node: LayoutItem,
  treeItem: TreeItem,
  layout: Layout,
  charts: Charts,
) => {
  let itemToPass: TreeItem = treeItem;
  if (isShowTypeInTree(node, charts) && node.type !== DASHBOARD_ROOT_TYPE) {
    const currentTreeItem = {
      key: node.id,
      title: node.meta.sliceName || node.meta.text || node.id.toString(),
      children: [],
    };
    treeItem.children.push(currentTreeItem);
    itemToPass = currentTreeItem;
  }
  node.children.forEach(child =>
    buildTree(layout[child], itemToPass, layout, charts),
  );
};

export const findFilterScope = (
  checkedKeys: string[],
  layout: Layout,
): Scope => {
  if (!checkedKeys.length) {
    return {
      rootPath: [],
      excluded: [],
    };
  }
  const checkedItemParents = checkedKeys.map(key =>
    (layout[key].parents || []).filter(parent =>
      isShowTypeInTree(layout[parent]),
    ),
  );
  checkedItemParents.sort((p1, p2) => p1.length - p2.length);
  const rootPath = checkedItemParents.map(
    parents => parents[checkedItemParents[0].length - 1],
  );

  const excluded: number[] = [];
  const isExcluded = (parent: string, item: string) =>
    rootPath.includes(parent) && !checkedKeys.includes(item);

  Object.entries(layout).forEach(([key, value]) => {
    if (
      value.type === CHART_TYPE &&
      value.parents?.find(parent => isExcluded(parent, key))
    ) {
      excluded.push(value.meta.chartId);
    }
  });

  return {
    rootPath: [...new Set(rootPath)],
    excluded,
  };
};

export function mergeExtraFormData(
  originalExtra: ExtraFormData,
  newExtra: ExtraFormData,
): ExtraFormData {
  const {
    override_form_data: originalOverride = {},
    append_form_data: originalAppend = {},
  } = originalExtra;
  const {
    override_form_data: newOverride = {},
    append_form_data: newAppend = {},
  } = newExtra;

  const appendKeys = new Set([
    ...Object.keys(originalAppend),
    ...Object.keys(newAppend),
  ]);
  const appendFormData: Partial<QueryObject> = {};
  appendKeys.forEach(key => {
    appendFormData[key] = [
      // @ts-ignore
      ...(originalAppend[key] || []),
      // @ts-ignore
      ...(newAppend[key] || []),
    ];
  });

  return {
    override_form_data: {
      ...originalOverride,
      ...newOverride,
    },
    append_form_data: appendFormData,
  };
}

export function getExtraFormData(
  nativeFilters: NativeFiltersState,
): ExtraFormData {
  let extraFormData: ExtraFormData = {};
  Object.keys(nativeFilters.filters).forEach(key => {
    const filterState = nativeFilters.filtersState[key] || {};
    const { extraFormData: newExtra = {} } = filterState;
    extraFormData = mergeExtraFormData(extraFormData, newExtra);
  });
  return extraFormData;
}

export function mapParentFiltersToChildren(
  filters: Filter[],
): { [id: string]: Filter[] } {
  const cascadeChildren = {};
  filters.forEach(filter => {
    const [parentId] = filter.cascadeParentIds || [];
    if (parentId) {
      if (!cascadeChildren[parentId]) {
        cascadeChildren[parentId] = [];
      }
      cascadeChildren[parentId].push(filter);
    }
  });
  return cascadeChildren;
}

export function buildCascadeFiltersTree(filters: Filter[]): CascadeFilter[] {
  const cascadeChildren = mapParentFiltersToChildren(filters);

  const getCascadeFilter = (filter: Filter): CascadeFilter => {
    const children = cascadeChildren[filter.id] || [];
    return {
      ...filter,
      cascadeChildren: children.map(getCascadeFilter),
    };
  };

  return filters
    .filter(filter => !filter.cascadeParentIds?.length)
    .map(getCascadeFilter);
}
