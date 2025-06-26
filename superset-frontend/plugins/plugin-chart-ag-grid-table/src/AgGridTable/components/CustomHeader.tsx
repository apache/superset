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
import { styled, t } from '@superset-ui/core';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Popover } from '@superset-ui/core/components/Popover';
import FilterIcon from './Filter';
import KebabMenu from './KebabMenu';
import {
  CustomColDef,
  CustomHeaderParams,
  SortState,
  UserProvidedColDef,
} from '../../types';
import useOutsideClick from '../../utils/useOutsideclick';

// Styled Components
const Container = styled.div`
  ${({ theme }) => `
    display: flex;
    width: 100%;

    .three-dots-menu {
      align-self: center;
      margin-left: ${theme.sizeUnit}px;
      cursor: pointer;
      padding: ${theme.sizeUnit / 2}px;
      border-radius: ${theme.borderRadius}px;
    }
  `}
`;

const HeaderContainer = styled.div`
  ${({ theme }) => `
    width: 100%;
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0 ${theme.sizeUnit * 2}px;
    overflow: hidden;
  `}
`;

const HeaderLabel = styled.span`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    max-width: 100%;
  `}
`;

const SortIconWrapper = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    margin-left: ${theme.sizeUnit * 2}px;
  `}
`;

const FilterIconWrapper = styled.div`
  align-self: flex-end;
  margin-left: auto;
  cursor: pointer;
`;

const MenuContainer = styled.div`
  ${({ theme }) => `
    min-width: ${theme.sizeUnit * 45}px;
    padding: ${theme.sizeUnit}px 0;

    .menu-item {
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;

      &:hover {
        background-color: ${theme.colors.primary.light4};
      }
    }

    .menu-divider {
      height: 1px;
      background-color: ${theme.colors.grayscale.light2};
      margin: ${theme.sizeUnit}px 0;
    }
  `}
`;

const StyledAntdPopover = styled.div`
  ${({ theme }) => `
    background: ${theme.colors.grayscale.light4};
    border: 1px solid ${theme.colors.grayscale.light2};
    border-radius: ${theme.borderRadius}px;
    box-shadow: 0 ${theme.sizeUnit / 2}px ${theme.sizeUnit * 2}px ${theme.colors.grayscale.light1}40;
    min-width: ${theme.sizeUnit * 50}px;
    padding: ${theme.sizeUnit * 2}px;
  `}
`;

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
  slice_id,
}) => {
  const { initialSortState, onColumnHeaderClicked } = context;
  const colId = column?.getColId();
  const colDef = column?.getColDef() as CustomColDef;
  const userColDef = column.getUserProvidedColDef() as UserProvidedColDef;
  const isPercentMetric = colDef?.context?.isPercentMetric;

  const [isFilterVisible, setFilterVisible] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);

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

  const handleFilterClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const className = `#chart-id-${slice_id} .ag-root-wrapper`;

  const handleFilterClose = () => {
    if (isFilterVisible) {
      setFilterVisible(false);
    }
  };

  // The filter popover gets closed even when clicking on one of filter options
  // possibly due to some ant popover logic
  // this hook prevents the filter popover from closing when clicking on one of filter options
  useOutsideClick(popoverContentRef, handleFilterClose);

  return (
    <Container>
      <HeaderContainer onClick={toggleSort} className="custom-header">
        <HeaderLabel>{displayName}</HeaderLabel>
        <SortIconWrapper>
          {getSortIcon(initialSortState, colId)}
        </SortIconWrapper>
      </HeaderContainer>

      <Popover
        classNames={{
          root: 'filter-popover',
        }}
        content={
          <StyledAntdPopover ref={popoverContentRef}>
            <div ref={filterRef} />
          </StyledAntdPopover>
        }
        open={isFilterVisible}
        onOpenChange={visible => visible && setFilterVisible(true)}
        trigger="click"
        getPopupContainer={() =>
          document.querySelector(className) || document.body
        }
        arrow={false}
      >
        <FilterIconWrapper
          className="header-filter"
          onClick={handleFilterClick}
        >
          {FilterIcon}
        </FilterIconWrapper>
      </Popover>

      {!isPercentMetric && !isTimeComparison && (
        <Popover
          content={<StyledAntdPopover>{menuContent}</StyledAntdPopover>}
          open={isMenuVisible}
          onOpenChange={setMenuVisible}
          trigger="click"
          getPopupContainer={() =>
            document.querySelector(className) || document.body
          }
          arrow={false}
        >
          <div className="three-dots-menu" onClick={handleMenuClick}>
            <KebabMenu />
          </div>
        </Popover>
      )}
    </Container>
  );
};

export default CustomHeader;
