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
import { styled, DataMask } from '@superset-ui/core';
import Icon from 'src/components/Icon';
import FilterControl from '../FilterControls/FilterControl';
import { Filter } from '../../types';
import { CascadeFilter } from './types';

interface CascadeFilterControlProps {
  filter: CascadeFilter;
  directPathToChild?: string[];
  onFilterSelectionChange: (filter: Filter, dataMask: DataMask) => void;
}

const StyledCascadeChildrenList = styled.ul`
  list-style-type: none;
  & > * {
    list-style-type: none;
  }
`;

const StyledFilterControlBox = styled.div`
  display: flex;
`;

const StyledCaretIcon = styled(Icon)`
  margin-top: ${({ theme }) => -theme.gridUnit}px;
`;

const CascadeFilterControl: React.FC<CascadeFilterControlProps> = ({
  filter,
  directPathToChild,
  onFilterSelectionChange,
}) => (
  <>
    <StyledFilterControlBox>
      <StyledCaretIcon name="caret-down" />
      <FilterControl
        filter={filter}
        directPathToChild={directPathToChild}
        onFilterSelectionChange={onFilterSelectionChange}
      />
    </StyledFilterControlBox>

    <StyledCascadeChildrenList>
      {filter.cascadeChildren?.map(childFilter => (
        <li key={childFilter.id}>
          <CascadeFilterControl
            filter={childFilter}
            directPathToChild={directPathToChild}
            onFilterSelectionChange={onFilterSelectionChange}
          />
        </li>
      ))}
    </StyledCascadeChildrenList>
  </>
);

export default CascadeFilterControl;
