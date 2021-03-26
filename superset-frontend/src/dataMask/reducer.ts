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
import { MaskWithId, DataMaskType, DataMaskStateWithId, Mask } from './types';
import {
  AnyDataMaskAction,
  SET_DATA_MASK_FOR_FILTER_CONFIG_COMPLETE,
  UPDATE_DATA_MASK,
  UpdateDataMask,
} from './actions';

export function getInitialMask(id: string): MaskWithId {
  return {
    id,
    extraFormData: {},
    currentState: {},
  };
}

const setUnitDataMask = (
  unitName: DataMaskType,
  action: UpdateDataMask,
  dataMaskState: DataMaskStateWithId,
) => {
  if (action[unitName]) {
    dataMaskState[unitName][action.filterId] = {
      ...(action[unitName] as Mask),
      id: action.filterId,
    };
  }
};

const dataMaskReducer = produce(
  (draft: DataMaskStateWithId, action: AnyDataMaskAction) => {
    const oldData = { ...draft };
    switch (action.type) {
      case UPDATE_DATA_MASK:
        Object.values(DataMaskType).forEach(unitName =>
          setUnitDataMask(unitName, action, draft),
        );
        break;

      case SET_DATA_MASK_FOR_FILTER_CONFIG_COMPLETE:
        draft[action.unitName] = {};
        (action.filterConfig ?? []).forEach(filter => {
          draft[action.unitName][filter.id] =
            oldData[action.unitName][filter.id] ?? getInitialMask(filter.id);
        });
        break;

      default:
    }
  },
  {
    [DataMaskType.NativeFilters]: {},
    [DataMaskType.CrossFilters]: {},
    [DataMaskType.OwnFilters]: {},
  },
);

export default dataMaskReducer;
