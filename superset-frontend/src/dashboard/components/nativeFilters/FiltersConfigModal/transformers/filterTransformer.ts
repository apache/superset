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
import {
  buildNativeFilterTarget,
  buildNativeFilterDefaultDataMask,
} from './buildTarget';

type FilterFormInput =
  | NativeFiltersFormItem
  | NativeFilterDivider
  | Filter
  | Divider
  | ChartCustomizationsFormItem
  | ChartCustomization
  | ChartCustomizationDivider;

type NativeFilterFormOrSaved = NativeFiltersFormItem | Filter;

/**
 * `requiredFirst` is persisted as `true` or left unset. Older dashboards may
 * hold a non-boolean in its place: the checkbox change event the config form
 * used to store, e.g. `{ nativeEvent: {...}, target: { checked: false, ... } }`,
 * or the empty form object `{}` that was saved verbatim for filters without a
 * dataset. This reads such an event by its `checked` flag and treats anything
 * else that is not `true` as unset. It is used for saved filters that are
 * re-sent without their form being loaded.
 */
export function normalizeRequiredFirst(value: unknown): true | undefined {
  if (value === true) {
    return true;
  }
  const checked = (value as { target?: { checked?: unknown } } | null)?.target
    ?.checked;
  return checked === true ? true : undefined;
}

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
  // A saved filter always carries a serialized `targets` array; a form item
  // never does. Keying this off `dataset` misclassified filter types with no
  // dataset control (e.g. `filter_time`) as already saved.
  return !('targets' in formInputs);
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
  return buildNativeFilterTarget(formInputs);
}

/**
 * Whether one entry of the form's `requiredFirst` map is on. The checkbox
 * handler writes booleans; any other value was seeded from a stored legacy
 * `requiredFirst` (see `normalizeRequiredFirst`), so fall back to the
 * control's own checkbox value, which is what the user sees in the form.
 */
function isRequiredFirstControlOn(
  value: unknown,
  controlValue: unknown,
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === undefined || value === null) {
    return false;
  }
  return controlValue === true;
}

function transformFormInput(
  id: string,
  formInputs: NativeFiltersFormItem,
): Filter {
  const defaultScope = {
    rootPath: [DASHBOARD_ROOT_ID],
    excluded: [],
  };

  const result: Filter & { time_grains?: string[] } = {
    id,
    type: NativeFilterType.NativeFilter,
    name: formInputs.name,
    filterType: formInputs.filterType,
    description: (formInputs.description || '').trim(),
    targets: [buildFilterTarget(formInputs)],
    scope: formInputs.scope || defaultScope,
    controlValues: formInputs.controlValues ?? {},
    defaultDataMask: buildNativeFilterDefaultDataMask(
      formInputs,
      formInputs.defaultDataMask ?? getInitialDataMask(),
    ),
    cascadeParentIds: formInputs.dependencies || [],
    adhoc_filters: formInputs.adhoc_filters,
    time_range: formInputs.time_range,
    granularity_sqla: formInputs.granularity_sqla,
    sortMetric: formInputs.sortMetric,
    requiredFirst: Object.entries(formInputs.requiredFirst ?? {}).some(
      ([controlName, value]) =>
        isRequiredFirstControlOn(
          value,
          formInputs.controlValues?.[controlName],
        ),
    )
      ? true
      : undefined,
  };

  if (formInputs.time_grains?.length) {
    result.time_grains = formInputs.time_grains;
  }

  return result;
}

function transformSavedFilter(id: string, filter: Filter): Filter {
  const saved: Filter = {
    ...filter,
    id,
    description: (filter.description || '').trim(),
  };
  // Reached for filters marked modified without their form being loaded,
  // e.g. when cascade-parent cleanup rewrites them.
  if ('requiredFirst' in filter) {
    saved.requiredFirst = normalizeRequiredFirst(filter.requiredFirst);
  }
  return saved;
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
