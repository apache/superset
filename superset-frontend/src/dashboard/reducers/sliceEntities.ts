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
import { logging } from '@apache-superset/core/utils';

import {
  FETCH_ALL_SLICES_FAILED,
  FETCH_ALL_SLICES_STARTED,
  ADD_SLICES,
  SET_SLICES,
  SliceEntitiesState,
  SliceEntitiesActionPayload,
} from '../actions/sliceEntities';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';
import {
  ENTER_VERSION_PREVIEW,
  EXIT_VERSION_PREVIEW,
} from '../actions/dashboardState';

export const initSliceEntities: SliceEntitiesState = {
  slices: {},
  isLoading: true,
  errorMessage: null,
  lastUpdated: 0,
};

type VersionPreviewSwapAction = {
  type: typeof ENTER_VERSION_PREVIEW | typeof EXIT_VERSION_PREVIEW;
  newSliceEntities?: SliceEntitiesState;
  restoreSliceEntities?: SliceEntitiesState;
};

export default function sliceEntitiesReducer(
  state: SliceEntitiesState = initSliceEntities,
  action: SliceEntitiesActionPayload | VersionPreviewSwapAction,
): SliceEntitiesState {
  switch (action.type) {
    case ENTER_VERSION_PREVIEW: {
      const next = (action as VersionPreviewSwapAction).newSliceEntities;
      return next ?? state;
    }
    case EXIT_VERSION_PREVIEW: {
      const restore = (action as VersionPreviewSwapAction).restoreSliceEntities;
      if (!restore) {
        // No captured originals means the EXIT was dispatched without a
        // matching ENTER. Returning ``state`` leaves the snapshot data
        // visible while the rest of the app thinks preview is over —
        // surface the bug instead of silently degrading.
        logging.warn(
          'sliceEntitiesReducer: EXIT_VERSION_PREVIEW received without restoreSliceEntities; ignoring.',
        );
        return state;
      }
      return restore as SliceEntitiesState;
    }
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
