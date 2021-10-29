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

/* eslint-disable no-param-reassign */
// <- When we work with Immer, we need reassign, so disabling lint
import produce from 'immer';
import { DataMask, FeatureFlag } from '@superset-ui/core';
import { NATIVE_FILTER_PREFIX } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/utils';
import { HYDRATE_DASHBOARD } from 'src/dashboard/actions/hydrate';
import { isFeatureEnabled } from 'src/featureFlags';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import { DataMaskStateWithId, DataMaskWithId } from './types';
import {
  AnyDataMaskAction,
  CLEAR_DATA_MASK_STATE,
  SET_DATA_MASK_FOR_FILTER_CONFIG_COMPLETE,
  UPDATE_DATA_MASK,
} from './actions';
import {
  Filter,
  FilterConfiguration,
} from '../dashboard/components/nativeFilters/types';
import { areObjectsEqual } from '../reduxUtils';
import { Filters } from '../dashboard/reducers/types';

export function getInitialDataMask(
  id?: string | number,
  moreProps?: DataMask,
): DataMask;
export function getInitialDataMask(
  id: string | number,
  moreProps: DataMask = {},
): DataMaskWithId {
  let otherProps = {};
  if (id) {
    otherProps = {
      id,
    };
  }
  return {
    ...otherProps,
    extraFormData: {},
    filterState: {},
    ownState: {},
    ...moreProps,
  } as DataMaskWithId;
}

function fillNativeFilters(
  filterConfig: FilterConfiguration,
  mergedDataMask: DataMaskStateWithId,
  draftDataMask: DataMaskStateWithId,
  currentFilters?: Filters,
) {
  const dataMaskFromUrl = getUrlParam(URL_PARAMS.nativeFilters) || {};
  filterConfig.forEach((filter: Filter) => {
    mergedDataMask[filter.id] = {
      ...getInitialDataMask(filter.id), // take initial data
      ...filter.defaultDataMask, // if something new came from BE - take it
      ...dataMaskFromUrl[filter.id],
    };
    if (
      currentFilters &&
      !areObjectsEqual(
        filter.defaultDataMask,
        currentFilters[filter.id]?.defaultDataMask,
        { ignoreUndefined: true },
      )
    ) {
      mergedDataMask[filter.id] = {
        ...mergedDataMask[filter.id],
        ...filter.defaultDataMask,
      };
    }
  });

  // Get back all other non-native filters
  Object.values(draftDataMask).forEach(filter => {
    if (!String(filter?.id).startsWith(NATIVE_FILTER_PREFIX)) {
      mergedDataMask[filter?.id] = filter;
    }
  });
}

const dataMaskReducer = produce(
  (draft: DataMaskStateWithId, action: AnyDataMaskAction) => {
    const cleanState = {};
    switch (action.type) {
      case CLEAR_DATA_MASK_STATE:
        return cleanState;
      case UPDATE_DATA_MASK:
        draft[action.filterId] = {
          ...getInitialDataMask(action.filterId),
          ...draft[action.filterId],
          ...action.dataMask,
        };
        return draft;
      // TODO: update hydrate to .ts
      // @ts-ignore
      case HYDRATE_DASHBOARD:
        if (isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)) {
          Object.keys(
            // @ts-ignore
            action.data.dashboardInfo?.metadata?.chart_configuration,
          ).forEach(id => {
            cleanState[id] = {
              ...getInitialDataMask(id), // take initial data
            };
          });
        }
        fillNativeFilters(
          // @ts-ignore
          action.data.dashboardInfo?.metadata?.native_filter_configuration ??
            [],
          cleanState,
          draft,
        );
        return cleanState;
      case SET_DATA_MASK_FOR_FILTER_CONFIG_COMPLETE:
        fillNativeFilters(
          action.filterConfig ?? [],
          cleanState,
          draft,
          action.filters,
        );
        return cleanState;

      default:
        return draft;
    }
  },
  {},
);

export default dataMaskReducer;
