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
import { DataMaskStateWithId, DataMaskWithId } from './types';
import {
  AnyDataMaskAction,
  SET_DATA_MASK_FOR_FILTER_CONFIG_COMPLETE,
  UPDATE_DATA_MASK,
} from './actions';
import { NATIVE_FILTER_PREFIX } from '../dashboard/components/nativeFilters/FiltersConfigModal/utils';
import { Filter } from '../dashboard/components/nativeFilters/types';

export function getInitialDataMask(id: string): DataMaskWithId {
  return {
    id,
    extraFormData: {},
    filterState: {},
    ownState: {},
    isApplied: false,
  };
}

const dataMaskReducer = produce(
  (draft: DataMaskStateWithId, action: AnyDataMaskAction) => {
    const cleanState = {};
    switch (action.type) {
      case UPDATE_DATA_MASK:
        draft[action.filterId] = {
          ...getInitialDataMask(action.filterId),
          ...draft[action.filterId],
          ...action.dataMask,
          isApplied: true,
        };
        return draft;

      case SET_DATA_MASK_FOR_FILTER_CONFIG_COMPLETE:
        (action.filterConfig ?? []).forEach((filter: Filter) => {
          cleanState[filter.id] =
            draft[filter.id] ?? getInitialDataMask(filter.id);
        });
        // Get back all other non-native filters
        Object.values(draft).forEach(filter => {
          if (!String(filter?.id).startsWith(NATIVE_FILTER_PREFIX)) {
            cleanState[filter?.id] = filter;
          }
        });
        return cleanState;

      default:
        return draft;
    }
  },
  {},
);

export default dataMaskReducer;
