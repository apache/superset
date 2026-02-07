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
  DataMaskStateWithId,
  ExtraFormData,
  Filter,
  FilterState,
} from '@superset-ui/core';
import { isEqual } from 'lodash';
import { useSelector } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { areObjectsEqual } from 'src/reduxUtils';
import { testWithId } from 'src/utils/testUtils';
import { RootState } from 'src/dashboard/types';
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

  // Check counts first
  const selectedCount = Object.keys(selectedExtraFormData).length;
  const appliedCount = Object.keys(appliedExtraFormData).length;

  if (selectedCount !== appliedCount) return true;

  // Check for changes
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

  const hasMissingRequiredFilter = filtersToValidateRequired.some(filter =>
    checkIsMissingRequiredValue(
      filter,
      dataMaskSelected?.[filter?.id]?.filterState,
    ),
  );

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
        [chartId]: chartDatasource ? chartDatasource.verbose_map : {},
      };
    }, {}),
);

export const useChartsVerboseMaps = () =>
  useSelector<RootState, { [chartId: string]: Record<string, string> }>(
    chartsVerboseMapSelector,
  );

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
      const hasValue =
        dataMask.filterState?.value !== undefined &&
        dataMask.filterState?.value !== null;

      // Apply if in-scope OR if out-of-scope with a value
      return isInScope || hasValue;
    })
    .map(([filterId]) => filterId);

export const FILTER_BAR_TEST_ID = 'filter-bar';
export const getFilterBarTestId = testWithId(FILTER_BAR_TEST_ID);
