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
import { Action } from 'redux';
import {
  CreateFilterBeginAction,
  CreateFilterCompleteAction,
  CREATE_FILTER_BEGIN,
  CREATE_FILTER_COMPLETE,
  SelectFilterOptionAction,
  SELECT_FILTER_OPTION,
} from '../actions/nativeFilters';
import { Filter, FilterState } from '../components/nativeFilters/types';

export type State = {
  [filterId: string]: FilterState;
};

export function getInitialFilterState(id: string): FilterState {
  return {
    id,
    optionsStatus: 'loading',
    isDirty: false,
    options: null,
    selectedValues: null,
  };
}

export function getInitialState(filterConfig: Filter[]): State {
  const filters = {};
  filterConfig.forEach(filter => {
    filters[filter.id] = getInitialFilterState(filter.id);
  });
  return filters;
}

export default function nativeFilterReducer(
  filters: State = {},
  action: Action,
) {
  const actionMap = {
    [SELECT_FILTER_OPTION]: (action: SelectFilterOptionAction): State => {
      const filterState = filters[action.filterId];
      return {
        ...filters,
        [action.filterId]: {
          ...filterState,
          selectedValues: action.selectedValues,
        },
      };
    },

    [CREATE_FILTER_BEGIN]: (action: CreateFilterBeginAction): State => {
      const filterState = getInitialFilterState(action.filter.id);
      filterState.isDirty = true;
      return {
        ...filters,
        [action.filter.id]: filterState,
      };
    },

    [CREATE_FILTER_COMPLETE]: (action: CreateFilterCompleteAction): State => {
      const filterState = filters[action.filter.id];
      return {
        ...filters,
        [action.filter.id]: {
          ...filterState,
          isDirty: false,
        },
      };
    },
  };

  if (actionMap[action.type]) {
    return actionMap[action.type](action);
  }
  return filters;
}
