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
import React from 'react';
import { styled } from '@superset-ui/core';
import FilterValue from './FilterValue';
import { FilterProps } from './types';

const StyledFilterControlTitle = styled.h4`
  width: 100%;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  margin: 0;
  overflow-wrap: break-word;
`;

const StyledFilterControlTitleBox = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
`;

const StyledFilterControlContainer = styled.div`
  width: 100%;
`;

const FilterControl: React.FC<FilterProps> = ({
  dataMaskSelected,
  filter,
  icon,
  onFilterSelectionChange,
  directPathToChild,
}) => {
  const { name = '<undefined>' } = filter;
  return (
    <StyledFilterControlContainer>
      <StyledFilterControlTitleBox>
        <StyledFilterControlTitle data-test="filter-control-name">
          {name}
        </StyledFilterControlTitle>
        <div data-test="filter-icon">{icon}</div>
      </StyledFilterControlTitleBox>
      <FilterValue
        dataMaskSelected={dataMaskSelected}
        filter={filter}
        directPathToChild={directPathToChild}
        onFilterSelectionChange={onFilterSelectionChange}
      />
    </StyledFilterControlContainer>
  );
};

export default FilterControl;
