/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable theme-colors/no-literal-colors */
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
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { IHeaderParams, Column, ColDef } from 'ag-grid-community';
import CustomPopover from './CustomPopover';

const ThreeDots = ({ size = 16, color = 'black' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="8" cy="3" r="1.2" />
    <circle cx="8" cy="8" r="1.2" />
    <circle cx="8" cy="13" r="1.2" />
  </svg>
);
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

  .three-dots-menu {
    align-self: center;
    margin-left: 5px;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
  }
`;

const HeaderContainer = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0 8px;
  overflow: hidden;
`;

const HeaderLabel = styled.span`
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  max-width: 100%;
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

const MenuContainer = styled.div`
  min-width: 180px;
  padding: 4px 0;

  .menu-item {
    padding: 8px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;

    &:hover {
      background-color: rgba(32, 167, 201, 0.2);
    }
  }

  .menu-divider {
    height: 1px;
    background-color: #e8e8e8;
    margin: 4px 0;
  }
`;

const ToggleButton = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 2px;
  margin-left: 4px;
  transition: transform 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
    border-radius: 4px;
  }
`;

// Export the interfaces
export interface SortState {
  colId: string;
  sort: 'asc' | 'desc' | null;
}

export interface CustomContext {
  initialSortState: SortState[];
  onColumnHeaderClicked: (args: { column: SortState }) => void;
}

export interface CustomHeaderParams extends IHeaderParams {
  context: CustomContext;
  column: Column;
}

interface UserProvidedColDef extends ColDef {
  isMain?: boolean;
  timeComparisonKey?: string;
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
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const currentSort = initialSortState?.[0];
  const [areComparisonColumnsVisible, setAreComparisonColumnsVisible] =
    useState(true);

  const userColumn = column.getUserProvidedColDef() as UserProvidedColDef;
  const isMain = userColumn?.isMain;
  const timeComparisonKey = userColumn?.timeComparisonKey || '';
  const sortKey = isMain ? colId.replace('Main', '').trim() : colId;
  const isTimeComparison = !isMain && timeComparisonKey;

  const ClearSort = () => {
    onColumnHeaderClicked({ column: { colId: sortKey, sort: null } });
    setSort(null, false);
  };

  const handleSortAsc = () => {
    onColumnHeaderClicked({ column: { colId: sortKey, sort: 'asc' } });
    setSort('asc', false);
  };

  const handleSortDesc = () => {
    onColumnHeaderClicked({ column: { colId: sortKey, sort: 'desc' } });
    setSort('desc', false);
  };

  const handleSort = () => {
    if (isTimeComparison) return;

    if (!enableSorting) return;

    const current = initialSortState?.[0];

    if (!current || current.colId !== colId) {
      handleSortAsc();
    } else if (current.sort === 'asc') {
      handleSortDesc();
    } else {
      ClearSort();
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

  const handleMenuClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsMenuVisible(!isMenuVisible);
  };

  const handleToggleComparison = (event: React.MouseEvent) => {
    event.stopPropagation();

    const allColumns = api.getColumnDefs();
    const timeComparisonColumns = allColumns?.filter(
      col =>
        (col as UserProvidedColDef).timeComparisonKey === timeComparisonKey &&
        !(col as UserProvidedColDef).isMain,
    );
    const timeComparsionColIds = timeComparisonColumns?.map(
      item => (item as UserProvidedColDef).field || '',
    ) as string[];
    api.setColumnsVisible(timeComparsionColIds, !areComparisonColumnsVisible);

    api.sizeColumnsToFit();

    setAreComparisonColumnsVisible(!areComparisonColumnsVisible);
  };

  const shouldShowAsc =
    !currentSort ||
    (currentSort?.colId === colId && currentSort?.sort === 'desc') ||
    currentSort?.colId !== colId;
  const shouldShowDesc =
    !currentSort ||
    (currentSort?.colId === colId && currentSort?.sort === 'asc') ||
    currentSort?.colId !== colId;

  const menuContent = (
    <MenuContainer>
      {shouldShowAsc && !isTimeComparison && (
        <div onClick={handleSortAsc} className="menu-item">
          <ArrowUpOutlined /> Sort Ascending
        </div>
      )}
      {shouldShowDesc && !isTimeComparison && (
        <div onClick={handleSortDesc} className="menu-item">
          <ArrowDownOutlined /> Sort Descending
        </div>
      )}
      {currentSort && currentSort?.colId === colId && (
        <div onClick={ClearSort} className="menu-item">
          <span style={{ fontSize: 16 }}>↻</span> Clear Sort
        </div>
      )}
    </MenuContainer>
  );

  return (
    <Container>
      <HeaderContainer onClick={handleSort} className="custom-header">
        <HeaderLabel>{displayName}</HeaderLabel>
        <SortIconWrapper>
          {getSortIcon(initialSortState, colId)}
        </SortIconWrapper>
        {isMain && timeComparisonKey && (
          <ToggleButton
            onClick={handleToggleComparison}
            title={
              areComparisonColumnsVisible
                ? 'Hide comparison columns'
                : 'Show comparison columns'
            }
          >
            <PlusOutlined
              style={{
                transform: areComparisonColumnsVisible
                  ? 'rotate(45deg)'
                  : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            />
          </ToggleButton>
        )}
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

      <CustomPopover
        content={menuContent}
        isOpen={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
      >
        <div className="three-dots-menu" onClick={handleMenuClick}>
          <ThreeDots />
        </div>
      </CustomPopover>
    </Container>
  );
};

export default CustomHeader;
