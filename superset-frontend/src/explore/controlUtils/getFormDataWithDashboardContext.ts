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
import isEqual from 'lodash/isEqual';
import {
  EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS,
  EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS,
  isDefined,
  JsonObject,
  ensureIsArray,
  QueryObjectFilterClause,
  SimpleAdhocFilter,
  QueryFormData,
} from '@superset-ui/core';
import { NO_TIME_RANGE } from '../constants';

const simpleFilterToAdhoc = (
  filterClause: QueryObjectFilterClause,
  clause = 'where',
) => {
  const result = {
    clause: clause.toUpperCase(),
    expressionType: 'SIMPLE',
    operator: filterClause.op,
    subject: filterClause.col,
    comparator: 'val' in filterClause ? filterClause.val : undefined,
  } as SimpleAdhocFilter;
  if (filterClause.isExtra) {
    Object.assign(result, {
      isExtra: true,
      filterOptionName: `filter_${Math.random()
        .toString(36)
        .substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`,
    });
  }
  return result;
};

const removeAdhocFilterDuplicates = (filters: SimpleAdhocFilter[]) => {
  const isDuplicate = (
    adhocFilter: SimpleAdhocFilter,
    existingFilters: SimpleAdhocFilter[],
  ) =>
    existingFilters.some(
      (existingFilter: SimpleAdhocFilter) =>
        existingFilter.operator === adhocFilter.operator &&
        existingFilter.subject === adhocFilter.subject &&
        ((!('comparator' in existingFilter) &&
          !('comparator' in adhocFilter)) ||
          ('comparator' in existingFilter &&
            'comparator' in adhocFilter &&
            isEqual(existingFilter.comparator, adhocFilter.comparator))),
    );

  return filters.reduce((acc, filter) => {
    if (!isDuplicate(filter, acc)) {
      acc.push(filter);
    }
    return acc;
  }, [] as SimpleAdhocFilter[]);
};

const mergeFilterBoxToFormData = (
  exploreFormData: QueryFormData,
  dashboardFormData: JsonObject,
) => {
  const dateColumns = {
    __time_range: 'time_range',
    __time_col: 'granularity_sqla',
    __time_grain: 'time_grain_sqla',
    __granularity: 'granularity',
  };
  const appliedTimeExtras = {};

  const filterBoxData: JsonObject = {};
  ensureIsArray(dashboardFormData.extra_filters).forEach(filter => {
    if (dateColumns[filter.col]) {
      if (filter.val !== NO_TIME_RANGE) {
        filterBoxData[dateColumns[filter.col]] = filter.val;
        appliedTimeExtras[filter.col] = filter.val;
      }
    } else {
      const adhocFilter = simpleFilterToAdhoc({
        ...(filter as QueryObjectFilterClause),
        isExtra: true,
      });
      filterBoxData.adhoc_filters = [
        ...ensureIsArray(filterBoxData.adhoc_filters),
        adhocFilter,
      ];
    }
  });
  filterBoxData.applied_time_extras = appliedTimeExtras;
  return filterBoxData;
};

const mergeNativeFiltersToFormData = (
  exploreFormData: QueryFormData,
  dashboardFormData: JsonObject,
) => {
  const nativeFiltersData: JsonObject = {};
  const extraFormData = dashboardFormData.extra_form_data || {};

  Object.entries(EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS).forEach(
    ([srcKey, targetKey]) => {
      const val = extraFormData[srcKey];
      if (isDefined(val)) {
        nativeFiltersData[targetKey] = val;
      }
    },
  );

  if ('time_grain_sqla' in extraFormData) {
    nativeFiltersData.time_grain_sqla = extraFormData.time_grain_sqla;
  }
  if ('granularity_sqla' in extraFormData) {
    nativeFiltersData.granularity_sqla = extraFormData.granularity_sqla;
  }

  const extras = dashboardFormData.extras || {};
  EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS.forEach(key => {
    const val = extraFormData[key];
    if (isDefined(val)) {
      extras[key] = val;
    }
  });
  if (Object.keys(extras).length) {
    nativeFiltersData.extras = extras;
  }

  nativeFiltersData.adhoc_filters = ensureIsArray(
    extraFormData.adhoc_filters,
  ).map(filter => ({
    ...filter,
    isExtra: true,
  }));

  const appendFilters = ensureIsArray(extraFormData.filters).map(extraFilter =>
    simpleFilterToAdhoc({ ...extraFilter, isExtra: true }),
  );
  Object.keys(exploreFormData).forEach(key => {
    if (key.match(/adhoc_filter.*/)) {
      nativeFiltersData[key] = [
        ...ensureIsArray(nativeFiltersData[key]),
        ...appendFilters,
      ];
    }
  });
  return nativeFiltersData;
};

export const getFormDataWithDashboardContext = (
  exploreFormData: QueryFormData,
  dashboardContextFormData: JsonObject,
) => {
  const filterBoxData = mergeFilterBoxToFormData(
    exploreFormData,
    dashboardContextFormData,
  );
  const nativeFiltersData = mergeNativeFiltersToFormData(
    exploreFormData,
    dashboardContextFormData,
  );
  const adhocFilters = removeAdhocFilterDuplicates([
    ...ensureIsArray(exploreFormData.adhoc_filters),
    ...ensureIsArray(filterBoxData.adhoc_filters),
    ...ensureIsArray(nativeFiltersData.adhoc_filters),
  ]);
  return {
    ...exploreFormData,
    ...dashboardContextFormData,
    ...filterBoxData,
    ...nativeFiltersData,
    adhoc_filters: adhocFilters,
  };
};
