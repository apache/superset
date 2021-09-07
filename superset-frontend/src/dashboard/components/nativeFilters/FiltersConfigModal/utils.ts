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
import { FormInstance } from 'antd/lib/form';
import shortid from 'shortid';
import { getInitialDataMask } from 'src/dataMask/reducer';
import { FilterRemoval, NativeFiltersForm } from './types';
import { Filter, FilterConfiguration, Target } from '../types';

export const REMOVAL_DELAY_SECS = 5;

export const validateForm = async (
  form: FormInstance<NativeFiltersForm>,
  currentFilterId: string,
  filterConfigMap: Record<string, Filter>,
  filterIds: string[],
  removedFilters: Record<string, FilterRemoval>,
  setCurrentFilterId: Function,
) => {
  const addValidationError = (
    filterId: string,
    field: string,
    error: string,
  ) => {
    const fieldError = {
      name: ['filters', filterId, field],
      errors: [error],
    };
    form.setFields([fieldError]);
  };

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

    const validateCycles = (filterId: string, trace: string[] = []) => {
      if (trace.includes(filterId)) {
        addValidationError(
          filterId,
          'parentFilter',
          'Cannot create cyclic hierarchy',
        );
      }
      const parentId = formValues.filters[filterId]
        ? formValues.filters[filterId].parentFilter?.value
        : filterConfigMap[filterId]?.cascadeParentIds?.[0];
      if (parentId) {
        validateCycles(parentId, [...trace, filterId]);
      }
    };

    filterIds
      .filter(id => !removedFilters[id])
      .forEach(filterId => validateCycles(filterId));

    return formValues;
  } catch (error) {
    console.warn('Filter configuration failed:', error);

    if (!error.errorFields || !error.errorFields.length) return null; // not a validation error

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
        setCurrentFilterId(filterError.name[1]);
      }
    }
    return null;
  }
};

export const createHandleSave = (
  filterConfigMap: Record<string, Filter>,
  filterIds: string[],
  removedFilters: Record<string, FilterRemoval>,
  saveForm: Function,
  values: NativeFiltersForm,
) => async () => {
  const newFilterConfig: FilterConfiguration = filterIds
    .filter(id => !removedFilters[id])
    .map(id => {
      // create a filter config object from the form inputs
      const formInputs = values.filters[id];
      // if user didn't open a filter, return the original config
      if (!formInputs) return filterConfigMap[id];
      const target: Partial<Target> = {};
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
        cascadeParentIds: formInputs.parentFilter
          ? [formInputs.parentFilter.value]
          : [],
        scope: formInputs.scope,
        sortMetric: formInputs.sortMetric,
        type: formInputs.type,
      };
    });

  await saveForm(newFilterConfig);
};

export const createHandleTabEdit = (
  setRemovedFilters: (
    value:
      | ((
          prevState: Record<string, FilterRemoval>,
        ) => Record<string, FilterRemoval>)
      | Record<string, FilterRemoval>,
  ) => void,
  setSaveAlertVisible: Function,
  addFilter: Function,
) => (filterId: string, action: 'add' | 'remove') => {
  const completeFilterRemoval = (filterId: string) => {
    // the filter state will actually stick around in the form,
    // and the filterConfig/newFilterIds, but we use removedFilters
    // to mark it as removed.
    setRemovedFilters(removedFilters => ({
      ...removedFilters,
      [filterId]: { isPending: false },
    }));
  };

  if (action === 'remove') {
    // first set up the timer to completely remove it
    const timerId = window.setTimeout(
      () => completeFilterRemoval(filterId),
      REMOVAL_DELAY_SECS * 1000,
    );
    // mark the filter state as "removal in progress"
    setRemovedFilters(removedFilters => ({
      ...removedFilters,
      [filterId]: { isPending: true, timerId },
    }));
    setSaveAlertVisible(false);
  } else if (action === 'add') {
    addFilter();
  }
};

export const NATIVE_FILTER_PREFIX = 'NATIVE_FILTER-';
export const generateFilterId = () =>
  `${NATIVE_FILTER_PREFIX}${shortid.generate()}`;

export const getFilterIds = (config: FilterConfiguration) =>
  config.map(filter => filter.id);
