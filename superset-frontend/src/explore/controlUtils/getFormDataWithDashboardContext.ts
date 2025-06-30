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
import { isEqual } from 'lodash';
import {
  AdhocFilter,
  ensureIsArray,
  EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS,
  EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS,
  isDefined,
  isFreeFormAdhocFilter,
  isSimpleAdhocFilter,
  JsonObject,
  NO_TIME_RANGE,
  QueryFormData,
  QueryObjectFilterClause,
  SimpleAdhocFilter,
  isAdhocColumn,
} from '@superset-ui/core';
import { simpleFilterToAdhoc } from '../../utils/simpleFilterToAdhoc';

const removeExtraFieldForNewCharts = (
  filters: AdhocFilter[],
  isNewChart: boolean,
) =>
  filters.map(filter => {
    if (filter.isExtra) {
      return { ...filter, isExtra: !isNewChart };
    }
    return filter;
  });

const removeAdhocFilterDuplicates = (filters: AdhocFilter[]) => {
  const isDuplicate = (
    adhocFilter: AdhocFilter,
    existingFilters: AdhocFilter[],
  ) =>
    existingFilters.some(
      (existingFilter: AdhocFilter) =>
        (isFreeFormAdhocFilter(existingFilter) &&
          isFreeFormAdhocFilter(adhocFilter) &&
          existingFilter.clause === adhocFilter.clause &&
          existingFilter.sqlExpression === adhocFilter.sqlExpression) ||
        (isSimpleAdhocFilter(existingFilter) &&
          isSimpleAdhocFilter(adhocFilter) &&
          existingFilter.operator === adhocFilter.operator &&
          existingFilter.subject === adhocFilter.subject &&
          ((!('comparator' in existingFilter) &&
            !('comparator' in adhocFilter)) ||
            ('comparator' in existingFilter &&
              'comparator' in adhocFilter &&
              isEqual(existingFilter.comparator, adhocFilter.comparator)))),
    );

  return filters.reduce((acc, filter) => {
    if (!isDuplicate(filter, acc)) {
      acc.push(filter);
    }
    return acc;
  }, [] as AdhocFilter[]);
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
  const appliedTimeExtras: Record<string, any> = {};

  const filterBoxData: JsonObject = {};
  ensureIsArray(dashboardFormData.extra_filters).forEach(filter => {
    if (dateColumns[filter.col as keyof typeof dateColumns]) {
      if (filter.val !== NO_TIME_RANGE) {
        filterBoxData[dateColumns[filter.col as keyof typeof dateColumns]] =
          filter.val;
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
  isDeckGLChart: boolean,
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

  const getLayerScopedFilterSubjects = (): Set<string> => {
    if (!isDeckGLChart) return new Set();

    const filterDataMapping =
      dashboardFormData.filter_data_mapping ||
      exploreFormData.filter_data_mapping ||
      {};

    const scopedSubjects = new Set<string>();

    const getSubjectString = (filter: AdhocFilter): string => {
      if ('subject' in filter) {
        const { subject } = filter;
        if (typeof subject === 'string') {
          return subject;
        }
        if (isAdhocColumn(subject)) {
          const adhocColumn = subject as any;
          return adhocColumn.label || adhocColumn.optionName || '';
        }
      }
      if ('col' in filter && typeof (filter as any).col === 'string') {
        return (filter as any).col;
      }
      return '';
    };

    Object.values(filterDataMapping).forEach((filters: AdhocFilter[]) => {
      if (Array.isArray(filters)) {
        filters.forEach((filter: AdhocFilter) => {
          const subject = getSubjectString(filter);
          if (subject) {
            scopedSubjects.add(subject);
          }
        });
      }
    });

    return scopedSubjects;
  };

  const layerScopedSubjects = getLayerScopedFilterSubjects();

  const shouldExcludeFilter = (
    filter: AdhocFilter | QueryObjectFilterClause,
  ): boolean => {
    let subject = '';

    if ('subject' in filter) {
      const { subject: filterSubject } = filter;
      if (typeof filterSubject === 'string') {
        subject = filterSubject;
      } else if (isAdhocColumn(filterSubject)) {
        const adhocColumn = filterSubject as any;
        subject = adhocColumn.label || adhocColumn.optionName || '';
      }
    } else if ('col' in filter && typeof filter.col === 'string') {
      subject = filter.col;
    }

    return layerScopedSubjects.has(subject);
  };

  const adhocFilters = ensureIsArray(extraFormData.adhoc_filters)
    .filter((filter: AdhocFilter) => !shouldExcludeFilter(filter))
    .map((filter: AdhocFilter) => ({
      ...filter,
      isExtra: true,
    }));

  nativeFiltersData.adhoc_filters = adhocFilters;

  // Keep legacy filters in their original format, just filter out layer-scoped ones
  const legacyFilters = ensureIsArray(extraFormData.filters)
    .filter(
      (extraFilter: QueryObjectFilterClause) =>
        !shouldExcludeFilter(extraFilter),
    )
    .map((extraFilter: QueryObjectFilterClause) => ({
      ...extraFilter,
      isExtra: true,
    }));

  if (legacyFilters.length > 0) {
    nativeFiltersData.filters = legacyFilters;
  }

  return nativeFiltersData;
};

const applyTimeRangeFilters = (
  dashboardFormData: JsonObject,
  adhocFilters: AdhocFilter[],
) => {
  const extraFormData = dashboardFormData.extra_form_data || {};
  if ('time_range' in extraFormData) {
    return adhocFilters.map((filter: SimpleAdhocFilter) => {
      if (filter.operator === 'TEMPORAL_RANGE') {
        return {
          ...filter,
          comparator: extraFormData.time_range,
          isExtra: true,
        };
      }
      return filter;
    });
  }
  return adhocFilters;
};

export const getFormDataWithDashboardContext = (
  exploreFormData: QueryFormData,
  dashboardContextFormData: JsonObject,
) => {
  const isDeckGLChartCheck =
    exploreFormData.viz_type === 'deck_multi' ||
    dashboardContextFormData.viz_type === 'deck_multi';

  const filterBoxData = mergeFilterBoxToFormData(
    exploreFormData,
    dashboardContextFormData,
  );
  const nativeFiltersData = mergeNativeFiltersToFormData(
    exploreFormData,
    dashboardContextFormData,
    isDeckGLChartCheck,
  );
  const adhocFilters = [
    ...Object.keys(exploreFormData),
    ...Object.keys(filterBoxData),
    ...Object.keys(nativeFiltersData),
  ]
    .filter(key => key.match(/adhoc_filter.*/))
    .reduce(
      (acc, key) => ({
        ...acc,
        [key]: (() => {
          const beforeDuplicates = [
            ...ensureIsArray(exploreFormData[key]),
            ...ensureIsArray(filterBoxData[key]),
            ...ensureIsArray(nativeFiltersData[key]),
          ];

          const afterDuplicates = removeAdhocFilterDuplicates(beforeDuplicates);

          const final = removeExtraFieldForNewCharts(
            applyTimeRangeFilters(dashboardContextFormData, afterDuplicates),
            exploreFormData.slice_id === 0,
          );

          return final;
        })(),
      }),
      {},
    );

  const ownColorScheme = exploreFormData.color_scheme;
  const dashboardColorScheme = dashboardContextFormData.color_scheme;
  const appliedColorScheme = dashboardColorScheme || ownColorScheme;

  const deckGLProperties: JsonObject = {};

  if (isDeckGLChartCheck) {
    if (dashboardContextFormData.layer_filter_scope) {
      deckGLProperties.layer_filter_scope =
        dashboardContextFormData.layer_filter_scope;
    }
    if (dashboardContextFormData.filter_data_mapping) {
      deckGLProperties.filter_data_mapping =
        dashboardContextFormData.filter_data_mapping;
    }
  }

  return {
    ...exploreFormData,
    ...dashboardContextFormData,
    ...filterBoxData,
    ...nativeFiltersData,
    ...adhocFilters,
    own_color_scheme: ownColorScheme,
    color_scheme: appliedColorScheme,
    dashboard_color_scheme: dashboardColorScheme,
    ...deckGLProperties,
  };
};
