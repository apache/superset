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

import { useRef, useState, useEffect } from 'react';
import { t } from '@superset-ui/core';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import FilterIcon from './Filter';
import KebabMenu from './KebabMenu';
import {
  CustomColDef,
  CustomHeaderParams,
  SortState,
  UserProvidedColDef,
} from '../../types';
import CustomPopover from './CustomPopover';
import {
  Container,
  FilterIconWrapper,
  HeaderContainer,
  HeaderLabel,
  MenuContainer,
  SortIconWrapper,
} from '../../styles';

const getSortIcon = (sortState: SortState[], colId: string | null) => {
  if (!sortState?.length || !colId) return null;
  const { colId: currentCol, sort } = sortState[0];
  if (currentCol === colId) {
    return sort === 'asc' ? (
      <ArrowUpOutlined />
    ) : sort === 'desc' ? (
      <ArrowDownOutlined />
    ) : null;
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
  const {
    initialSortState,
    onColumnHeaderClicked,
    lastFilteredColumn,
    lastFilteredInputPosition,
    activeFilterColumns,
  } = context;
  const colId = column?.getColId();
  const colDef = column?.getColDef() as CustomColDef;
  const userColDef = column.getUserProvidedColDef() as UserProvidedColDef;
  const isPercentMetric = colDef?.context?.isPercentMetric;

  const [isFilterVisible, setFilterVisible] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLDivElement>(null);
  // Use activeFilterColumns from context as reliable backup for AG Grid's isFilterActive
  const isFilterActive =
    column?.isFilterActive() ||
    (colId ? activeFilterColumns?.has(colId) : false);

  const focusFilterInput = (position?: 'first' | 'second') => {
    setTimeout(() => {
      if (!filterRef.current) return;

      const filterBodies =
        filterRef.current.querySelectorAll<HTMLElement>('.ag-filter-body');

      if (filterBodies.length === 0) return;

      let targetFilterBody: HTMLElement | null = null;

      if (position === 'second' && filterBodies?.length > 1) {
        targetFilterBody = filterBodies[1];
      } else if (position === 'first' && filterBodies?.length > 0) {
        targetFilterBody = filterBodies[0];
      }

      if (!targetFilterBody) return;

      const input = targetFilterBody.querySelector<HTMLInputElement>(
        'input:not([type="checkbox"]):not([type="radio"]), textarea',
      );

      if (input) {
        input.focus();
        // setSelectionRange doesn't work on number inputs
        if (input.type !== 'number') {
          const length = input.value?.length || 0;
          input.setSelectionRange?.(length, length);
        }
      }
    }, 100);
  };

  // Auto-open filter popover if this column was last filtered
  useEffect(() => {
    setTimeout(() => {
      if (lastFilteredColumn === colId && !isFilterVisible) {
        handleFilterClick();
        focusFilterInput(lastFilteredInputPosition);
      }
    }, 200);
  }, [lastFilteredColumn, colId]);

  const currentSort = initialSortState?.[0];
  const isMain = userColDef?.isMain;
  const isTimeComparison = !isMain && userColDef?.timeComparisonKey;
  const sortKey = isMain ? colId.replace('Main', '').trim() : colId;

  // Sorting logic
  const clearSort = () => {
    onColumnHeaderClicked({ column: { colId: sortKey, sort: null } });
    setSort(null, false);
  };

  const applySort = (direction: 'asc' | 'desc') => {
    onColumnHeaderClicked({ column: { colId: sortKey, sort: direction } });
    setSort(direction, false);
  };

  const getNextSortDirection = (): 'asc' | 'desc' | null => {
    if (currentSort?.colId !== colId) return 'asc';
    if (currentSort?.sort === 'asc') return 'desc';
    return null;
  };

  const toggleSort = () => {
    if (!enableSorting || isTimeComparison) return;

    const next = getNextSortDirection();
    if (next) applySort(next);
    else clearSort();
  };

  const handleFilterClick = async (e?: React.MouseEvent | undefined) => {
    if (e) {
      e?.stopPropagation();
    }
    setFilterVisible(!isFilterVisible);

    const filterInstance = await api.getColumnFilterInstance<any>(column);
    const filterEl = filterInstance?.eGui;
    if (filterEl && filterRef.current) {
      filterRef.current.innerHTML = '';
      filterRef.current.appendChild(filterEl);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuVisible(!isMenuVisible);
  };

  const isCurrentColSorted = currentSort?.colId === colId;
  const currentDirection = isCurrentColSorted ? currentSort?.sort : null;
  const shouldShowAsc =
    !isTimeComparison && (!currentDirection || currentDirection === 'desc');
  const shouldShowDesc =
    !isTimeComparison && (!currentDirection || currentDirection === 'asc');

  const menuContent = (
    <MenuContainer>
      {shouldShowAsc && (
        <div onClick={() => applySort('asc')} className="menu-item">
          <ArrowUpOutlined /> {t('Sort Ascending')}
        </div>
      )}
      {shouldShowDesc && (
        <div onClick={() => applySort('desc')} className="menu-item">
          <ArrowDownOutlined /> {t('Sort Descending')}
        </div>
      )}
      {currentSort && currentSort?.colId === colId && (
        <div onClick={clearSort} className="menu-item">
          <span style={{ fontSize: 16 }}>↻</span> {t('Clear Sort')}
        </div>
      )}
    </MenuContainer>
  );

  return (
    <Container>
      <HeaderContainer onClick={toggleSort} className="custom-header">
        <HeaderLabel>{displayName}</HeaderLabel>
        <SortIconWrapper>
          {getSortIcon(initialSortState, colId)}
        </SortIconWrapper>
      </HeaderContainer>

      <CustomPopover
        content={<div ref={filterRef} />}
        isOpen={isFilterVisible}
        onClose={() => setFilterVisible(false)}
      >
        <FilterIconWrapper
          ref={filterButtonRef}
          className="header-filter"
          onClick={handleFilterClick}
          isFilterActive={isFilterActive}
        >
          <FilterIcon />
        </FilterIconWrapper>
      </CustomPopover>

      {!isPercentMetric && !isTimeComparison && (
        <CustomPopover
          content={menuContent}
          isOpen={isMenuVisible}
          onClose={() => setMenuVisible(false)}
        >
          <div className="three-dots-menu" onClick={handleMenuClick}>
            <KebabMenu />
          </div>
        </CustomPopover>
      )}
    </Container>
  );
};

export default CustomHeader;
