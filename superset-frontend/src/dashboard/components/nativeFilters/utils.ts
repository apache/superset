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
import {
  ExtraFormData,
  QueryFormData,
  QueryObject,
  t,
} from '@superset-ui/core';
import { Charts, Layout, LayoutItem } from 'src/dashboard/types';
import {
  CHART_TYPE,
  DASHBOARD_ROOT_TYPE,
  TAB_TYPE,
} from 'src/dashboard/util/componentTypes';
import { FormInstance } from 'antd/lib/form';
import React, { RefObject } from 'react';
import {
  CascadeFilter,
  Filter,
  FilterType,
  NativeFiltersState,
  Scope,
  TreeItem,
} from './types';
import { DASHBOARD_ROOT_ID } from '../../util/constants';

export const useForceUpdate = () => {
  const [, updateState] = React.useState({});
  return React.useCallback(() => updateState({}), []);
};

export const isShowTypeInTree = ({ type, meta }: LayoutItem, charts?: Charts) =>
  (type === TAB_TYPE || type === CHART_TYPE || type === DASHBOARD_ROOT_TYPE) &&
  (!charts || charts[meta?.chartId]?.formData?.viz_type !== 'filter_box');

export const buildTree = (
  node: LayoutItem,
  treeItem: TreeItem,
  layout: Layout,
  charts: Charts,
  validNodes: string[],
) => {
  let itemToPass: TreeItem = treeItem;
  if (
    isShowTypeInTree(node, charts) &&
    node.type !== DASHBOARD_ROOT_TYPE &&
    validNodes.includes(node.id)
  ) {
    const currentTreeItem = {
      key: node.id,
      title: node.meta.sliceName || node.meta.text || node.id.toString(),
      children: [],
    };
    treeItem.children.push(currentTreeItem);
    itemToPass = currentTreeItem;
  }
  node.children.forEach(child =>
    buildTree(layout[child], itemToPass, layout, charts, validNodes),
  );
};

const addInvisibleParents = (layout: Layout, item: string) => [
  ...(layout[item]?.children || []),
  ...Object.values(layout)
    .filter(
      val =>
        val.parents &&
        val.parents[val.parents.length - 1] === item &&
        !isShowTypeInTree(layout[val.parents[val.parents.length - 1]]),
    )
    .map(({ id }) => id),
];

// Generate checked options for Ant tree from redux scope
const checkTreeItem = (
  checkedItems: string[],
  layout: Layout,
  items: string[],
  excluded: number[],
) => {
  items.forEach(item => {
    checkTreeItem(
      checkedItems,
      layout,
      addInvisibleParents(layout, item),
      excluded,
    );
    if (
      layout[item]?.type === CHART_TYPE &&
      !excluded.includes(layout[item]?.meta.chartId)
    ) {
      checkedItems.push(item);
    }
  });
};

export const getTreeCheckedItems = (scope: Scope, layout: Layout) => {
  const checkedItems: string[] = [];
  checkTreeItem(checkedItems, layout, [...scope.rootPath], [...scope.excluded]);
  return [...new Set(checkedItems)];
};

// Looking for first common parent for selected charts/tabs/tab
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

  // Get arrays of parents for selected charts
  const checkedItemParents = checkedKeys
    .filter(item => layout[item]?.type === CHART_TYPE)
    .map(key => {
      const parents = [DASHBOARD_ROOT_ID, ...(layout[key]?.parents || [])];
      return parents.filter(parent => isShowTypeInTree(layout[parent]));
    });
  // Sort arrays of parents to get first shortest array of parents,
  // that means on it's level of parents located common parent, from this place parents start be different
  checkedItemParents.sort((p1, p2) => p1.length - p2.length);
  const rootPath = checkedItemParents.map(
    parents => parents[checkedItemParents[0].length - 1],
  );

  const excluded: number[] = [];
  const isExcluded = (parent: string, item: string) =>
    rootPath.includes(parent) && !checkedKeys.includes(item);
  // looking for charts to be excluded: iterate over all charts
  // and looking for charts that have one of their parents in `rootPath` and not in selected items
  Object.entries(layout).forEach(([key, value]) => {
    if (
      value.type === CHART_TYPE &&
      [DASHBOARD_ROOT_ID, ...value.parents]?.find(parent =>
        isExcluded(parent, key),
      )
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

export const FilterTypeNames = {
  [FilterType.filter_select]: t('Select'),
  [FilterType.filter_range]: t('Range'),
};

export const setFilterFieldValues = (
  form: FormInstance,
  filterId: string,
  values: object,
) => {
  const formFilters = form.getFieldValue('filters');
  form.setFieldsValue({
    filters: {
      ...formFilters,
      [filterId]: {
        ...formFilters[filterId],
        ...values,
      },
    },
  });
};

export const isScopingAll = (scope: Scope) =>
  !scope || (scope.rootPath[0] === DASHBOARD_ROOT_ID && !scope.excluded.length);

export const getFormData = ({
  datasetId = 18,
  cascadingFilters = {},
  groupby,
  allowsMultipleValues = false,
  defaultValue,
  currentValue,
  inverseSelection,
  inputRef,
}: Partial<Filter> & {
  datasetId?: number;
  inputRef?: RefObject<HTMLInputElement>;
  cascadingFilters?: object;
  groupby: string;
}): Partial<QueryFormData> => ({
  adhoc_filters: [],
  datasource: `${datasetId}__table`,
  extra_filters: [],
  extra_form_data: cascadingFilters,
  granularity_sqla: 'ds',
  groupby: [groupby],
  inverseSelection,
  metrics: ['count'],
  multiSelect: allowsMultipleValues,
  row_limit: 10000,
  showSearch: true,
  currentValue,
  time_range: 'No filter',
  time_range_endpoints: ['inclusive', 'exclusive'],
  url_params: {},
  viz_type: 'filter_select',
  // TODO: need process per filter type after will be decided approach
  defaultValue,
  inputRef,
});

type AppendFormData = {
  filters: {
    val?: number | string | null;
  }[];
};

export const extractDefaultValue = {
  [FilterType.filter_select]: (appendFormData: AppendFormData) =>
    appendFormData.filters?.[0]?.val,
  [FilterType.filter_range]: (appendFormData: AppendFormData) => ({
    min: appendFormData.filters?.[0].val,
    max: appendFormData.filters?.[1].val,
  }),
};
