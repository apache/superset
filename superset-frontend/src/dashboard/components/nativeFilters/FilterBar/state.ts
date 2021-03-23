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
import { DataMaskUnit, DataMaskUnitWithId } from 'src/dataMask/types';
import { useEffect, useState } from 'react';
import { areObjectsEqual } from 'src/reduxUtils';
import { Filter } from '../types';

export const useFilterSets = () =>
  useSelector<any, FilterSetsType>(
    state => state.nativeFilters.filterSets || {},
  );

export const useFilters = () =>
  useSelector<any, Filters>(state => state.nativeFilters.filters);

export const useDataMask = () =>
  useSelector<any, DataMaskUnitWithId>(state => state.dataMask.nativeFilters);

export const useFiltersInitialisation = (
  dataMaskSelected: DataMaskUnit,
  handleApply: () => void,
) => {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const filters = useFilters();
  const filterValues = Object.values<Filter>(filters);
  useEffect(() => {
    if (isInitialized) {
      return;
    }
    const areFiltersInitialized = filterValues.every(filterValue =>
      areObjectsEqual(
        filterValue?.defaultValue,
        dataMaskSelected[filterValue?.id]?.currentState?.value,
      ),
    );
    if (areFiltersInitialized) {
      handleApply();
      setIsInitialized(true);
    }
  }, [filterValues, dataMaskSelected, isInitialized]);

  return {
    isInitialized,
  };
};

export const useFilterUpdates = (
  dataMaskSelected: DataMaskUnit,
  setDataMaskSelected: (arg0: (arg0: DataMaskUnit) => void) => void,
  setLastAppliedFilterData: (arg0: (arg0: DataMaskUnit) => void) => void,
) => {
  const filters = useFilters();
  const dataMaskApplied = useDataMask();

  useEffect(() => {
    // Remove deleted filters from local state
    Object.keys(dataMaskSelected).forEach(selectedId => {
      if (!filters[selectedId]) {
        setDataMaskSelected(draft => {
          delete draft[selectedId];
        });
      }
    });
    Object.keys(dataMaskApplied).forEach(appliedId => {
      if (!filters[appliedId]) {
        setLastAppliedFilterData(draft => {
          delete draft[appliedId];
        });
      }
    });
  }, [
    dataMaskApplied,
    dataMaskSelected,
    filters,
    setDataMaskSelected,
    setLastAppliedFilterData,
  ]);
};
