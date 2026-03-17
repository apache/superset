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
  Filter,
  Divider,
  NativeFilterType,
  NativeFilterTarget,
  ChartCustomization,
  ChartCustomizationType,
  ChartCustomizationDivider,
} from '@superset-ui/core';
import { getInitialDataMask } from 'src/dataMask/reducer';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import {
  NativeFiltersFormItem,
  NativeFilterDivider,
  ChartCustomizationsFormItem,
} from '../types';

type FilterFormInput =
  | NativeFiltersFormItem
  | NativeFilterDivider
  | Filter
  | Divider
  | ChartCustomizationsFormItem
  | ChartCustomization
  | ChartCustomizationDivider;

type NativeFilterFormOrSaved = NativeFiltersFormItem | Filter;

function isCustomizationType(
  formInputs: FilterFormInput,
): formInputs is
  | ChartCustomizationsFormItem
  | ChartCustomization
  | ChartCustomizationDivider {
  return (
    'type' in formInputs &&
    (formInputs.type === ChartCustomizationType.ChartCustomization ||
      formInputs.type === ChartCustomizationType.Divider)
  );
}

function isDividerType(
  formInputs: FilterFormInput,
): formInputs is NativeFilterDivider | Divider {
  return formInputs.type === NativeFilterType.Divider;
}

function isFormInput(
  formInputs: NativeFilterFormOrSaved,
): formInputs is NativeFiltersFormItem {
  return 'dataset' in formInputs;
}

function transformDivider(
  id: string,
  formInputs: NativeFilterDivider | Divider,
): Divider {
  return {
    id,
    type: NativeFilterType.Divider,
    title: formInputs.title,
    description: formInputs.description,
    scope: {
      rootPath: [DASHBOARD_ROOT_ID],
      excluded: [],
    },
  };
}

function buildFilterTarget(
  formInputs: NativeFiltersFormItem,
): Partial<NativeFilterTarget> {
  const target: Partial<NativeFilterTarget> = {};

  if (formInputs.dataset) {
    target.datasetId =
      typeof formInputs.dataset === 'object'
        ? formInputs.dataset.value
        : formInputs.dataset;
  }

  if (formInputs.dataset && formInputs.column) {
    target.column = { name: formInputs.column };
  }

  return target;
}

function transformFormInput(
  id: string,
  formInputs: NativeFiltersFormItem,
): Filter {
  const defaultScope = {
    rootPath: [DASHBOARD_ROOT_ID],
    excluded: [],
  };

  return {
    id,
    type: NativeFilterType.NativeFilter,
    name: formInputs.name,
    filterType: formInputs.filterType,
    description: (formInputs.description || '').trim(),
    targets: [buildFilterTarget(formInputs)],
    scope: formInputs.scope || defaultScope,
    controlValues: formInputs.controlValues ?? {},
    defaultDataMask: formInputs.defaultDataMask ?? getInitialDataMask(),
    cascadeParentIds: formInputs.dependencies || [],
    adhoc_filters: formInputs.adhoc_filters,
    time_range: formInputs.time_range,
    granularity_sqla: formInputs.granularity_sqla,
    sortMetric: formInputs.sortMetric ?? null,
    requiredFirst: formInputs.requiredFirst
      ? Object.values(formInputs.requiredFirst).find(rf => rf)
      : undefined,
  };
}

function transformSavedFilter(id: string, filter: Filter): Filter {
  return {
    ...filter,
    id,
    description: (filter.description || '').trim(),
  };
}

function transformFilter(
  id: string,
  formInputs: NativeFilterFormOrSaved,
): Filter {
  if (isFormInput(formInputs)) {
    return transformFormInput(id, formInputs);
  }
  return transformSavedFilter(id, formInputs);
}

export function transformFilterForSave(
  id: string,
  formInputs: FilterFormInput | undefined,
): Filter | Divider | undefined {
  if (!formInputs) {
    return undefined;
  }

  if (isCustomizationType(formInputs)) {
    return undefined;
  }

  if (isDividerType(formInputs)) {
    return transformDivider(id, formInputs);
  }

  return transformFilter(id, formInputs);
}
