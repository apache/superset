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

import { areObjectsEqual } from 'src/reduxUtils';
import {
  DataMask,
  DataMaskStateWithId,
  Divider,
  Filter,
  FilterState,
} from '@superset-ui/core';
import { testWithId } from 'src/utils/testUtils';
import { FilterBarLocation } from 'src/dashboard/types';

interface CommonFiltersBarProps {
  actions: React.ReactNode;
  canEdit: boolean;
  dataMaskSelected: DataMaskStateWithId;
  directPathToChild?: string[];
  filterValues: (Filter | Divider)[];
  isInitialized: boolean;
  onSelectionChange: (
    filter: Pick<Filter, 'id'> & Partial<Filter>,
    dataMask: Partial<DataMask>,
  ) => void;
}

interface VerticalBarConfig {
  filtersOpen: boolean;
  height: number | string;
  offset: number;
  toggleFiltersBar: any;
  width: number;
}

export interface FiltersBarProps
  extends Pick<CommonFiltersBarProps, 'directPathToChild'> {
  orientation: FilterBarLocation;
  verticalConfig?: VerticalBarConfig;
}

export type HorizontalBarProps = CommonFiltersBarProps & {
  dashboardId: number;
};

export type VerticalBarProps = Omit<FiltersBarProps, 'orientation'> &
  CommonFiltersBarProps &
  VerticalBarConfig & {
    isDisabled: boolean;
  };

export enum TabIds {
  AllFilters = 'allFilters',
  FilterSets = 'filterSets',
}

export const getOnlyExtraFormData = (data: DataMaskStateWithId) =>
  Object.values(data).reduce(
    (prev, next) => ({ ...prev, [next.id]: next.extraFormData }),
    {},
  );

export const checkIsMissingRequiredValue = (
  filter: Filter,
  filterState?: FilterState,
) => {
  const value = filterState?.value;
  // TODO: this property should be unhardcoded
  return (
    filter.controlValues?.enableEmptyFilter &&
    (value === null || value === undefined)
  );
};

export const checkIsApplyDisabled = (
  dataMaskSelected: DataMaskStateWithId,
  dataMaskApplied: DataMaskStateWithId,
  filters: Filter[],
) => {
  const dataSelectedValues = Object.values(dataMaskSelected);
  const dataAppliedValues = Object.values(dataMaskApplied);
  return (
    areObjectsEqual(
      getOnlyExtraFormData(dataMaskSelected),
      getOnlyExtraFormData(dataMaskApplied),
      { ignoreUndefined: true },
    ) ||
    dataSelectedValues.length !== dataAppliedValues.length ||
    filters.some(filter =>
      checkIsMissingRequiredValue(
        filter,
        dataMaskSelected?.[filter?.id]?.filterState,
      ),
    )
  );
};

export const FILTER_BAR_TEST_ID = 'filter-bar';
export const getFilterBarTestId = testWithId(FILTER_BAR_TEST_ID);
