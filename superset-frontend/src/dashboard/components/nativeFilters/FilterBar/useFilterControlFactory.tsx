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

import React, { useCallback, useMemo } from 'react';
import {
  DataMask,
  DataMaskStateWithId,
  Divider,
  Filter,
  isFilterDivider,
} from '@superset-ui/core';
import { FilterBarOrientation } from 'src/dashboard/types';
import FilterControl from './FilterControls/FilterControl';
import { useFilters } from './state';
import FilterDivider from './FilterControls/FilterDivider';

export const useFilterControlFactory = (
  dataMaskSelected: DataMaskStateWithId,
  onFilterSelectionChange: (filter: Filter, dataMask: DataMask) => void,
) => {
  const filters = useFilters();
  const filterValues = useMemo(() => Object.values(filters), [filters]);
  const filtersWithValues: (Filter | Divider)[] = useMemo(
    () =>
      filterValues.map(filter => ({
        ...filter,
        dataMask: dataMaskSelected[filter.id],
      })),
    [filterValues, dataMaskSelected],
  );

  const filterControlFactory = useCallback(
    (
      index: number,
      filterBarOrientation: FilterBarOrientation,
      overflow: boolean,
    ) => {
      const filter = filtersWithValues[index];
      if (isFilterDivider(filter)) {
        return (
          <FilterDivider
            title={filter.title}
            description={filter.description}
            orientation={filterBarOrientation}
            overflow={overflow}
          />
        );
      }
      return (
        <FilterControl
          dataMaskSelected={dataMaskSelected}
          filter={filter}
          onFilterSelectionChange={onFilterSelectionChange}
          inView={false}
          orientation={filterBarOrientation}
          overflow={overflow}
        />
      );
    },
    [filtersWithValues, dataMaskSelected, onFilterSelectionChange],
  );

  return { filterControlFactory, filtersWithValues };
};
