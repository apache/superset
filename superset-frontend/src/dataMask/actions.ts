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
import { DataMask } from '@superset-ui/core';
import { FilterConfiguration } from '../dashboard/components/nativeFilters/types';
import { FeatureFlag, isFeatureEnabled } from '../featureFlags';
import { Filters } from '../dashboard/reducers/types';
import { getInitialDataMask } from './reducer';

export const UPDATE_DATA_MASK = 'UPDATE_DATA_MASK';
export interface UpdateDataMask {
  type: typeof UPDATE_DATA_MASK;
  filterId: string | number;
  dataMask: DataMask;
}

export const SET_DATA_MASK_FOR_FILTER_CONFIG_COMPLETE =
  'SET_DATA_MASK_FOR_FILTER_CONFIG_COMPLETE';

export interface SetDataMaskForFilterConfigComplete {
  type: typeof SET_DATA_MASK_FOR_FILTER_CONFIG_COMPLETE;
  filterConfig: FilterConfiguration;
  filters?: Filters;
}

export const SET_DATA_MASK_FOR_FILTER_CONFIG_FAIL =
  'SET_DATA_MASK_FOR_FILTER_CONFIG_FAIL';

export interface SetDataMaskForFilterConfigFail {
  type: typeof SET_DATA_MASK_FOR_FILTER_CONFIG_FAIL;
  filterConfig: FilterConfiguration;
}
export function setDataMaskForFilterConfigComplete(
  filterConfig: FilterConfiguration,
  filters?: Filters,
): SetDataMaskForFilterConfigComplete {
  return {
    type: SET_DATA_MASK_FOR_FILTER_CONFIG_COMPLETE,
    filterConfig,
    filters,
  };
}
export function updateDataMask(
  filterId: string | number,
  dataMask: DataMask,
): UpdateDataMask {
  // Only apply data mask if one of the relevant features is enabled
  const isFeatureFlagActive =
    isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS) ||
    isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS);
  return {
    type: UPDATE_DATA_MASK,
    filterId,
    dataMask: isFeatureFlagActive ? dataMask : {},
  };
}

export function clearDataMask(filterId: string | number) {
  return updateDataMask(
    filterId,
    getInitialDataMask(filterId, {
      filterState: {
        value: null,
      },
    }),
  );
}

export type AnyDataMaskAction =
  | UpdateDataMask
  | SetDataMaskForFilterConfigFail
  | SetDataMaskForFilterConfigComplete;
