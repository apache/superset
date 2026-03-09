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

import { DataMaskStateWithId, Filter, FilterState } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { areObjectsEqual } from 'src/reduxUtils';
import { testWithId } from 'src/utils/testUtils';
import { RootState } from 'src/dashboard/types';
import { FilterElement } from './FilterControls/types';

export const getOnlyExtraFormData = (data: DataMaskStateWithId) =>
  Object.values(data).reduce(
    (prev, next) => ({ ...prev, [next.id]: next.extraFormData }),
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
  return (
    filter.controlValues?.enableEmptyFilter &&
    (value === null || value === undefined)
  );
};

export const checkIsValidateError = (dataMask: DataMaskStateWithId) => {
  const values = Object.values(dataMask);
  return values.every(value => value.filterState?.validateStatus !== 'error');
};

export const checkIsApplyDisabled = (
  dataMaskSelected: DataMaskStateWithId,
  dataMaskApplied: DataMaskStateWithId,
  filters: Filter[],
) => {
  if (!checkIsValidateError(dataMaskSelected)) {
    return true;
  }

  // Check if any required filter is missing a value
  // For filters that may have been auto-applied (e.g., requiredFirst filters),
  // check both selected and applied states to avoid false positives during initialization
  const hasMissingRequiredFilter = filters.some(filter => {
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

  const selectedExtraFormData = getOnlyExtraFormData(dataMaskSelected);
  const appliedExtraFormData = getOnlyExtraFormData(dataMaskApplied);

  const areEqual = areObjectsEqual(
    selectedExtraFormData,
    appliedExtraFormData,
    { ignoreUndefined: true },
  );

  const result = areEqual || hasMissingRequiredFilter;

  return result;
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

export const FILTER_BAR_TEST_ID = 'filter-bar';
export const getFilterBarTestId = testWithId(FILTER_BAR_TEST_ID);
