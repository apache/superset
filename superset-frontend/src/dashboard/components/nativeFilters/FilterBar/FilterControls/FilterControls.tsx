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
import React, { FC, useMemo, useState } from 'react';
import { DataMaskUnit } from 'src/dataMask/types';
import { DataMask, styled } from '@superset-ui/core';
import CascadePopover from '../CascadeFilters/CascadePopover';
import { buildCascadeFiltersTree } from './utils';
import { useFilters } from '../state';
import { Filter } from '../../types';

const Wrapper = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  &:hover {
    cursor: pointer;
  }
`;

type FilterControlsProps = {
  directPathToChild?: string[];
  dataMaskSelected: DataMaskUnit;
  onFilterSelectionChange: (filter: Filter, dataMask: DataMask) => void;
};

const FilterControls: FC<FilterControlsProps> = ({
  directPathToChild,
  dataMaskSelected,
  onFilterSelectionChange,
}) => {
  const [visiblePopoverId, setVisiblePopoverId] = useState<string | null>(null);
  const filters = useFilters();
  const filterValues = Object.values<Filter>(filters);

  const cascadeFilters = useMemo(() => {
    const filtersWithValue = filterValues.map(filter => ({
      ...filter,
      currentValue: dataMaskSelected[filter.id]?.currentState?.value,
    }));
    return buildCascadeFiltersTree(filtersWithValue);
  }, [filterValues, dataMaskSelected]);

  return (
    <Wrapper>
      {cascadeFilters.map(filter => (
        <CascadePopover
          data-test="cascade-filters-control"
          key={filter.id}
          visible={visiblePopoverId === filter.id}
          onVisibleChange={visible =>
            setVisiblePopoverId(visible ? filter.id : null)
          }
          filter={filter}
          onFilterSelectionChange={onFilterSelectionChange}
          directPathToChild={directPathToChild}
        />
      ))}
    </Wrapper>
  );
};

export default FilterControls;
