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
import { FormInstance } from 'src/components';
import shortid from 'shortid';
import { getInitialDataMask } from 'src/dataMask/reducer';
import {
  Filter,
  FilterConfiguration,
  NativeFilterType,
  Divider,
  NativeFilterTarget,
  logging,
} from '@superset-ui/core';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { FilterRemoval, NativeFiltersForm } from './types';

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
    filterConfigMap: Record<string, Filter | Divider>,
    filterIds: string[],
    removedFilters: Record<string, FilterRemoval>,
    saveForm: Function,
    values: NativeFiltersForm,
  ) =>
  async () => {
    const newFilterConfig: FilterConfiguration = filterIds
      .filter(id => !removedFilters[id])
      .map(id => {
        // create a filter config object from the form inputs
        const formInputs = values.filters?.[id];
        // if user didn't open a filter, return the original config
        if (!formInputs) return filterConfigMap[id];
        if (formInputs.type === NativeFilterType.DIVIDER) {
          return {
            id,
            type: NativeFilterType.DIVIDER,
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
          // for now there will only ever be one target
          targets: [target],
          defaultDataMask: formInputs.defaultDataMask ?? getInitialDataMask(),
          cascadeParentIds: formInputs.dependencies || [],
          scope: formInputs.scope,
          sortMetric: formInputs.sortMetric,
          type: formInputs.type,
          description: (formInputs.description || '').trim(),
        };
      });

    await saveForm(newFilterConfig);
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
    setSaveAlertVisible(false);
  };

export const NATIVE_FILTER_PREFIX = 'NATIVE_FILTER-';
export const NATIVE_FILTER_DIVIDER_PREFIX = 'NATIVE_FILTER_DIVIDER-';
export const generateFilterId = (type: NativeFilterType) => {
  const prefix =
    type === NativeFilterType.NATIVE_FILTER
      ? NATIVE_FILTER_PREFIX
      : NATIVE_FILTER_DIVIDER_PREFIX;
  return `${prefix}${shortid.generate()}`;
};

export const getFilterIds = (config: FilterConfiguration) =>
  config.map(filter => filter.id);
