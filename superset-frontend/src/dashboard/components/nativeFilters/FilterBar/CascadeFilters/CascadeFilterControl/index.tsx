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
import React, { RefObject } from 'react';
import { styled, DataMask } from '@superset-ui/core';
import FilterControl from 'src/dashboard/components/nativeFilters/FilterBar/FilterControls/FilterControl';
import { CascadeFilter } from 'src/dashboard/components/nativeFilters/FilterBar/CascadeFilters/types';
import { Filter } from 'src/dashboard/components/nativeFilters/types';
import { DataMaskStateWithId } from 'src/dataMask/types';

export interface CascadeFilterControlProps {
  dataMaskSelected?: DataMaskStateWithId;
  filter: CascadeFilter;
  directPathToChild?: string[];
  onFilterSelectionChange: (filter: Filter, dataMask: DataMask) => void;
  parentRef?: RefObject<any>;
}

const StyledDiv = styled.div`
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  .ant-form-item {
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  }
`;

const CascadeFilterControl: React.FC<CascadeFilterControlProps> = ({
  dataMaskSelected,
  filter,
  directPathToChild,
  onFilterSelectionChange,
  parentRef,
}) => (
  <>
    <FilterControl
      dataMaskSelected={dataMaskSelected}
      filter={filter}
      directPathToChild={directPathToChild}
      parentRef={parentRef}
      showOverflow
      onFilterSelectionChange={onFilterSelectionChange}
    />
    <StyledDiv>
      {filter.cascadeChildren?.map(childFilter => (
        <CascadeFilterControl
          key={childFilter.id}
          dataMaskSelected={dataMaskSelected}
          filter={childFilter}
          directPathToChild={directPathToChild}
          onFilterSelectionChange={onFilterSelectionChange}
        />
      ))}
    </StyledDiv>
  </>
);

export default CascadeFilterControl;
