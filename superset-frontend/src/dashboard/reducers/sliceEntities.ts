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
import { t } from '@superset-ui/core';

import {
  FETCH_ALL_SLICES_FAILED,
  FETCH_ALL_SLICES_STARTED,
  ADD_SLICES,
  SET_SLICES,
  SliceEntitiesState,
  SliceEntitiesActionPayload,
} from '../actions/sliceEntities';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';

export const initSliceEntities: SliceEntitiesState = {
  slices: {},
  isLoading: true,
  errorMessage: null,
  lastUpdated: 0,
};

export default function sliceEntitiesReducer(
  state: SliceEntitiesState = initSliceEntities,
  action: SliceEntitiesActionPayload,
): SliceEntitiesState {
  switch (action.type) {
    case HYDRATE_DASHBOARD:
      return {
        ...action.data.sliceEntities,
      };
    case FETCH_ALL_SLICES_STARTED:
      return {
        ...state,
        isLoading: true,
      };
    case ADD_SLICES:
      return {
        ...state,
        isLoading: false,
        slices: { ...state.slices, ...action.payload.slices },
        lastUpdated: new Date().getTime(),
      };
    case SET_SLICES:
      return {
        ...state,
        isLoading: false,
        slices: { ...action.payload.slices },
        lastUpdated: new Date().getTime(),
      };
    case FETCH_ALL_SLICES_FAILED:
      return {
        ...state,
        isLoading: false,
        lastUpdated: new Date().getTime(),
        errorMessage:
          action.payload.error || t('Could not fetch all saved charts'),
      };
    default:
      return state;
  }
}
