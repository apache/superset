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

/* eslint-disable no-param-reassign */
import throttle from 'lodash/throttle';
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  createContext,
} from 'react';
import cx from 'classnames';
import {
  FeatureFlag,
  HandlerFunction,
  isNativeFilter,
  styled,
  t,
} from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { AntdTabs } from 'src/components';
import { isFeatureEnabled } from 'src/featureFlags';
import Loading from 'src/components/Loading';
import { EmptyStateSmall } from 'src/components/EmptyState';
import { getFilterBarTestId } from './utils';
import { TabIds, VerticalBarProps } from './types';
import FilterSets from './FilterSets';
import { useFilterSets } from './state';
import EditSection from './FilterSets/EditSection';
import Header from './Header';
import FilterControls from './FilterControls/FilterControls';
import CrossFiltersVertical from './CrossFilters/Vertical';

const BarWrapper = styled.div<{ width: number }>`
  width: ${({ theme }) => theme.gridUnit * 8}px;

  & .ant-tabs-top > .ant-tabs-nav {
    margin: 0;
  }
  &.open {
    width: ${({ width }) => width}px; // arbitrary...
  }
`;

const Bar = styled.div<{ width: number }>`
  ${({ theme, width }) => `
    & .ant-typography-edit-content {
      left: 0;
      margin-top: 0;
      width: 100%;
    }
    position: absolute;
    top: 0;
    left: 0;
    flex-direction: column;
    flex-grow: 1;
    width: ${width}px;
    background: ${theme.colors.grayscale.light5};
    border-right: 1px solid ${theme.colors.grayscale.light2};
    border-bottom: 1px solid ${theme.colors.grayscale.light2};
    min-height: 100%;
    display: none;
    &.open {
      display: flex;
    }
  `}
`;

const CollapsedBar = styled.div<{ offset: number }>`
  ${({ theme, offset }) => `
    position: absolute;
    top: ${offset}px;
    left: 0;
    height: 100%;
    width: ${theme.gridUnit * 8}px;
    padding-top: ${theme.gridUnit * 2}px;
    display: none;
    text-align: center;
    &.open {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: ${theme.gridUnit * 2}px;
    }
    svg {
      cursor: pointer;
    }
  `}
`;

const StyledCollapseIcon = styled(Icons.Collapse)`
  ${({ theme }) => `
    color: ${theme.colors.primary.base};
    margin-bottom: ${theme.gridUnit * 3}px;
  `}
`;

const StyledFilterIcon = styled(Icons.Filter)`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

const StyledTabs = styled(AntdTabs)`
  & .ant-tabs-nav-list {
    width: 100%;
  }
  & .ant-tabs-tab {
    display: flex;
    justify-content: center;
    margin: 0;
    flex: 1;
  }

  & > .ant-tabs-nav .ant-tabs-nav-operations {
    display: none;
  }
`;

const FilterBarEmptyStateContainer = styled.div`
  margin-top: ${({ theme }) => theme.gridUnit * 8}px;
`;

const FilterControlsWrapper = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  // 108px padding to make room for buttons with position: absolute
  padding-bottom: ${({ theme }) => theme.gridUnit * 27}px;
`;

export const FilterBarScrollContext = createContext(false);
const VerticalFilterBar: React.FC<VerticalBarProps> = ({
  actions,
  canEdit,
  dataMaskSelected,
  filtersOpen,
  filterValues,
  height,
  isDisabled,
  isInitialized,
  offset,
  onSelectionChange,
  toggleFiltersBar,
  width,
}) => {
  const [editFilterSetId, setEditFilterSetId] = useState<number | null>(null);
  const filterSets = useFilterSets();
  const filterSetFilterValues = Object.values(filterSets);
  const [tab, setTab] = useState(TabIds.AllFilters);
  const nativeFilterValues = filterValues.filter(isNativeFilter);
  const [isScrolling, setIsScrolling] = useState(false);
  const timeout = useRef<any>();

  const openFiltersBar = useCallback(
    () => toggleFiltersBar(true),
    [toggleFiltersBar],
  );

  const onScroll = useMemo(
    () =>
      throttle(() => {
        clearTimeout(timeout.current);
        setIsScrolling(true);
        timeout.current = setTimeout(() => {
          setIsScrolling(false);
        }, 300);
      }, 200),
    [],
  );

  useEffect(() => {
    document.onscroll = onScroll;
    return () => {
      document.onscroll = null;
    };
  }, [onScroll]);

  const tabPaneStyle = useMemo(
    () => ({ overflow: 'auto', height, overscrollBehavior: 'contain' }),
    [height],
  );

  const numberOfFilters = nativeFilterValues.length;

  const filterControls = useMemo(
    () =>
      filterValues.length === 0 ? (
        <FilterBarEmptyStateContainer>
          <EmptyStateSmall
            title={t('No global filters are currently added')}
            image="filter.svg"
            description={
              canEdit &&
              t(
                'Click on "+Add/Edit Filters" button to create new dashboard filters',
              )
            }
          />
        </FilterBarEmptyStateContainer>
      ) : (
        <FilterControlsWrapper>
          <FilterControls
            dataMaskSelected={dataMaskSelected}
            onFilterSelectionChange={onSelectionChange}
          />
        </FilterControlsWrapper>
      ),
    [canEdit, dataMaskSelected, filterValues.length, onSelectionChange],
  );

  const filterSetsTabs = useMemo(
    () => (
      <StyledTabs
        centered
        onChange={setTab as HandlerFunction}
        defaultActiveKey={TabIds.AllFilters}
        activeKey={editFilterSetId ? TabIds.AllFilters : undefined}
      >
        <AntdTabs.TabPane
          tab={t('All filters (%(filterCount)d)', {
            filterCount: numberOfFilters,
          })}
          key={TabIds.AllFilters}
          css={tabPaneStyle}
        >
          {editFilterSetId && (
            <EditSection
              dataMaskSelected={dataMaskSelected}
              disabled={!isDisabled}
              onCancel={() => setEditFilterSetId(null)}
              filterSetId={editFilterSetId}
            />
          )}
          {filterControls}
        </AntdTabs.TabPane>
        <AntdTabs.TabPane
          disabled={!!editFilterSetId}
          tab={t('Filter sets (%(filterSetCount)d)', {
            filterSetCount: filterSetFilterValues.length,
          })}
          key={TabIds.FilterSets}
          css={tabPaneStyle}
        >
          <FilterSets
            onEditFilterSet={setEditFilterSetId}
            disabled={!isDisabled}
            dataMaskSelected={dataMaskSelected}
            tab={tab}
            onFilterSelectionChange={onSelectionChange}
          />
        </AntdTabs.TabPane>
      </StyledTabs>
    ),
    [
      dataMaskSelected,
      editFilterSetId,
      filterControls,
      filterSetFilterValues.length,
      isDisabled,
      numberOfFilters,
      onSelectionChange,
      tab,
      tabPaneStyle,
    ],
  );

  const crossFilters = useMemo(
    () =>
      isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS) ? (
        <CrossFiltersVertical />
      ) : null,
    [],
  );

  return (
    <FilterBarScrollContext.Provider value={isScrolling}>
      <BarWrapper
        {...getFilterBarTestId()}
        className={cx({ open: filtersOpen })}
        width={width}
      >
        <CollapsedBar
          {...getFilterBarTestId('collapsable')}
          className={cx({ open: !filtersOpen })}
          onClick={openFiltersBar}
          offset={offset}
        >
          <StyledCollapseIcon
            {...getFilterBarTestId('expand-button')}
            iconSize="l"
          />
          <StyledFilterIcon
            {...getFilterBarTestId('filter-icon')}
            iconSize="l"
          />
        </CollapsedBar>
        <Bar className={cx({ open: filtersOpen })} width={width}>
          <Header toggleFiltersBar={toggleFiltersBar} />
          {!isInitialized ? (
            <div css={{ height }}>
              <Loading />
            </div>
          ) : isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET) ? (
            <>
              {crossFilters}
              {filterSetsTabs}
            </>
          ) : (
            <div css={tabPaneStyle} onScroll={onScroll}>
              <>
                {crossFilters}
                {filterControls}
              </>
            </div>
          )}
          {actions}
        </Bar>
      </BarWrapper>
    </FilterBarScrollContext.Provider>
  );
};
export default React.memo(VerticalFilterBar);
