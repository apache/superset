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

import { useRef, useState, useEffect, useCallback } from 'react';
import { t } from '@apache-superset/core/translation';
import { ensureIsArray } from '@superset-ui/core';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  GroupOutlined,
  CalculatorOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { Column } from '@superset-ui/core/components/ThemedAgGridReact';
import FilterIcon from './Filter';
import KebabMenu from './KebabMenu';
import {
  CustomColDef,
  CustomHeaderParams,
  SortState,
  UserProvidedColDef,
  FilterInputPosition,
  AGGridFilterInstance,
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
import { GridApi } from 'ag-grid-community';
import {
  FILTER_POPOVER_OPEN_DELAY,
  FILTER_INPUT_POSITIONS,
  FILTER_CONDITION_BODY_INDEX,
  FILTER_INPUT_SELECTOR,
} from '../../consts';

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

// Auto-opens filter popover and focuses the correct input after server-side filtering
const autoOpenFilterAndFocus = async (
  column: Column,
  api: GridApi,
  filterRef: React.RefObject<HTMLDivElement>,
  setFilterVisible: (visible: boolean) => void,
  lastFilteredInputPosition?: FilterInputPosition,
) => {
  setFilterVisible(true);

  const filterInstance = (await api.getColumnFilterInstance(
    column,
  )) as AGGridFilterInstance | null;
  const filterEl = filterInstance?.eGui;

  if (!filterEl || !filterRef.current) return;

  filterRef.current.innerHTML = '';
  filterRef.current.appendChild(filterEl);

  if (filterInstance?.eConditionBodies) {
    const conditionBodies = filterInstance.eConditionBodies;
    const targetIndex =
      lastFilteredInputPosition === FILTER_INPUT_POSITIONS.SECOND
        ? FILTER_CONDITION_BODY_INDEX.SECOND
        : FILTER_CONDITION_BODY_INDEX.FIRST;
    const targetBody = conditionBodies[targetIndex];

    if (targetBody) {
      const input = targetBody.querySelector(
        FILTER_INPUT_SELECTOR,
      ) as HTMLInputElement | null;
      input?.focus();
    }
  }
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
    setControlValue,
    formData,
  } = context;
  const colId = column?.getColId();
  const colDef = column?.getColDef() as CustomColDef;
  const userColDef = column.getUserProvidedColDef() as UserProvidedColDef;
  const isPercentMetric = colDef?.context?.isPercentMetric;
  const isMetric = colDef?.context?.isMetric;
  const isNumeric = colDef?.context?.isNumeric;

  const [isFilterVisible, setFilterVisible] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const isFilterActive = column?.isFilterActive();

  const currentSort = initialSortState?.[0];
  const isMain = userColDef?.isMain;
  const isTimeComparison = !isMain && userColDef?.timeComparisonKey;
  const sortKey = isMain ? colId.replace('Main', '').trim() : colId;

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

    const filterInstance = (await api.getColumnFilterInstance(
      column,
    )) as AGGridFilterInstance | null;
    const filterEl = filterInstance?.eGui;
    if (filterEl && filterRef.current) {
      filterRef.current.innerHTML = '';
      filterRef.current.appendChild(filterEl);
    }
  };

  // Re-open filter popover after server refresh (delay allows AG Grid to finish rendering)
  useEffect(() => {
    if (lastFilteredColumn === colId && !isFilterVisible) {
      const timeoutId = setTimeout(
        () =>
          autoOpenFilterAndFocus(
            column,
            api,
            filterRef,
            setFilterVisible,
            lastFilteredInputPosition,
          ),
        FILTER_POPOVER_OPEN_DELAY,
      );
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [lastFilteredColumn, colId, lastFilteredInputPosition]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuVisible(!isMenuVisible);
  };

  // Column interaction handlers for Explore
  const handleGroupBy = useCallback(() => {
    if (!setControlValue || !formData) return;
    const currentGroupby = ensureIsArray(formData.groupby);
    if (!currentGroupby.includes(colId)) {
      setControlValue('groupby', [...currentGroupby, colId]);
    }
    setMenuVisible(false);
  }, [setControlValue, formData, colId]);

  const handleAddMetric = useCallback(
    (aggregate: string) => {
      if (!setControlValue || !formData) return;
      const currentMetrics = ensureIsArray(formData.metrics);
      const metricLabel = `${aggregate}(${colId})`;
      const newMetric = {
        aggregate,
        column: { column_name: colId },
        expressionType: 'SIMPLE',
        label: metricLabel,
      };
      setControlValue('metrics', [...currentMetrics, newMetric]);
      setMenuVisible(false);
    },
    [setControlValue, formData, colId],
  );

  const handleHideColumn = useCallback(() => {
    if (!setControlValue || !formData) return;
    const currentColumnConfig = formData.column_config || {};
    setControlValue('column_config', {
      ...currentColumnConfig,
      [colId]: {
        ...currentColumnConfig[colId],
        visible: false,
      },
    });
    setMenuVisible(false);
  }, [setControlValue, formData, colId]);

  const isCurrentColSorted = currentSort?.colId === colId;
  const currentDirection = isCurrentColSorted ? currentSort?.sort : null;
  const shouldShowAsc =
    !isTimeComparison && (!currentDirection || currentDirection === 'desc');
  const shouldShowDesc =
    !isTimeComparison && (!currentDirection || currentDirection === 'asc');

  // Only show column interaction options in Explore context (when setControlValue is available)
  const showColumnInteractions = !!setControlValue;
  const canGroupBy = showColumnInteractions && !isMetric && !isPercentMetric;
  const canAddMetric = showColumnInteractions && !isMetric && !isPercentMetric;

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

      {/* Column interaction options for Explore */}
      {canGroupBy && (
        <>
          <div className="menu-divider" />
          <div onClick={handleGroupBy} className="menu-item">
            <GroupOutlined /> {t('Group by this column')}
          </div>
        </>
      )}
      {canAddMetric && (
        <>
          <div className="menu-item menu-submenu">
            <CalculatorOutlined /> {t('Add as metric')}
            <div className="submenu">
              {isNumeric && (
                <>
                  <div
                    onClick={() => handleAddMetric('SUM')}
                    className="menu-item"
                  >
                    {t('SUM')}
                  </div>
                  <div
                    onClick={() => handleAddMetric('AVG')}
                    className="menu-item"
                  >
                    {t('AVG')}
                  </div>
                  <div
                    onClick={() => handleAddMetric('MIN')}
                    className="menu-item"
                  >
                    {t('MIN')}
                  </div>
                  <div
                    onClick={() => handleAddMetric('MAX')}
                    className="menu-item"
                  >
                    {t('MAX')}
                  </div>
                </>
              )}
              <div
                onClick={() => handleAddMetric('COUNT')}
                className="menu-item"
              >
                {t('COUNT')}
              </div>
              <div
                onClick={() => handleAddMetric('COUNT_DISTINCT')}
                className="menu-item"
              >
                {t('COUNT DISTINCT')}
              </div>
            </div>
          </div>
        </>
      )}
      {showColumnInteractions && (
        <>
          <div className="menu-divider" />
          <div onClick={handleHideColumn} className="menu-item">
            <EyeInvisibleOutlined /> {t('Hide column')}
          </div>
        </>
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
