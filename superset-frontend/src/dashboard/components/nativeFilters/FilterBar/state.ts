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
import { useSelector } from 'react-redux';
import {
  Filters,
  FilterSets as FilterSetsType,
} from 'src/dashboard/reducers/types';
import {
  DataMaskState,
  DataMaskStateWithId,
  DataMaskWithId,
} from 'src/dataMask/types';
import { useEffect } from 'react';
import { RootState } from 'src/dashboard/types';
import { NATIVE_FILTER_PREFIX } from '../FiltersConfigModal/utils';

export const useFilterSets = () =>
  useSelector<any, FilterSetsType>(
    state => state.nativeFilters.filterSets || {},
  );

export const useFilters = () =>
  useSelector<any, Filters>(state => state.nativeFilters.filters);

export const useNativeFiltersDataMask = () => {
  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );

  return Object.values(dataMask)
    .filter((item: DataMaskWithId) =>
      String(item.id).startsWith(NATIVE_FILTER_PREFIX),
    )
    .reduce(
      (prev, next: DataMaskWithId) => ({ ...prev, [next.id]: next }),
      {},
    ) as DataMaskStateWithId;
};

export const useFilterUpdates = (
  dataMaskSelected: DataMaskState,
  setDataMaskSelected: (arg0: (arg0: DataMaskState) => void) => void,
) => {
  const filters = useFilters();
  const dataMaskApplied = useNativeFiltersDataMask();

  useEffect(() => {
    // Remove deleted filters from local state
    Object.keys(dataMaskSelected).forEach(selectedId => {
      if (!filters[selectedId]) {
        setDataMaskSelected(draft => {
          delete draft[selectedId];
        });
      }
    });
  }, [dataMaskApplied, dataMaskSelected, filters, setDataMaskSelected]);
};
