/* eslint-disable jsx-a11y/no-static-element-interactions */
/*
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

import { useRef, useState } from 'react';
import { styled } from '@superset-ui/core';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { IHeaderParams, Column } from 'ag-grid-community';
import CustomPopover from './CustomPopover';

const FilterIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="6" width="18" height="2" rx="1" />
    <rect x="6" y="11" width="12" height="2" rx="1" />
    <rect x="9" y="16" width="6" height="2" rx="1" />
  </svg>
);

// Styled Components
const Container = styled.div`
  display: flex;
  width: 100%;
`;

const HeaderContainer = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0 8px;
`;

const HeaderLabel = styled.span`
  font-weight: 500;
`;

const SortIconWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-left: 0.5rem;
`;

const FilterIconWrapper = styled.div`
  align-self: flex-end;
  margin-left: auto;
  cursor: pointer;
`;

interface SortState {
  colId: string;
  sort: 'asc' | 'desc' | null;
}

interface CustomContext {
  initialSortState: SortState[];
  onColumnHeaderClicked: (args: { column: SortState }) => void;
}

interface CustomHeaderParams extends IHeaderParams {
  context: CustomContext;
  column: Column;
}

const getSortIcon = (
  sortState: SortState[],
  colId: string | null,
): React.ReactNode => {
  if (!sortState?.length || !colId) return null;
  const currentSort = sortState[0];
  if (currentSort.colId === colId) {
    if (currentSort.sort === 'asc') return <ArrowUpOutlined />;
    if (currentSort.sort === 'desc') return <ArrowDownOutlined />;
  }
  return null;
};

const CustomHeader: React.FC<CustomHeaderParams> = ({
  displayName,
  enableSorting,
  setSort,
  context,
  column,
  api,
}) => {
  const { initialSortState, onColumnHeaderClicked } = context;
  const colId = column?.getColId();

  const [isPopoverVisible, setPopoverVisible] = useState(false);
  const filterContainerRef = useRef<HTMLDivElement>(null);

  const handleSort = () => {
    if (!enableSorting) return;

    const current = initialSortState?.[0];

    if (!current || current.colId !== colId) {
      onColumnHeaderClicked({ column: { colId, sort: 'asc' } });
      setSort('asc', false);
    } else if (current.sort === 'asc') {
      onColumnHeaderClicked({ column: { colId, sort: 'desc' } });
      setSort('desc', false);
    } else {
      onColumnHeaderClicked({ column: { colId, sort: null } });
      setSort(null, false);
    }
  };

  const handleFilterClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    setPopoverVisible(!isPopoverVisible);

    const filterInstance = await api.getColumnFilterInstance<any>(column);
    const filterEl = filterInstance?.eGui;

    if (!filterEl || !filterContainerRef.current) return;

    filterContainerRef.current.innerHTML = '';
    filterContainerRef.current.appendChild(filterEl);
  };

  return (
    <Container>
      <HeaderContainer onClick={handleSort} className="custom-header">
        <HeaderLabel>{displayName}</HeaderLabel>
        <SortIconWrapper>
          {getSortIcon(initialSortState, colId)}
        </SortIconWrapper>
      </HeaderContainer>

      <CustomPopover
        content={<div ref={filterContainerRef} />}
        isOpen={isPopoverVisible}
        onClose={() => setPopoverVisible(false)}
      >
        <FilterIconWrapper
          className="header-filter"
          onClick={handleFilterClick}
        >
          {FilterIcon}
        </FilterIconWrapper>
      </CustomPopover>
    </Container>
  );
};

export default CustomHeader;
