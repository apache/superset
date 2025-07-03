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
import { produce } from 'immer';

export interface GroupByState {
  [groupById: string]: {
    id: string;
    selectedValues: string[];
    isLoading: boolean;
    availableOptions: { label: string; value: string }[];
  };
}

export interface GroupByCustomizationsState {
  groupByState: GroupByState;
}

export const SET_GROUP_BY_VALUES = 'SET_GROUP_BY_VALUES';
export const SET_GROUP_BY_LOADING = 'SET_GROUP_BY_LOADING';
export const SET_GROUP_BY_OPTIONS = 'SET_GROUP_BY_OPTIONS';
export const CLEAR_GROUP_BY_STATE = 'CLEAR_GROUP_BY_STATE';

export interface SetGroupByValuesAction {
  type: typeof SET_GROUP_BY_VALUES;
  groupById: string;
  values: string[];
}

export interface SetGroupByLoadingAction {
  type: typeof SET_GROUP_BY_LOADING;
  groupById: string;
  isLoading: boolean;
}

export interface SetGroupByOptionsAction {
  type: typeof SET_GROUP_BY_OPTIONS;
  groupById: string;
  options: { label: string; value: string }[];
}

export interface ClearGroupByStateAction {
  type: typeof CLEAR_GROUP_BY_STATE;
}

export type GroupByAction =
  | SetGroupByValuesAction
  | SetGroupByLoadingAction
  | SetGroupByOptionsAction
  | ClearGroupByStateAction;

export const setGroupByValues = (
  groupById: string,
  values: string[],
): SetGroupByValuesAction => ({
  type: SET_GROUP_BY_VALUES,
  groupById,
  values,
});

export const setGroupByLoading = (
  groupById: string,
  isLoading: boolean,
): SetGroupByLoadingAction => ({
  type: SET_GROUP_BY_LOADING,
  groupById,
  isLoading,
});

export const setGroupByOptions = (
  groupById: string,
  options: { label: string; value: string }[],
): SetGroupByOptionsAction => ({
  type: SET_GROUP_BY_OPTIONS,
  groupById,
  options,
});

export const clearGroupByState = (): ClearGroupByStateAction => ({
  type: CLEAR_GROUP_BY_STATE,
});

const initialState: GroupByCustomizationsState = {
  groupByState: {},
};

export default function groupByCustomizationsReducer(
  state = initialState,
  action: GroupByAction,
): GroupByCustomizationsState {
  switch (action.type) {
    case SET_GROUP_BY_VALUES:
      return produce(state, draft => {
        if (!draft.groupByState[action.groupById]) {
          draft.groupByState[action.groupById] = {
            id: action.groupById,
            selectedValues: [],
            isLoading: false,
            availableOptions: [],
          };
        }
        draft.groupByState[action.groupById].selectedValues = action.values;
      });

    case SET_GROUP_BY_LOADING:
      return produce(state, draft => {
        if (!draft.groupByState[action.groupById]) {
          draft.groupByState[action.groupById] = {
            id: action.groupById,
            selectedValues: [],
            isLoading: false,
            availableOptions: [],
          };
        }
        draft.groupByState[action.groupById].isLoading = action.isLoading;
      });

    case SET_GROUP_BY_OPTIONS:
      return produce(state, draft => {
        if (!draft.groupByState[action.groupById]) {
          draft.groupByState[action.groupById] = {
            id: action.groupById,
            selectedValues: [],
            isLoading: false,
            availableOptions: [],
          };
        }
        draft.groupByState[action.groupById].availableOptions = action.options;
      });

    case CLEAR_GROUP_BY_STATE:
      return produce(state, draft => {
        draft.groupByState = {};
      });

    default:
      return state;
  }
}
