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

import { t } from '@apache-superset/core/translation';
import {
  DataMask,
  DataMaskStateWithId,
  ExtraFormData,
  Filter,
  FilterState,
  NativeFilterTarget,
  type TimeRangeLimits,
} from '@superset-ui/core';
import { isEqual, omit } from 'lodash-es';
import { useSelector } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { areObjectsEqual } from 'src/reduxUtils';
import { testWithId } from 'src/utils/testUtils';
import { RootState } from 'src/dashboard/types';
import { withChartDisplayLabels } from 'src/dashboard/util/withChartDisplayLabels';
import {
  chartHoldMode,
  type ChartHoldMode,
} from 'src/dashboard/actions/timeRangeLimits';
import type { ChartHoldStatus } from 'src/dashboard/reducers/timeRangeLimits';
import {
  dashboardLimitLevels,
  describeFailure,
  describeLimit,
  type ChartRangeFailure,
  type LimitCheck,
  type LimitFailure,
} from 'src/utils/timeRangeLimits';
import { FilterElement } from './FilterControls/types';

export const getOnlyExtraFormData = (
  data: DataMaskStateWithId,
  filterIds?: Set<string>,
): Record<string, ExtraFormData | undefined> =>
  Object.values(data).reduce<Record<string, ExtraFormData | undefined>>(
    (prev, next) => {
      // If filterIds is provided, only include those filters
      if (filterIds && !filterIds.has(next.id)) return prev;
      return { ...prev, [next.id]: next.extraFormData };
    },
    {},
  );

export const checkIsMissingRequiredValue = (
  filter: FilterElement,
  filterState?: FilterState,
) => {
  // Only `enableEmptyFilter` ("Filter value is required") makes a value
  // mandatory. `defaultToFirstItem` merely seeds an initial selection, so a
  // filter cleared by the user must stay clearable, with Apply enabled.
  const isRequired = !!filter.controlValues?.enableEmptyFilter;

  if (!isRequired) return false;

  const value = filterState?.value;

  // TODO: this property should be unhardcoded
  return value === null || value === undefined;
};

export const checkIsValidateError = (dataMask: DataMaskStateWithId) => {
  const values = Object.values(dataMask);
  return values.every(value => value.filterState?.validateStatus !== 'error');
};

export const checkIsApplyDisabled = (
  dataMaskSelected: DataMaskStateWithId,
  dataMaskApplied: DataMaskStateWithId,
  filtersInScope: Filter[],
  allFilters?: Filter[],
) => {
  if (!checkIsValidateError(dataMaskSelected)) return true;

  const selectedExtraFormData = getOnlyExtraFormData(dataMaskSelected);
  const appliedExtraFormData = getOnlyExtraFormData(dataMaskApplied);

  // Check for changes. ignoreUndefined drops empty keys on both sides so that
  // a filter present in Selected with a real value but absent (or undefined)
  // in Applied is correctly detected as a change.
  const dataEqual = areObjectsEqual(
    selectedExtraFormData,
    appliedExtraFormData,
    { ignoreUndefined: true },
  );

  // If no changes at all, Apply should be disabled
  if (dataEqual) return true;

  // Determine which filters to validate for required values
  const inScopeFilterIds = new Set(filtersInScope.map(f => f.id));

  // Check if changes are in-scope or out-of-scope
  const hasInScopeChanges = filtersInScope.some(filter => {
    const selected = selectedExtraFormData[filter.id];
    const applied = appliedExtraFormData[filter.id];
    return !isEqual(selected, applied);
  });

  // Determine which filters to validate for required values
  const hasOutOfScopeChanges =
    !hasInScopeChanges &&
    allFilters?.some(filter => {
      if (inScopeFilterIds.has(filter.id)) return false;
      const selected = selectedExtraFormData[filter.id];
      const applied = appliedExtraFormData[filter.id];
      return !isEqual(selected, applied);
    });

  const shouldValidateAllRequired =
    hasOutOfScopeChanges && allFilters && allFilters.length > 0;
  const filtersToValidateRequired = shouldValidateAllRequired
    ? allFilters
    : filtersInScope;

  // Check if any required filter is missing a value
  // For filters that may have been auto-applied (e.g., requiredFirst filters),
  // check both selected and applied states to avoid false positives during initialization
  const hasMissingRequiredFilter = filtersToValidateRequired.some(filter => {
    const selectedDataMask = dataMaskSelected?.[filter?.id];
    const selectedState = selectedDataMask?.filterState;
    const appliedState = dataMaskApplied?.[filter?.id]?.filterState;

    // If filter has value in selected state, it's not missing
    if (selectedState?.value !== null && selectedState?.value !== undefined) {
      return false;
    }

    // If filter is not in selected state at all (not initialized yet),
    // check if it was auto-applied and has value in applied state
    // This handles the case where auto-applied filters haven't synced to selected yet
    if (!selectedDataMask) {
      if (appliedState?.value !== null && appliedState?.value !== undefined) {
        return false; // Not missing, it's auto-applied
      }
    }

    // Otherwise, check if it's actually a required filter with missing value
    // This includes cases where user explicitly cleared the value (selectedDataMask exists but value is undefined)
    return checkIsMissingRequiredValue(filter, selectedState);
  });

  return hasMissingRequiredFilter;
};

const chartsVerboseMapSelector = createSelector(
  [
    (state: RootState) => state.sliceEntities.slices,
    (state: RootState) => state.datasources,
  ],
  (slices, datasources) =>
    Object.keys(slices).reduce((chartsVerboseMaps, chartId) => {
      const numericChartId = Number(chartId);
      const chartDatasource = slices[numericChartId]?.form_data?.datasource
        ? datasources[slices[numericChartId].form_data.datasource]
        : undefined;
      return {
        ...chartsVerboseMaps,
        [chartId]: chartDatasource
          ? withChartDisplayLabels(chartDatasource, chartId).verbose_map
          : {},
      };
    }, {}),
);

export const useChartsVerboseMaps = () =>
  useSelector<RootState, { [chartId: string]: Record<string, string> }>(
    chartsVerboseMapSelector,
  );

const hasFilterValue = (value: unknown): boolean =>
  value !== undefined && value !== null;

/**
 * Determines which filters should be applied when the Apply button is clicked.
 */
export const getFiltersToApply = (
  dataMaskSelected: DataMaskStateWithId,
  inScopeFilterIds: Set<string>,
): string[] =>
  Object.entries(dataMaskSelected)
    .filter(([filterId, dataMask]) => {
      if (!dataMask) return false;

      const isInScope = inScopeFilterIds.has(filterId);
      const hasValue = hasFilterValue(dataMask.filterState?.value);

      // Apply if in-scope OR if out-of-scope with a value
      return isInScope || hasValue;
    })
    .map(([filterId]) => filterId);

export type AppliedFilterLogEntry = {
  id: string;
  name?: string;
  hasValue: boolean;
};

/**
 * Build the `change_dashboard_filter` payload for filters about to be applied.
 *
 * Records the filter id, display name, and whether a value is selected. The
 * selected value itself is omitted because filter values can contain personal
 * data and this event is written to the logs table.
 */
export const getAppliedFilterLogPayload = (
  filterIds: string[],
  filtersById: Record<string, { name?: string } | undefined>,
  dataMaskSelected: DataMaskStateWithId,
): AppliedFilterLogEntry[] =>
  filterIds.flatMap(filterId => {
    const filter = filtersById[filterId];
    if (!filter) {
      return [];
    }
    const value = dataMaskSelected[filterId]?.filterState?.value;
    return [
      {
        id: filterId,
        name: filter.name,
        hasValue: hasFilterValue(value),
      },
    ];
  });

export const FILTER_BAR_TEST_ID = 'filter-bar';
export const getFilterBarTestId = testWithId(FILTER_BAR_TEST_ID);

/**
 * Reduce a chart-customization target to just its datasource binding, dropping
 * the selected column(s) on a "clear all". The datasourceType MUST survive the
 * clear: dropping it would silently rebind a semantic view to the regular
 * dataset that shares its numeric id on the next resolution (sc-111089). Absent
 * type is omitted rather than emitted as undefined, matching a regular dataset.
 */
export const clearedCustomizationTarget = (
  target?: Partial<NativeFilterTarget>,
): Partial<NativeFilterTarget> => ({
  datasetId: target?.datasetId,
  ...(target?.datasourceType ? { datasourceType: target.datasourceType } : {}),
});
/** A filter value the time range limits found invalid; never stored in Redux. */
export type LimitFlags = {
  limitInvalid?: boolean;
  validateMessage?: string;
};

/**
 * The data mask without the time range limit flags, for Redux and the links
 * built from it. Without the flags it is returned as is.
 */
export const stripLimitFlags = <T extends DataMask>(dataMask: T): T =>
  dataMask.filterState && 'limitInvalid' in dataMask.filterState
    ? {
        ...dataMask,
        filterState: omit(dataMask.filterState, [
          'limitInvalid',
          'validateMessage',
          'validateStatus',
        ]),
      }
    : dataMask;

/**
 * A failure as the filter shows it: "Longer than 90 days" style text for the
 * span, the picker's text for any other rule.
 */
export const limitFailureMessage = (failure: LimitFailure): string =>
  failure.reason === 'MAX_SPAN_EXCEEDED' && failure.limit
    ? t('Longer than %(limit)s', { limit: describeLimit(failure.limit) })
    : describeFailure(failure, true);

/** The filter's message for a checked value, `undefined` when it passes. */
export const limitCheckMessage = (check: LimitCheck): string | undefined => {
  if (check.status === 'error') {
    return check.message;
  }
  if (check.status === 'unavailable') {
    return t('Time range could not be checked.');
  }
  const [failure] = check.failures;
  return failure ? limitFailureMessage(failure) : undefined;
};

export const selectTimeRangeLimitsMode = (state: RootState) =>
  chartHoldMode(state.timeRangeLimits);

export const useTimeRangeLimitsMode = () =>
  useSelector<RootState, ChartHoldMode>(selectTimeRangeLimitsMode);

/**
 * Value and Numerical range filters send no option query while the time range
 * limits failed, or while a Retry after a failure loads them. The first
 * load of a page is not held.
 */
export const selectOptionQueryHeld = (state: RootState) => {
  const mode = chartHoldMode(state.timeRangeLimits);
  return (
    mode === 'failed' ||
    (mode === 'loading' && !!state.timeRangeLimits.failedBefore)
  );
};

export const useOptionQueryHeld = () =>
  useSelector<RootState, boolean>(selectOptionQueryHeld);

const datasetIdOfChart = (state: RootState, chartId: number) => {
  const datasource = state.charts[chartId]?.form_data?.datasource;
  const id = Number(String(datasource ?? '').split('__')[0]);
  return Number.isNaN(id) ? null : id;
};

/**
 * The limits a Time Range filter's picker checks against: the global policy,
 * the datasets of the charts in its scope that set a policy, the dashboard
 * policy. `undefined` unless the limits are on.
 */
export const selectFilterTimeRangeLimits = (
  state: RootState,
  chartsInScope: number[] | undefined,
): TimeRangeLimits | undefined => {
  const { payload, dashboardId } = state.timeRangeLimits ?? {};
  if (selectTimeRangeLimitsMode(state) !== 'on' || !payload) {
    return undefined;
  }
  const datasetIds = chartsInScope
    ? new Set(chartsInScope.map(chartId => datasetIdOfChart(state, chartId)))
    : null;
  return {
    levels: dashboardLimitLevels({
      ...payload,
      datasets: (payload.datasets ?? []).filter(
        dataset => !datasetIds || datasetIds.has(dataset.id),
      ),
    }),
    dashboardId: dashboardId ?? undefined,
    timezone: payload.timezone,
  };
};

export const useFilterTimeRangeLimits = (
  filterType: string,
  chartsInScope: number[] | undefined,
) =>
  useSelector<RootState, TimeRangeLimits | undefined>(
    state =>
      filterType === 'filter_time'
        ? selectFilterTimeRangeLimits(state, chartsInScope)
        : undefined,
    isEqual,
  );

const MARKED_HOLDS: ChartHoldStatus[] = ['invalid', 'unbounded', 'rejected'];

const fromFilter = (failure: ChartRangeFailure) =>
  !!failure.range.source?.some(
    ({ kind }) => kind === 'time_range' || kind === 'granularity',
  );

/** A time range filter a held chart's check found invalid. */
export type ServerMark = { value: string; failure: ChartRangeFailure };

/**
 * The Time Range filters the held charts name as the source of a failing
 * range, for their applied value only.
 */
export const selectServerMarks = (
  state: RootState,
): Record<string, ServerMark> => {
  const marks: Record<string, ServerMark> = {};
  if (selectTimeRangeLimitsMode(state) !== 'on') {
    return marks;
  }
  Object.values(state.timeRangeLimits.charts).forEach(hold => {
    const filterId = hold.attribution?.filterId;
    const value = hold.attribution?.filterValue;
    const failure =
      hold.failures?.find(fromFilter) ?? hold.failures?.[0] ?? undefined;
    if (
      !MARKED_HOLDS.includes(hold.status) ||
      !filterId ||
      !value ||
      !failure ||
      marks[filterId] ||
      state.dataMask[filterId]?.extraFormData?.time_range !== value
    ) {
      return;
    }
    marks[filterId] = { value, failure };
  });
  return marks;
};

export const useServerMarks = () =>
  useSelector<RootState, Record<string, ServerMark>>(
    selectServerMarks,
    isEqual,
  );
