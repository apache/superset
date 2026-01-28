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
import type { FormInstance } from '@superset-ui/core/components';
import { nanoid } from 'nanoid';
import { getInitialDataMask } from 'src/dataMask/reducer';
import {
  FilterConfiguration,
  NativeFilterType,
  NativeFilterTarget,
  Filter,
  Divider,
  ChartCustomizationType,
  ChartCustomizationConfiguration,
  ChartCustomization,
  ChartCustomizationDivider,
} from '@superset-ui/core';
import { logging } from '@apache-superset/core';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import {
  ChartCustomizationsForm,
  FilterChangesType,
  FilterRemoval,
  NativeFiltersForm,
  ItemType,
} from './types';

export const REMOVAL_DELAY_SECS = 5;

export const hasCircularDependency = (
  dependencyMap: Map<string, string[]>,
  filterId: string,
  trace: string[] = [],
): boolean => {
  if (trace.includes(filterId)) {
    return true;
  }
  const dependencies = dependencyMap.get(filterId);
  if (dependencies) {
    return dependencies.some(dependency =>
      hasCircularDependency(dependencyMap, dependency, [...trace, filterId]),
    );
  }
  return false;
};

export const validateForm = async (
  form: FormInstance<NativeFiltersForm>,
  currentFilterId: string,
  setCurrentFilterId: Function,
) => {
  try {
    let formValues: NativeFiltersForm;
    try {
      formValues = (await form.validateFields()) as NativeFiltersForm;
    } catch (error) {
      // In Jest tests in chain of tests, Ant generate `outOfDate` error so need to catch it here
      if (!error?.errorFields?.length && error?.outOfDate) {
        formValues = error.values;
      } else {
        throw error;
      }
    }
    return formValues;
  } catch (error) {
    logging.warn('Filter configuration failed:', error);

    if (!error.errorFields?.length) return null; // not a validation error

    // the name is in array format since the fields are nested
    type ErrorFields = { name: ['filters', string, string] }[];
    const errorFields = error.errorFields as ErrorFields;
    // filter id is the second item in the field name
    if (!errorFields.some(field => field.name[1] === currentFilterId)) {
      // switch to the first tab that had a validation error
      const filterError = errorFields.find(
        field => field.name[0] === 'filters',
      );
      if (filterError) {
        const filterId = filterError.name[1];
        setCurrentFilterId(filterId);
      }
    }
    return null;
  }
};

export const createHandleSave =
  (
    saveForm: Function,
    filterChanges: FilterChangesType,
    values: NativeFiltersForm,
    filterConfigMap: Record<string, Filter | Divider>,
  ) =>
  async () => {
    const transformFilter = (id: string) => {
      const formInputs = values.filters?.[id] || filterConfigMap[id];
      if (!formInputs) {
        return undefined;
      }
      if (formInputs.type === NativeFilterType.Divider) {
        return {
          id,
          type: NativeFilterType.Divider,
          scope: {
            rootPath: [DASHBOARD_ROOT_ID],
            excluded: [],
          },
          title: formInputs.title,
          description: formInputs.description,
        };
      }

      const target: Partial<NativeFilterTarget> = {};
      if (formInputs.dataset) {
        target.datasetId = formInputs.dataset.value;
      }
      if (formInputs.dataset && formInputs.column) {
        target.column = { name: formInputs.column };
      }

      return {
        id,
        adhoc_filters: formInputs.adhoc_filters,
        time_range: formInputs.time_range,
        controlValues: formInputs.controlValues ?? {},
        granularity_sqla: formInputs.granularity_sqla,
        requiredFirst: Object.values(formInputs.requiredFirst ?? {}).find(
          rf => rf,
        ),
        name: formInputs.name,
        filterType: formInputs.filterType,
        targets: [target],
        defaultDataMask: formInputs.defaultDataMask ?? getInitialDataMask(),
        cascadeParentIds: formInputs.dependencies || [],
        scope: formInputs.scope,
        sortMetric: formInputs.sortMetric,
        type: formInputs.type,
        description: (formInputs.description || '').trim(),
      };
    };

    const transformedModified = filterChanges.modified
      .map(transformFilter)
      .filter(Boolean);

    const newFilterChanges = {
      ...filterChanges,
      modified: transformedModified,
    };
    await saveForm(newFilterChanges);
  };

export const createHandleRemoveItem =
  (
    setRemovedFilters: (
      value:
        | ((
            prevState: Record<string, FilterRemoval>,
          ) => Record<string, FilterRemoval>)
        | Record<string, FilterRemoval>,
    ) => void,
    setOrderedFilters: (
      val: string[] | ((prevState: string[]) => string[]),
    ) => void,
    setSaveAlertVisible: Function,
    removeFilter: (filterId: string) => void,
  ) =>
  (filterId: string) => {
    const completeFilterRemoval = (filterId: string) => {
      // the filter state will actually stick around in the form,
      // and the filterConfig/newFilterIds, but we use removedFilters
      // to mark it as removed.
      setRemovedFilters(removedFilters => ({
        ...removedFilters,
        [filterId]: { isPending: false },
      }));
      setOrderedFilters((orderedFilters: string[]) =>
        orderedFilters.filter(filter => filter !== filterId),
      );
    };

    // first set up the timer to completely remove it
    const timerId = window.setTimeout(() => {
      completeFilterRemoval(filterId);
    }, REMOVAL_DELAY_SECS * 1000);
    // mark the filter state as "removal in progress"
    setRemovedFilters(removedFilters => ({
      ...removedFilters,
      [filterId]: { isPending: true, timerId },
    }));
    removeFilter(filterId);
    // eslint-disable-next-line no-param-reassign
    setSaveAlertVisible(false);
  };

export const NATIVE_FILTER_PREFIX = 'NATIVE_FILTER-';
export const NATIVE_FILTER_DIVIDER_PREFIX = 'NATIVE_FILTER_DIVIDER-';

export const isNativeFilter = (id: string): boolean =>
  id.startsWith(NATIVE_FILTER_PREFIX);

export const isNativeFilterDivider = (id: string): boolean =>
  id.startsWith(NATIVE_FILTER_DIVIDER_PREFIX);

export const generateFilterId = (type: NativeFilterType): string => {
  const prefix =
    type === NativeFilterType.NativeFilter
      ? NATIVE_FILTER_PREFIX
      : NATIVE_FILTER_DIVIDER_PREFIX;
  return `${prefix}${nanoid()}`;
};

export const getFilterIds = (config: FilterConfiguration) =>
  config.map(filter => filter.id);

export const createHandleCustomizationSave =
  (
    saveForm: Function,
    filterChanges: FilterChangesType,
    values: ChartCustomizationsForm,
    customizationsConfigMap: Record<
      string,
      ChartCustomization | ChartCustomizationDivider
    >,
  ) =>
  async () => {
    const transformCustomization = (id: string) => {
      const formInputs = values.filters?.[id] || customizationsConfigMap[id];
      if (!formInputs) {
        return undefined;
      }
      if (formInputs.type === ChartCustomizationType.Divider) {
        return {
          id,
          removed: false,
          customization: {
            name: formInputs.title,
            dataset: null,
            column: null,
          },
        };
      }

      const datasetValue =
        formInputs.dataset && typeof formInputs.dataset === 'object'
          ? formInputs.dataset.value
          : formInputs.dataset;

      return {
        id,
        title: formInputs.name,
        description: (formInputs.description || '').trim(),
        removed: false,
        chartId:
          (formInputs as any).chartId ||
          (customizationsConfigMap[id] as any)?.chartId,
        customization: {
          name: formInputs.name || '',
          dataset: datasetValue,
          datasetInfo: formInputs.datasetInfo,
          filterType: formInputs.filterType,
          column: formInputs.column || null,
          description: (formInputs.description || '').trim(),
          hasDefaultValue: formInputs.hasDefaultValue,
          defaultValue: formInputs.defaultValue,
          isRequired: formInputs.controlValues?.enableEmptyFilter || false,
          selectFirst: formInputs.selectFirst,
          defaultDataMask: formInputs.defaultDataMask,
          defaultValueQueriesData: formInputs.defaultValueQueriesData,
          aggregation: formInputs.aggregation,
          canSelectMultiple: formInputs.canSelectMultiple ?? true,
          controlValues: formInputs.controlValues ?? {},
        },
      };
    };

    const transformedModified = filterChanges.modified
      .map(transformCustomization)
      .filter(Boolean);

    const deletedCustomizations = filterChanges.deleted.map(id => ({
      id,
      removed: true,
      customization: {
        name: '',
        dataset: null,
        column: null,
      },
    }));

    await saveForm([...transformedModified, ...deletedCustomizations]);
  };

export const CHART_CUSTOMIZATION_PREFIX = 'CHART_CUSTOMIZATION-';
export const CHART_CUSTOMIZATION_DIVIDER_PREFIX =
  'CHART_CUSTOMIZATION_DIVIDER-';
export const LEGACY_GROUPBY_PREFIX = 'groupby_';

export const isChartCustomization = (id: string): boolean =>
  id.startsWith(CHART_CUSTOMIZATION_PREFIX) ||
  id.startsWith(LEGACY_GROUPBY_PREFIX);

export const isChartCustomizationDivider = (id: string): boolean =>
  id.startsWith(CHART_CUSTOMIZATION_DIVIDER_PREFIX);

export const generateChartCustomizationId = (
  type: ChartCustomizationType,
): string => {
  const prefix =
    type === ChartCustomizationType.ChartCustomization
      ? CHART_CUSTOMIZATION_PREFIX
      : CHART_CUSTOMIZATION_DIVIDER_PREFIX;
  return `${prefix}${nanoid()}`;
};

export const getChartCustomizationIds = (
  config: ChartCustomizationConfiguration,
) => config.map(filter => filter.id);

export const isFilterId = (id: string): boolean =>
  id.startsWith(NATIVE_FILTER_PREFIX) ||
  id.startsWith(NATIVE_FILTER_DIVIDER_PREFIX);

export const isChartCustomizationId = (id: string): boolean =>
  id.startsWith(CHART_CUSTOMIZATION_PREFIX) ||
  id.startsWith(CHART_CUSTOMIZATION_DIVIDER_PREFIX) ||
  id.startsWith(LEGACY_GROUPBY_PREFIX);

export const getItemType = (id: string): ItemType => {
  if (isFilterId(id)) return 'filter';
  if (isChartCustomizationId(id)) return 'customization';
  throw new Error(`Unknown item type for id: ${id}`);
};

export const getItemTypeInfo = (type: ItemType) => ({
  dividerPrefix:
    type === 'filter'
      ? NATIVE_FILTER_DIVIDER_PREFIX
      : CHART_CUSTOMIZATION_DIVIDER_PREFIX,
  dividerType:
    type === 'filter'
      ? NativeFilterType.Divider
      : ChartCustomizationType.Divider,
  itemTypeName: type === 'filter' ? 'filter' : 'customization',
});

export const isDivider = (id: string): boolean =>
  isNativeFilterDivider(id) || isChartCustomizationDivider(id);

export const transformDividerId = (
  oldId: string,
  targetType: ItemType,
): string => {
  const hash = oldId.split('-').pop();
  const { dividerPrefix } = getItemTypeInfo(targetType);
  return `${dividerPrefix}${hash}`;
};
