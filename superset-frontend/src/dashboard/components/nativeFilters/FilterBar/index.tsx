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
import { HandlerFunction, styled, t } from '@superset-ui/core';
import React, { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import cx from 'classnames';
import Icon from 'src/components/Icon';
import { Tabs } from 'src/common/components';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { updateDataMask } from 'src/dataMask/actions';
import { DataMaskState, DataMaskUnit } from 'src/dataMask/types';
import { useImmer } from 'use-immer';
import { areObjectsEqual } from 'src/reduxUtils';
import { Filter } from 'src/dashboard/components/nativeFilters/types';
import { mapParentFiltersToChildren, TabIds } from './utils';
import FilterSets from './FilterSets';
import {
  useDataMask,
  useFilters,
  useFilterSets,
  useFiltersInitialisation,
  useFilterUpdates,
} from './state';
import EditSection from './FilterSets/EditSection';
import Header from './Header';
import FilterControls from './FilterControls/FilterControls';

const barWidth = `250px`;

const BarWrapper = styled.div`
  width: ${({ theme }) => theme.gridUnit * 8}px;
  & .ant-tabs-top > .ant-tabs-nav {
    margin: 0;
  }
  &.open {
    width: ${barWidth}; // arbitrary...
  }
`;

const Bar = styled.div`
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
  width: ${barWidth}; // arbitrary...
  background: ${({ theme }) => theme.colors.grayscale.light5};
  border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  min-height: 100%;
  display: none;
  /* &.animated {
    display: flex;
    transform: translateX(-100%);
    transition: transform ${({ theme }) => theme.transitionTiming}s;
    transition-delay: 0s;
  }  */

  &.open {
    display: flex;
    /* &.animated {
      transform: translateX(0);
      transition-delay: ${({ theme }) => theme.transitionTiming * 2}s;
    } */
  }
`;

const CollapsedBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: ${({ theme }) => theme.gridUnit * 8}px;
  padding-top: ${({ theme }) => theme.gridUnit * 2}px;
  display: none;
  text-align: center;
  /* &.animated {
    display: block;
    transform: translateX(-100%);
    transition: transform ${({ theme }) => theme.transitionTiming}s;
    transition-delay: 0s;
  } */

  &.open {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: ${({ theme }) => theme.gridUnit * 2}px;
    /* &.animated {
      transform: translateX(0);
      transition-delay: ${({ theme }) => theme.transitionTiming * 3}s;
    } */
  }

  svg {
    width: ${({ theme }) => theme.gridUnit * 4}px;
    height: ${({ theme }) => theme.gridUnit * 4}px;
    cursor: pointer;
  }
`;

const StyledCollapseIcon = styled(Icon)`
  color: ${({ theme }) => theme.colors.primary.base};
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
`;

const StyledTabs = styled(Tabs)`
  & .ant-tabs-nav-list {
    width: 100%;
  }
  & .ant-tabs-tab {
    display: flex;
    justify-content: center;
    margin: 0;
    flex: 1;
  }
`;

export interface FiltersBarProps {
  filtersOpen: boolean;
  toggleFiltersBar: any;
  directPathToChild?: string[];
}

const FilterBar: React.FC<FiltersBarProps> = ({
  filtersOpen,
  toggleFiltersBar,
  directPathToChild,
}) => {
  const [editFilterSetId, setEditFilterSetId] = useState<string | null>(null);
  const [dataMaskSelected, setDataMaskSelected] = useImmer<DataMaskUnit>({});
  const [
    lastAppliedFilterData,
    setLastAppliedFilterData,
  ] = useImmer<DataMaskUnit>({});
  const dispatch = useDispatch();
  const filterSets = useFilterSets();
  const filterSetFilterValues = Object.values(filterSets);
  const [tab, setTab] = useState(TabIds.AllFilters);
  const filters = useFilters();
  const filterValues = Object.values<Filter>(filters);
  const dataMaskApplied = useDataMask();
  const [isFilterSetChanged, setIsFilterSetChanged] = useState(false);

  const cascadeChildren = useMemo(
    () => mapParentFiltersToChildren(filterValues),
    [filterValues],
  );

  const handleFilterSelectionChange = (
    filter: Pick<Filter, 'id'> & Partial<Filter>,
    dataMask: Partial<DataMaskState>,
  ) => {
    setIsFilterSetChanged(tab !== TabIds.AllFilters);
    setDataMaskSelected(draft => {
      const children = cascadeChildren[filter.id] || [];
      // force instant updating on initialization or for parent filters
      if (filter.isInstant || children.length > 0) {
        dispatch(updateDataMask(filter.id, dataMask));
      }

      if (dataMask.nativeFilters) {
        draft[filter.id] = dataMask.nativeFilters;
      }
    });
  };

  const handleApply = () => {
    const filterIds = Object.keys(dataMaskSelected);
    filterIds.forEach(filterId => {
      if (dataMaskSelected[filterId]) {
        dispatch(
          updateDataMask(filterId, {
            nativeFilters: dataMaskSelected[filterId],
          }),
        );
      }
    });
    setLastAppliedFilterData(() => dataMaskSelected);
  };

  const { isInitialized } = useFiltersInitialisation(
    dataMaskSelected,
    handleApply,
  );

  useFilterUpdates(
    dataMaskSelected,
    setDataMaskSelected,
    setLastAppliedFilterData,
  );

  const isApplyDisabled =
    !isInitialized || areObjectsEqual(dataMaskSelected, lastAppliedFilterData);

  return (
    <BarWrapper data-test="filter-bar" className={cx({ open: filtersOpen })}>
      <CollapsedBar
        className={cx({ open: !filtersOpen })}
        onClick={() => toggleFiltersBar(true)}
      >
        <StyledCollapseIcon name="collapse" />
        <Icon name="filter" />
      </CollapsedBar>
      <Bar className={cx({ open: filtersOpen })}>
        <Header
          toggleFiltersBar={toggleFiltersBar}
          onApply={handleApply}
          setDataMaskSelected={setDataMaskSelected}
          isApplyDisabled={isApplyDisabled}
          dataMaskSelected={dataMaskSelected}
          dataMaskApplied={dataMaskApplied}
        />
        {isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET) ? (
          <StyledTabs
            centered
            onChange={setTab as HandlerFunction}
            defaultActiveKey={TabIds.AllFilters}
            activeKey={editFilterSetId ? TabIds.AllFilters : undefined}
          >
            <Tabs.TabPane
              tab={t(`All Filters (${filterValues.length})`)}
              key={TabIds.AllFilters}
            >
              {editFilterSetId && (
                <EditSection
                  dataMaskSelected={dataMaskSelected}
                  disabled={!isApplyDisabled}
                  onCancel={() => setEditFilterSetId(null)}
                  filterSetId={editFilterSetId}
                />
              )}
              <FilterControls
                dataMaskSelected={dataMaskSelected}
                directPathToChild={directPathToChild}
                onFilterSelectionChange={handleFilterSelectionChange}
              />
            </Tabs.TabPane>
            <Tabs.TabPane
              disabled={!!editFilterSetId}
              tab={t(`Filter Sets (${filterSetFilterValues.length})`)}
              key={TabIds.FilterSets}
            >
              <FilterSets
                onEditFilterSet={setEditFilterSetId}
                disabled={!isApplyDisabled}
                dataMaskSelected={dataMaskSelected}
                isFilterSetChanged={isFilterSetChanged}
                onFilterSelectionChange={handleFilterSelectionChange}
              />
            </Tabs.TabPane>
          </StyledTabs>
        ) : (
          <FilterControls
            dataMaskSelected={dataMaskSelected}
            directPathToChild={directPathToChild}
            onFilterSelectionChange={handleFilterSelectionChange}
          />
        )}
      </Bar>
    </BarWrapper>
  );
};

export default FilterBar;
